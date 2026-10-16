
"use strict";

const { getRedisClient } = require("../config/redis");

// Per-show Redis Streams keep broadcasts replayable.
// Redis AOF is already enabled in docker-compose.yml.
const SEAT_EVENTS = new Set([
  "seats:held",
  "seats:released",
  "seats:booked",
]);

const SHOW_ID_PATTERN = /^[a-f\d]{24}$/i;
const STREAM_LIMIT = 10000;

function streamKey(showId) {
  const id = String(showId || "").trim();

  if (!SHOW_ID_PATTERN.test(id)) {
    throw new Error("Invalid show ID for event stream.");
  }

  return `bms:seat-events:{${id.toLowerCase()}}`;
}

function normalizePublicEvent(eventName, payload = {}) {
  if (!SEAT_EVENTS.has(eventName)) return null;
  if (!payload || !Array.isArray(payload.seatIds)) return null;

  const seatIds = [
    ...new Set(
      payload.seatIds
        .map((value) =>
          String(value || "").trim().toUpperCase()
        )
        .filter((value) => /^[A-Z0-9_-]{1,16}$/.test(value))
    ),
  ];

  if (!seatIds.length) return null;

  const event = { eventName, seatIds };

  if (eventName === "seats:held" && payload.expiresAt) {
    const expiresAt = new Date(payload.expiresAt);

    if (!Number.isNaN(expiresAt.getTime())) {
      event.expiresAt = expiresAt.toISOString();
    }
  }

  return event;
}

/**
 * Append a public seat lifecycle event to a Redis Stream.
 *
 * The stream is an audit/replay channel, not the
 * authoritative source for seat availability.
 *
 * Never store lock IDs, user IDs or payment information.
 */
async function publishSeatEvent(showId, eventName, payload) {
  const event = normalizePublicEvent(eventName, payload);
  if (!event) return null;

  const redis = await getRedisClient();

  return redis.xAdd(
    streamKey(showId),
    "*",
    {
      type: event.eventName,
      seatIds: JSON.stringify(event.seatIds),
      occurredAt: new Date().toISOString(),
      ...(event.expiresAt
        ? { expiresAt: event.expiresAt }
        : {}),
    },
    {
      TRIM: {
        strategy: "MAXLEN",
        strategyModifier: "~",
        threshold: STREAM_LIMIT,
      },
    }
  );
}

/**
 * Read events using a Redis Stream cursor.
 *
 * fromId = "0-0" reads retained history.
 * fromId = "$" reads only subsequent events.
 *
 * This function does not modify booking state.
 */
async function readSeatEvents(
  showId,
  { fromId = "0-0", count = 100 } = {}
) {
  if (!/^(?:\d+-\d+|\$)$/.test(fromId)) {
    throw new Error("Invalid Redis stream cursor.");
  }

  const redis = await getRedisClient();

  const rows = await redis.xRead(
    {
      key: streamKey(showId),
      id: fromId,
    },
    {
      COUNT: Math.min(
        250,
        Math.max(1, Number(count) || 100)
      ),
    }
  );

  const messages = rows?.[0]?.messages || [];

  return messages.map(({ id, message }) => ({
    id,
    type: message.type,
    seatIds: JSON.parse(message.seatIds || "[]"),
    occurredAt: message.occurredAt,
    ...(message.expiresAt
      ? { expiresAt: message.expiresAt }
      : {}),
  }));
}

module.exports = {
  publishSeatEvent,
  readSeatEvents,
  streamKey,
};
