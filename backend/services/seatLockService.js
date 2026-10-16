
const crypto = require("crypto");
const { getRedisClient } = require("../config/redis");
const { seatLockEventsTotal } = require("../config/metrics");

const LOCK_TTL_SECONDS = 5 * 60;

// Keep all seat keys for a show in the same Redis Cluster hash slot.
const createSeatKey = (showId, seatId) =>
  `seat-lock:{${showId}}:${String(seatId).trim().toUpperCase()}`;

const normalizeSeatIds = (seatIds = []) => [
  ...new Set(
    seatIds
      .map((seatId) => String(seatId).trim().toUpperCase())
      .filter(Boolean)
  ),
];

/**
 * Atomic all-or-nothing acquisition. Already-held seats owned by this user
 * keep their lock ID; newly selected seats join that lock and share its TTL.
 * The TTL is never extended merely by adding another seat.
 */
const HOLD_SCRIPT = `
  local proposedLockId = ARGV[1]
  local userId = ARGV[2]
  local defaultTtl = tonumber(ARGV[3])
  local activeLockId = nil
  local minimumTtl = defaultTtl

  -- Validate every seat before changing any key.
  for i = 1, #KEYS do
    local current = redis.call("GET", KEYS[i])
    if current then
      local ok, data = pcall(cjson.decode, current)
      if not ok or type(data) ~= "table" or
         type(data.lockId) ~= "string" or not data.userId then
        return { 0, KEYS[i], "INVALID_LOCK" }
      end
      if tostring(data.userId) ~= tostring(userId) then
        return { 0, KEYS[i], "OTHER_USER" }
      end
      if not activeLockId then
        activeLockId = tostring(data.lockId)
      elseif activeLockId ~= tostring(data.lockId) then
        return { 0, KEYS[i], "DIFFERENT_LOCK" }
      end
      local ttl = redis.call("TTL", KEYS[i])
      if ttl <= 0 then
        return { 0, KEYS[i], "INVALID_TTL" }
      end
      if ttl < minimumTtl then minimumTtl = ttl end
    end
  end

  if not activeLockId then activeLockId = proposedLockId end
  -- JSON field order matches existing BookMySeat lock values.
  local value = '{"lockId":"' .. activeLockId .. '","userId":"' .. tostring(userId) .. '"}'

  for i = 1, #KEYS do
    if not redis.call("GET", KEYS[i]) then
      redis.call("SET", KEYS[i], value, "EX", minimumTtl)
    end
  end
  for i = 1, #KEYS do
    redis.call("EXPIRE", KEYS[i], minimumTtl)
  end
  return { 1, activeLockId, minimumTtl }
`;

const VERIFY_SCRIPT = `
  local minimumTtl = nil
  for i = 1, #KEYS do
    if redis.call("GET", KEYS[i]) ~= ARGV[1] then
      return { 0, i }
    end
    local ttl = redis.call("TTL", KEYS[i])
    if ttl <= 0 then
      return { 0, i }
    end
    if not minimumTtl or ttl < minimumTtl then
      minimumTtl = ttl
    end
  end
  return { 1, minimumTtl }
`;

const RELEASE_SCRIPT = `
  local released = {}
  for i = 1, #KEYS do
    if redis.call("GET", KEYS[i]) == ARGV[1] then
      redis.call("DEL", KEYS[i])
      table.insert(released, KEYS[i])
    end
  end
  return released
`;

const lockSeats = async ({ showId, seatIds, userId }) => {
  const redis = await getRedisClient();
  const seats = normalizeSeatIds(seatIds);
  if (!seats.length) throw new Error("At least one seat is required.");

  const keys = seats.map((seatId) => createSeatKey(showId, seatId));
  const result = await redis.eval(HOLD_SCRIPT, {
    keys,
    arguments: [crypto.randomUUID(), String(userId), String(LOCK_TTL_SECONDS)],
  });

  if (Number(result[0]) !== 1) {
    seatLockEventsTotal.inc({ event: "hold_rejected" });

    const lockedSeat = String(result[1] || "").split(":").pop();
    return {
      success: false,
      lockedSeat,
      message: `Seat ${lockedSeat} is currently held by another reservation.`,
    };
  }

  seatLockEventsTotal.inc({ event: "hold_succeeded" });

  const remainingTtl = Number(result[2]);
  return {
    success: true,
    lockId: String(result[1]),
    seats,
    expiresIn: remainingTtl,
    expiresAt: new Date(Date.now() + remainingTtl * 1000),
  };
};

/**
 * Verify an entire selection in one Lua operation. Unlike separate GET/TTL
 * requests, this observes one consistent Redis state for all selected seats.
 * Payment confirmation must still use the MongoDB unique seat constraint.
 */
const verifySeatLocks = async ({ showId, seatIds, userId, lockId }) => {
  const seats = normalizeSeatIds(seatIds);
  if (!lockId || !userId || !seats.length) {
    return { valid: false, seatId: seats[0] || null };
  }

  const redis = await getRedisClient();
  const expectedValue = JSON.stringify({
    lockId,
    userId: String(userId),
  });
  const keys = seats.map((seatId) => createSeatKey(showId, seatId));
  const result = await redis.eval(VERIFY_SCRIPT, {
    keys,
    arguments: [expectedValue],
  });

  if (Number(result[0]) !== 1) {
    const index = Number(result[1]) - 1;
    return { valid: false, seatId: seats[index] || seats[0] };
  }

  const minimumTtl = Number(result[1]);
  return {
    valid: true,
    expiresIn: minimumTtl,
    expiresAt: new Date(Date.now() + minimumTtl * 1000),
  };
};

/** Only delete keys still held by the exact authenticated user and lock. */
const releaseSeats = async ({ showId, seatIds, userId, lockId }) => {
  const seats = normalizeSeatIds(seatIds);
  if (!seats.length) {
    return { success: true, released: 0, releasedSeats: [] };
  }

  const redis = await getRedisClient();
  const expectedValue = JSON.stringify({
    lockId,
    userId: String(userId),
  });
  const keys = seats.map((seatId) => createSeatKey(showId, seatId));
  const releasedKeys = await redis.eval(RELEASE_SCRIPT, {
    keys,
    arguments: [expectedValue],
  });
  const releasedSeats = releasedKeys.map((key) => String(key).split(":").pop());

  if (releasedSeats.length > 0) {
    seatLockEventsTotal.inc({ event: "seats_released" });
  }

  return {
    success: true,
    released: releasedSeats.length,
    releasedSeats,
  };
};

/** Public-facing list of live holds; never expose owner or lock IDs. */
const getLockedSeats = async ({ showId, seatIds }) => {
  const seats = normalizeSeatIds(seatIds);
  if (!seats.length) return [];

  const redis = await getRedisClient();
  const results = await Promise.all(seats.map(async (seatId) => {
    const key = createSeatKey(showId, seatId);
    const [value, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);
    if (!value || ttl <= 0) return null;
    return {
      seatId,
      ttl,
      expiresAt: new Date(Date.now() + ttl * 1000),
    };
  }));

  return results.filter(Boolean);
};

module.exports = {
  LOCK_TTL_SECONDS,
  lockSeats,
  verifySeatLocks,
  releaseSeats,
  getLockedSeats,
};
