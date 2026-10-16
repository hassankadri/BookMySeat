
"use strict";

const crypto = require("crypto");
const { getRedisClient } = require("../config/redis");

const DEFAULT_CAPACITY = 10;
const DEFAULT_LEASE_SECONDS = 300;
const HEARTBEAT_TIMEOUT_MS = 90000;

const keysFor = (showId) => ({
  config: `bms:vq:config:${showId}`,
  waiting: `bms:vq:waiting:${showId}`,
  active: `bms:vq:active:${showId}`,
  heartbeat: `bms:vq:heartbeat:${showId}`,
  sequence: `bms:vq:sequence:${showId}`,
});

const tokenKeyFor = (
  showId,
  generation,
  userId
) =>
  `bms:vq:token:${showId}:${generation}:${userId}`;

// =====================================================
// ATOMIC FIFO ADMISSION
// =====================================================

const JOIN_SCRIPT = `
  if redis.call('HGET', KEYS[1], 'enabled') ~= '1' then
    return {'OFF'}
  end

  local capacity = tonumber(redis.call('HGET', KEYS[1], 'capacity')) or 10
  local leaseMs = tonumber(redis.call('HGET', KEYS[1], 'leaseMs')) or 300000
  local generation = redis.call('HGET', KEYS[1], 'generation') or ''
  local userId = ARGV[1]
  local now = tonumber(ARGV[2])
  local staleBefore = now - tonumber(ARGV[3])

  local stale = redis.call('ZRANGEBYSCORE', KEYS[4], '-inf', staleBefore, 'LIMIT', 0, 500)

  for _, oldUserId in ipairs(stale) do
    redis.call('ZREM', KEYS[2], oldUserId)
    redis.call('ZREM', KEYS[4], oldUserId)
  end

  redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)

  local activeUntil = redis.call('ZSCORE', KEYS[3], userId)

  if not activeUntil then
    if not redis.call('ZSCORE', KEYS[2], userId) then
      local sequence = redis.call('INCR', KEYS[5])
      redis.call('ZADD', KEYS[2], sequence, userId)
    end

    redis.call('ZADD', KEYS[4], now, userId)
  else
    redis.call('ZREM', KEYS[4], userId)
  end

  local activeCount = redis.call('ZCARD', KEYS[3])

  while activeCount < capacity do
    local nextInLine = redis.call('ZPOPMIN', KEYS[2], 1)

    if #nextInLine == 0 then
      break
    end

    local nextUserId = nextInLine[1]

    redis.call('ZREM', KEYS[4], nextUserId)
    redis.call('ZADD', KEYS[3], now + leaseMs, nextUserId)

    activeCount = activeCount + 1
  end

  redis.call('EXPIRE', KEYS[2], 86400)
  redis.call('EXPIRE', KEYS[3], 86400)
  redis.call('EXPIRE', KEYS[4], 86400)
  redis.call('EXPIRE', KEYS[5], 86400)

  activeUntil = redis.call('ZSCORE', KEYS[3], userId)

  if activeUntil then
    return {
      'ADMITTED',
      generation,
      tostring(activeUntil),
      tostring(capacity),
      tostring(leaseMs)
    }
  end

  local rank = redis.call('ZRANK', KEYS[2], userId)

  if rank then
    return {
      'WAITING',
      generation,
      tostring(rank + 1),
      tostring(redis.call('ZCARD', KEYS[2])),
      tostring(capacity),
      tostring(leaseMs)
    }
  end

  return {'RETRY'}
`;

// =====================================================
// ATOMIC TOKEN ISSUANCE
// =====================================================

const TOKEN_SCRIPT = `
  if redis.call('HGET', KEYS[1], 'enabled') ~= '1'
     or redis.call('HGET', KEYS[1], 'generation') ~= ARGV[3] then
    return {'RETRY'}
  end

  local untilTime = tonumber(
    redis.call('ZSCORE', KEYS[2], ARGV[1]) or '0'
  )

  local ttl = untilTime - tonumber(ARGV[2])

  if ttl <= 0 then
    return {'RETRY'}
  end

  local token = redis.call('GET', KEYS[3])

  if not token then
    redis.call(
      'SET',
      KEYS[3],
      ARGV[4],
      'PX',
      ttl,
      'NX'
    )

    token = redis.call('GET', KEYS[3])
  end

  return {'OK', token, tostring(untilTime)}
`;

// =====================================================
// ATOMIC ADMISSION VERIFICATION
// =====================================================

const VERIFY_SCRIPT = `
  if redis.call('HGET', KEYS[1], 'enabled') ~= '1' then
    return {'OFF'}
  end

  if redis.call('HGET', KEYS[1], 'generation') ~= ARGV[3] then
    return {'DENIED'}
  end

  local untilTime = tonumber(
    redis.call('ZSCORE', KEYS[2], ARGV[1]) or '0'
  )

  if untilTime <= tonumber(ARGV[2]) then
    return {'DENIED'}
  end

  local expected = redis.call('GET', KEYS[3])

  if not expected then
    return {'DENIED'}
  end

  return {'TOKEN', expected}
`;

// =====================================================
// LEAVE QUEUE
// =====================================================

const LEAVE_SCRIPT = `
  redis.call('ZREM', KEYS[1], ARGV[1])
  redis.call('ZREM', KEYS[2], ARGV[1])
  redis.call('ZREM', KEYS[3], ARGV[1])

  if redis.call('HGET', KEYS[4], 'generation') == ARGV[2] then
    redis.call('DEL', KEYS[5])
  end

  return 1
`;

// =====================================================
// PUBLIC CONFIGURATION
// =====================================================

