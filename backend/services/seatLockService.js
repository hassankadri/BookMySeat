const crypto = require("crypto");

const {
  getRedisClient,
} = require("../config/redis");

const LOCK_TTL_SECONDS = 5 * 60;

// =====================================================
// REDIS KEY
// =====================================================

const createSeatKey = (
  showId,
  seatId
) =>
  `seat-lock:{${showId}}:${String(seatId)
    .trim()
    .toUpperCase()}`;

// =====================================================
// NORMALIZE
// =====================================================

const normalizeSeatIds = (seatIds = []) => [
  ...new Set(
    seatIds
      .map((seatId) =>
        String(seatId)
          .trim()
          .toUpperCase()
      )
      .filter(Boolean)
  ),
];

// =====================================================
// LOCK / EXTEND SELECTION
// =====================================================

const lockSeats = async ({
  showId,
  seatIds,
  userId,
}) => {
  const redis =
    await getRedisClient();

  const seats =
    normalizeSeatIds(seatIds);

  if (seats.length === 0) {
    throw new Error(
      "At least one seat is required."
    );
  }

  const proposedLockId =
    crypto.randomUUID();

  const keys = seats.map(
    (seatId) =>
      createSeatKey(
        showId,
        seatId
      )
  );

  /**
   * Auto-hold behavior:
   *
   * Click A1
   * -> new lock ABC
   *
   * Click A2
   * -> A1 proves this user owns lock ABC
   * -> A2 joins ABC
   *
   * All seats keep the SAME lockId and expiry.
   */
  const script = `
    local proposedLockId = ARGV[1]
    local userId = ARGV[2]
    local defaultTtl = tonumber(ARGV[3])

    local activeLockId = nil
    local minimumTtl = defaultTtl

    -- ===============================================
    -- CHECK REQUESTED SEATS
    -- ===============================================

    for i = 1, #KEYS do
      local current =
        redis.call(
          "GET",
          KEYS[i]
        )

      if current then
        local ok, data =
          pcall(
            cjson.decode,
            current
          )

        if not ok or not data then
          return {
            0,
            KEYS[i],
            "INVALID_LOCK"
          }
        end

        if tostring(data.userId) ~= tostring(userId) then
          return {
            0,
            KEYS[i],
            "OTHER_USER"
          }
        end

        if not activeLockId then
          activeLockId =
            tostring(
              data.lockId
            )

        elseif activeLockId ~= tostring(data.lockId) then
          return {
            0,
            KEYS[i],
            "DIFFERENT_LOCK"
          }
        end

        local currentTtl =
          redis.call(
            "TTL",
            KEYS[i]
          )

        if currentTtl > 0 and currentTtl < minimumTtl then
          minimumTtl =
            currentTtl
        end
      end
    end

    if not activeLockId then
      activeLockId =
        proposedLockId
    end

    local lockValue =
      '{"lockId":"' ..
      activeLockId ..
      '","userId":"' ..
      tostring(userId) ..
      '"}'

    -- ===============================================
    -- ADD NEW SEATS
    -- ===============================================

    for i = 1, #KEYS do
      local current =
        redis.call(
          "GET",
          KEYS[i]
        )

      if not current then
        redis.call(
          "SET",
          KEYS[i],
          lockValue,
          "EX",
          minimumTtl
        )
      end
    end

    -- ===============================================
    -- FORCE ONE EXPIRY FOR THE WHOLE SELECTION
    -- ===============================================

    for i = 1, #KEYS do
      redis.call(
        "EXPIRE",
        KEYS[i],
        minimumTtl
      )
    end

    return {
      1,
      activeLockId,
      minimumTtl
    }
  `;

  const result =
    await redis.eval(
      script,
      {
        keys,

        arguments: [
          proposedLockId,
          String(userId),
          String(
            LOCK_TTL_SECONDS
          ),
        ],
      }
    );

  if (
    Number(result[0]) !== 1
  ) {
    const lockedKey =
      String(
        result[1] || ""
      );

    const lockedSeat =
      lockedKey
        .split(":")
        .pop();

    return {
      success: false,

      lockedSeat,

      message:
        `Seat ${lockedSeat} is currently held by another reservation.`,
    };
  }

  const lockId =
    String(result[1]);

  const remainingTtl =
    Number(result[2]) ||
    LOCK_TTL_SECONDS;

  return {
    success: true,

    lockId,

    seats,

    expiresIn:
      remainingTtl,

    expiresAt:
      new Date(
        Date.now() +
          remainingTtl * 1000
      ),
  };
};

