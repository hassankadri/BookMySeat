
"use strict";

const crypto = require("crypto");

const {
  getRedisClient,
} = require("../config/redis");

// =====================================================
// FEATURE 6 — DISTRIBUTED SEAT-HOLD RATE LIMITING
// =====================================================

const LIMITS = {
  perMinute: 30,
  perFifteenMinutes: 120,
};

const WINDOW_ONE_MINUTE = 60 * 1000;
const WINDOW_FIFTEEN_MINUTES = 15 * 60 * 1000;

// Atomic Redis counters.
// Works across multiple backend instances.

const RATE_LIMIT_SCRIPT = `
  local minuteCount = redis.call("INCR", KEYS[1])

  if minuteCount == 1 then
    redis.call("PEXPIRE", KEYS[1], ARGV[1])
  end

  local fifteenMinuteCount =
    redis.call("INCR", KEYS[2])

  if fifteenMinuteCount == 1 then
    redis.call("PEXPIRE", KEYS[2], ARGV[2])
  end

  local retryMs = 0

  if minuteCount > tonumber(ARGV[3]) then
    retryMs = math.max(
      retryMs,
      redis.call("PTTL", KEYS[1])
    )
  end

  if fifteenMinuteCount > tonumber(ARGV[4]) then
    retryMs = math.max(
      retryMs,
      redis.call("PTTL", KEYS[2])
    )
  end

  return {
    retryMs,
    minuteCount,
    fifteenMinuteCount
  }
`;

// =====================================================
// HELPERS
// =====================================================

function hashAccount(userId) {
  return crypto
    .createHash("sha256")
    .update(String(userId))
    .digest("hex");
}

function normalizeShowId(showId) {
  const value = String(showId || "");

  return /^[a-f0-9]{24}$/i.test(value)
    ? value
    : "unknown";
}

// =====================================================
// RECORD SUSPICIOUS REQUEST ACTIVITY
// =====================================================

async function recordHoldSignal(redis, details) {
  try {
    await redis.xAdd(
      "bms:fraud:hold-signals",
      "*",
      {
        eventType: "EXCESSIVE_SEAT_HOLD_REQUESTS",
        accountHash: details.accountHash,
        showId: details.showId,
        count: String(details.count),
        minuteCount: String(details.minuteCount),
        fifteenMinuteCount: String(
          details.fifteenMinuteCount
        ),
        occurredAt: new Date().toISOString(),
      },
      {
        TRIM: {
          strategy: "MAXLEN",
          strategyModifier: "~",
          threshold: 2000,
        },
      }
    );
  } catch (error) {
    console.error(
      "Seat-hold risk logging error:",
      error.message
    );
  }
}

// =====================================================
// SEAT-HOLD FRAUD GUARD
// =====================================================

async function seatHoldFraudGuard(req, res, next) {
  const userId = req.userId;

  // Existing auth middleware handles missing users.
  if (!userId) {
    return next();
  }

  try {
    const redis = await getRedisClient();

    const accountHash = hashAccount(userId);

    const keys = [
      `bms:fraud:hold:{${accountHash}}:1m`,
      `bms:fraud:hold:{${accountHash}}:15m`,
    ];

    const result = await redis.eval(
      RATE_LIMIT_SCRIPT,
      {
        keys,
        arguments: [
          String(WINDOW_ONE_MINUTE),
          String(WINDOW_FIFTEEN_MINUTES),
          String(LIMITS.perMinute),
          String(LIMITS.perFifteenMinutes),
        ],
      }
    );

    const retryMs = Number(result[0]);
    const minuteCount = Number(result[1]);
    const fifteenMinuteCount = Number(result[2]);

    if (retryMs <= 0) {
      return next();
    }

    // Record the first violation of each threshold.
    // Do not create unlimited event records.

    if (
      minuteCount === LIMITS.perMinute + 1 ||
      fifteenMinuteCount ===
        LIMITS.perFifteenMinutes + 1
    ) {
      void recordHoldSignal(redis, {
        accountHash,
        showId: normalizeShowId(
          req.body?.showId
        ),
        count: Math.max(
          minuteCount,
          fifteenMinuteCount
        ),
        minuteCount,
        fifteenMinuteCount,
      });
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(retryMs / 1000)
    );

    res.setHeader(
      "Retry-After",
      String(retryAfterSeconds)
    );

    return res.status(429).json({
      success: false,
      code: "SEAT_HOLD_RATE_LIMITED",
      message:
        "Too many seat requests. Please wait before trying again.",
      retryAfterSeconds,
    });
  } catch (error) {
    console.error(
      "Seat-hold rate limiter unavailable:",
      error.message
    );

    // Avoid blocking normal booking requests
    // solely because the fraud detector failed.
    // Existing Redis seat-locking validation remains.
    return next();
  }
}

module.exports = {
  seatHoldFraudGuard,
};