function publicConfig(raw = {}) {
  return {
    enabled: raw.enabled === "1",

    capacity: Number(
      raw.capacity || DEFAULT_CAPACITY
    ),

    admissionSeconds: Math.floor(
      Number(
        raw.leaseMs ||
          DEFAULT_LEASE_SECONDS * 1000
      ) / 1000
    ),
  };
}

async function getConfiguration(showId) {
  const redis = await getRedisClient();

  const config = await redis.hGetAll(
    keysFor(showId).config
  );

  return publicConfig(config);
}

// =====================================================
// ADMIN CONFIGURATION
// =====================================================

async function configureQueue({
  showId,
  enabled,
  capacity,
  admissionSeconds,
  expiresAt,
}) {
  const redis = await getRedisClient();
  const keys = keysFor(showId);

  const generation = crypto.randomUUID();

  const multi = redis.multi();

  // Reconfiguration invalidates the previous queue.
  multi.del([
    keys.waiting,
    keys.active,
    keys.heartbeat,
    keys.sequence,
  ]);

  multi.hSet(keys.config, {
    enabled: enabled ? "1" : "0",
    generation,
    capacity: String(capacity),
    leaseMs: String(admissionSeconds * 1000),
  });

  if (expiresAt) {
    multi.expireAt(
      keys.config,
      Math.floor(
        new Date(expiresAt).getTime() / 1000
      )
    );
  }

  await multi.exec();

  return getConfiguration(showId);
}

// =====================================================
// JOIN / POLL / REFRESH RECOVERY
// =====================================================

async function joinQueue({
  showId,
  userId,
}) {
  const redis = await getRedisClient();
  const keys = keysFor(showId);

  const result = await redis.eval(
    JOIN_SCRIPT,
    {
      keys: [
        keys.config,
        keys.waiting,
        keys.active,
        keys.heartbeat,
        keys.sequence,
      ],

      arguments: [
        String(userId),
        String(Date.now()),
        String(HEARTBEAT_TIMEOUT_MS),
      ],
    }
  );

  if (result[0] === "OFF") {
    return {
      enabled: false,
      state: "OFF",
      admitted: true,
    };
  }

  if (result[0] === "WAITING") {
    const position = Number(result[2]);
    const capacity = Number(result[4]);
    const admissionSeconds =
      Number(result[5]) / 1000;

    return {
      enabled: true,
      state: "WAITING",
      admitted: false,
      position,
      peopleAhead: position - 1,
      totalWaiting: Number(result[3]),

      // Approximation, not a guaranteed wait time.
      estimatedWaitSeconds:
        Math.ceil(position / capacity) *
        admissionSeconds,

      retryAfterSeconds: 5,
    };
  }

  if (result[0] !== "ADMITTED") {
    return {
      enabled: true,
      state: "RETRY",
      admitted: false,
      retryAfterSeconds: 2,
    };
  }

  const generation = result[1];

  const generatedToken = crypto
    .randomBytes(32)
    .toString("hex");

  const tokenResult = await redis.eval(
    TOKEN_SCRIPT,
    {
      keys: [
        keys.config,
        keys.active,
        tokenKeyFor(
          showId,
          generation,
          userId
        ),
      ],

      arguments: [
        String(userId),
        String(Date.now()),
        generation,
        generatedToken,
      ],
    }
  );

  if (tokenResult[0] !== "OK") {
    return {
      enabled: true,
      state: "RETRY",
      admitted: false,
      retryAfterSeconds: 2,
    };
  }

  return {
    enabled: true,
    state: "ADMITTED",
    admitted: true,
    admissionToken: tokenResult[1],
    admittedUntil: new Date(
      Number(tokenResult[2])
    ).toISOString(),
  };
}

// =====================================================
// VERIFY ADMISSION BEFORE A SEAT HOLD
// =====================================================

async function verifyAdmission({
  showId,
  userId,
  token,
}) {
  const redis = await getRedisClient();
  const keys = keysFor(showId);

  const generation = await redis.hGet(
    keys.config,
    "generation"
  );

  const result = await redis.eval(
    VERIFY_SCRIPT,
    {
      keys: [
        keys.config,
        keys.active,
        tokenKeyFor(
          showId,
          generation || "none",
          userId
        ),
      ],

      arguments: [
        String(userId),
        String(Date.now()),
        generation || "none",
      ],
    }
  );

  if (result[0] === "OFF") {
    return {
      required: false,
      allowed: true,
    };
  }

  if (
    result[0] !== "TOKEN" ||
    typeof token !== "string"
  ) {
    return {
      required: true,
      allowed: false,
    };
  }

  const expected = Buffer.from(
    result[1],
    "utf8"
  );

  const provided = Buffer.from(
    token,
    "utf8"
  );

  return {
    required: true,

    allowed:
      expected.length === provided.length &&
      crypto.timingSafeEqual(
        expected,
        provided
      ),
  };
}

// =====================================================
// LEAVE / RELEASE ADMISSION
// =====================================================

async function leaveQueue({
  showId,
  userId,
}) {
  const redis = await getRedisClient();
  const keys = keysFor(showId);

  const generation =
    (await redis.hGet(
      keys.config,
      "generation"
    )) || "none";

  await redis.eval(
    LEAVE_SCRIPT,
    {
      keys: [
        keys.waiting,
        keys.active,
        keys.heartbeat,
        keys.config,
        tokenKeyFor(
          showId,
          generation,
          userId
        ),
      ],

      arguments: [
        String(userId),
        generation,
      ],
    }
  );
}

module.exports = {
  getConfiguration,
  configureQueue,
  joinQueue,
  verifyAdmission,
  leaveQueue,
};