// =====================================================
// VERIFY LOCKS
// =====================================================

const verifySeatLocks = async ({
  showId,
  seatIds,
  userId,
  lockId,
}) => {
  const redis =
    await getRedisClient();

  const seats =
    normalizeSeatIds(seatIds);

  if (
    !lockId ||
    !userId ||
    seats.length === 0
  ) {
    return {
      valid: false,
      seatId:
        seats[0] || null,
    };
  }

  const expectedValue =
    JSON.stringify({
      lockId,
      userId:
        String(userId),
    });

  const checks =
    await Promise.all(
      seats.map(
        async (seatId) => {
          const key =
            createSeatKey(
              showId,
              seatId
            );

          const [
            currentValue,
            ttl,
          ] =
            await Promise.all([
              redis.get(key),
              redis.ttl(key),
            ]);

          return {
            seatId,
            currentValue,
            ttl,
          };
        }
      )
    );

  for (const check of checks) {
    if (
      check.currentValue !==
        expectedValue ||
      check.ttl <= 0
    ) {
      return {
        valid: false,
        seatId:
          check.seatId,
      };
    }
  }

  const minimumTtl =
    Math.min(
      ...checks.map(
        (check) =>
          check.ttl
      )
    );

  return {
    valid: true,

    expiresIn:
      minimumTtl,

    expiresAt:
      new Date(
        Date.now() +
          minimumTtl * 1000
      ),
  };
};

// =====================================================
// RELEASE SEATS
// =====================================================

const releaseSeats = async ({
  showId,
  seatIds,
  userId,
  lockId,
}) => {
  const redis =
    await getRedisClient();

  const seats =
    normalizeSeatIds(seatIds);

  if (seats.length === 0) {
    return {
      success: true,
      released: 0,
      releasedSeats: [],
    };
  }

  const expectedValue =
    JSON.stringify({
      lockId,
      userId:
        String(userId),
    });

  const keys =
    seats.map(
      (seatId) =>
        createSeatKey(
          showId,
          seatId
        )
    );

  const script = `
    local released = {}

    for i = 1, #KEYS do
      local current =
        redis.call(
          "GET",
          KEYS[i]
        )

      if current == ARGV[1] then
        redis.call(
          "DEL",
          KEYS[i]
        )

        table.insert(
          released,
          KEYS[i]
        )
      end
    end

    return released
  `;

  const releasedKeys =
    await redis.eval(
      script,
      {
        keys,

        arguments: [
          expectedValue,
        ],
      }
    );

  const releasedSeats =
    releasedKeys.map(
      (key) =>
        String(key)
          .split(":")
          .pop()
    );

  return {
    success: true,

    released:
      releasedSeats.length,

    releasedSeats,
  };
};

// =====================================================
// GET PUBLIC LOCKS
// =====================================================

const getLockedSeats = async ({
  showId,
  seatIds,
}) => {
  const redis =
    await getRedisClient();

  const seats =
    normalizeSeatIds(seatIds);

  if (seats.length === 0) {
    return [];
  }

  const results =
    await Promise.all(
      seats.map(
        async (seatId) => {
          const key =
            createSeatKey(
              showId,
              seatId
            );

          const [
            value,
            ttl,
          ] =
            await Promise.all([
              redis.get(key),
              redis.ttl(key),
            ]);

          if (
            !value ||
            ttl <= 0
          ) {
            return null;
          }

          return {
            seatId,

            ttl,

            expiresAt:
              new Date(
                Date.now() +
                  ttl * 1000
              ),
          };
        }
      )
    );

  return results.filter(
    Boolean
  );
};

module.exports = {
  LOCK_TTL_SECONDS,
  lockSeats,
  verifySeatLocks,
  releaseSeats,
  getLockedSeats,
};