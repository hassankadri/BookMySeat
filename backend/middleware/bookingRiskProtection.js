
"use strict";

const crypto = require("crypto");
const {
  getRedisClient,
} = require("../config/redis");

// Distributed payment creation limits.
// Stripe webhooks and payment recovery are unaffected.
const PAYMENT_LIMITS = Object.freeze([
  {
    windowMs: 60_000,
    max: 12,
    suffix: "1m",
  },
  {
    windowMs: 15 * 60_000,
    max: 60,
    suffix: "15m",
  },
]);

// Advisory detection thresholds.
// A signal is not automatic proof of fraud.
const SIGNALS = Object.freeze({
  seat: {
    eventType: "REPEATED_SEAT_CONFLICTS",
    threshold: 15,
    windowMs: 15 * 60_000,
  },
  payment: {
    eventType: "REPEATED_PAYMENT_REQUEST_REJECTIONS",
    threshold: 8,
    windowMs: 15 * 60_000,
  },
});

// Atomic counters, shared across backend instances.
const LIMIT_SCRIPT = `
  local shortCount = redis.call("INCR", KEYS[1])
  if shortCount == 1 then
    redis.call("PEXPIRE", KEYS[1], ARGV[1])
  end

  local longCount = redis.call("INCR", KEYS[2])
  if longCount == 1 then
    redis.call("PEXPIRE", KEYS[2], ARGV[2])
  end

  local retry = 0

  if shortCount > tonumber(ARGV[3]) then
    retry = math.max(retry, redis.call("PTTL", KEYS[1]))
  end

  if longCount > tonumber(ARGV[4]) then
    retry = math.max(retry, redis.call("PTTL", KEYS[2]))
  end

  return {retry, shortCount, longCount}
`;

const INCREMENT_SCRIPT = `
  local count = redis.call("INCR", KEYS[1])

  if count == 1 then
    redis.call("PEXPIRE", KEYS[1], ARGV[1])
  end

  return count
`;

function accountHash(userId) {
  return crypto
    .createHash("sha256")
    .update(String(userId))
    .digest("hex");
}

function safeShowId(value) {
  const id = String(value || "").toLowerCase();

  return /^[a-f0-9]{24}$/.test(id)
    ? id
    : "unknown";
}

// =====================================================
// RISK EVENT JOURNAL
// =====================================================

async function writeRiskSignal(
  redis,
  {
    eventType,
    account,
    showId,
    count,
  }
) {
  // Do not record passwords, JWTs, emails,
  // seat-lock IDs or Stripe payment details.
  try {
    await redis.xAdd(
      "bms:risk:signals",
      "*",
      {
        eventType,
        accountHash: account,
        showId: safeShowId(showId),
        count: String(count),
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
      "Risk signal storage failed:",
      error.message
    );
  }
}

// =====================================================
// PAYMENT REQUEST RATE LIMITING
// =====================================================

/**
 * Apply after authentication but before the existing
 * PaymentIntent creation and concurrency middleware.
 *
 * This does not interfere with:
 * - Stripe webhook retries
 * - Payment recovery requests
 * - Existing booking idempotency
 * - Redis seat ownership
 */
async function paymentIntentAbuseGuard(
  req,
  res,
  next
) {
  if (!req.userId) {
    return next();
  }

  try {
    const redis = await getRedisClient();

    const account = accountHash(
      req.userId
    );

    const tag = `{${account}}`;

    const keys = PAYMENT_LIMITS.map(
      (limit) =>
        `bms:risk:payment-create:${tag}:${limit.suffix}`
    );

    const result = await redis.eval(
      LIMIT_SCRIPT,
      {
        keys,
        arguments: [
          ...PAYMENT_LIMITS.map(
            (limit) =>
              String(limit.windowMs)
          ),
          ...PAYMENT_LIMITS.map(
            (limit) =>
              String(limit.max)
          ),
        ],
      }
    );

    const retryMs = Number(
      result[0]
    );

    if (retryMs <= 0) {
      return next();
    }

    const shortCount = Number(
      result[1]
    );

    const longCount = Number(
      result[2]
    );

    const justExceeded =
      PAYMENT_LIMITS.some(
        (limit, index) =>
          (
            index === 0
              ? shortCount
              : longCount
          ) === limit.max + 1
      );

    if (justExceeded) {
      void writeRiskSignal(redis, {
        eventType:
          "EXCESSIVE_PAYMENT_CREATION_REQUESTS",
        account,
        showId: req.body?.showId,
        count: Math.max(
          shortCount,
          longCount
        ),
      });
    }

    const retryAfterSeconds =
      Math.max(
        1,
        Math.ceil(retryMs / 1000)
      );

    res.setHeader(
      "Retry-After",
      String(retryAfterSeconds)
    );

    return res.status(429).json({
      success: false,
      code: "PAYMENT_REQUEST_RATE_LIMITED",
      message:
        "Too many payment requests. Please wait before trying again.",
      retryAfterSeconds,
    });
  } catch (error) {
    // Additional risk protection must not
    // take down the existing payment service.
    // The original payment validation still runs.
    console.error(
      "Payment abuse guard unavailable:",
      error.message
    );

    return next();
  }
}

// =====================================================
// SUSPICIOUS REQUEST DETECTION
// =====================================================

async function recordRejectedRequest(
  kind,
  userId,
  showId
) {
  const config = SIGNALS[kind];

  if (!config || !userId) {
    return;
  }

  const redis = await getRedisClient();

  const account = accountHash(
    userId
  );

  const key =
    `bms:risk:{${account}}:${kind}:rejected`;

  const count = Number(
    await redis.eval(
      INCREMENT_SCRIPT,
      {
        keys: [key],
        arguments: [
          String(config.windowMs),
        ],
      }
    )
  );

  // Emit one advisory signal when the
  // threshold is reached.
  if (count === config.threshold) {
    await writeRiskSignal(redis, {
      eventType: config.eventType,
      account,
      showId,
      count,
    });
  }
}

function observeBookingRisk(kind) {
  return (req, res, next) => {
    const userId = req.userId;
    const showId = req.body?.showId;

    res.once("finish", () => {
      // Infrastructure failures are not fraud signals.
      const rejected =
        kind === "seat"
          ? res.statusCode === 409
          : [400, 409, 422].includes(
              res.statusCode
            );

      if (!rejected || !userId) {
        return;
      }

      void recordRejectedRequest(
        kind,
        userId,
        showId
      ).catch((error) => {
        console.error(
          "Booking risk observation failed:",
          error.message
        );
      });
    });

    return next();
  };
}

const observeSeatHoldRisk =
  observeBookingRisk("seat");

const observePaymentRisk =
  observeBookingRisk("payment");

module.exports = {
  paymentIntentAbuseGuard,
  observeSeatHoldRisk,
  observePaymentRisk,
};
