
"use strict";

const express = require("express");

const {
  auth,
  adminAuth,
} = require("../middleware/auth");

const {
  getRedisClient,
} = require("../config/redis");

const router = express.Router();

const SOURCES = [
  {
    key: "bms:risk:signals",
    source: "booking-risk",
  },
  {
    key: "bms:fraud:hold-signals",
    source: "hold-rate-limit",
  },
];

function cleanText(value, maximum = 90) {
  return typeof value === "string"
    ? value.slice(0, maximum)
    : "";
}

function normalizeEvent(row, source) {
  const data = row.message || {};

  const timestamp = Number(
    String(row.id).split("-")[0]
  );

  const when = Date.parse(data.occurredAt);

  const occurredAt = Number.isFinite(when)
    ? new Date(when).toISOString()
    : Number.isFinite(timestamp)
      ? new Date(timestamp).toISOString()
      : null;

  return {
    id: `${source}:${row.id}`,
    source,

    type: cleanText(
      data.eventType || data.type
    ),

    accountHash: cleanText(
      data.accountHash,
      64
    ),

    showId: cleanText(
      data.showId,
      24
    ),

    count: Number(data.count) || 0,

    minuteCount:
      Number(data.minuteCount) || 0,

    fifteenMinuteCount:
      Number(data.fifteenMinuteCount) || 0,

    occurredAt,
  };
}

// Every endpoint requires administrator access.
router.use(auth, adminAuth);

// =====================================================
// GET /api/admin/risk
// =====================================================
//
// Read-only monitoring.
//
// Sources:
// - Repeated seat conflicts
// - Rejected payment requests
// - Payment creation rate limits
// - Seat-hold rate limits
//
// No passwords, tokens or payment credentials
// are returned.

router.get("/", async (req, res) => {
  const limit = Number(
    req.query.limit ?? 50
  );

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Limit must be an integer between 1 and 100.",
    });
  }

  res.set("Cache-Control", "no-store");

  try {
    const redis = await getRedisClient();

    const groups = await Promise.all(
      SOURCES.map(async ({ key, source }) => {
        const [rows, retained] =
          await Promise.all([
            redis.xRevRange(
              key,
              "+",
              "-",
              { COUNT: limit }
            ),
            redis.xLen(key),
          ]);

        return {
          source,
          retained: Number(retained),

          events: rows.map((row) =>
            normalizeEvent(row, source)
          ),
        };
      })
    );

    const events = groups
      .flatMap((group) => group.events)
      .sort((a, b) =>
        (b.occurredAt || "").localeCompare(
          a.occurredAt || ""
        )
      )
      .slice(0, limit);

    return res.json({
      success: true,
      events,

      retained: Object.fromEntries(
        groups.map((group) => [
          group.source,
          group.retained,
        ])
      ),

      note:
        "These are recorded threshold signals, not confirmed fraud. " +
        "Counts describe retained Redis Stream entries, not lifetime activity.",
    });
  } catch (error) {
    console.error(
      "Admin risk-monitoring read failed:",
      error
    );

    return res.status(503).json({
      success: false,
      message:
        "Risk monitoring is temporarily unavailable.",
    });
  }
});

module.exports = router;
