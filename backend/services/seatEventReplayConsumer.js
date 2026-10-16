
"use strict";

const { readSeatEvents } = require("./seatEventStream");

const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const CURSOR_PATTERN = /^\d{1,20}-\d{1,20}$/;

const PUBLIC_EVENTS = new Set([
  "seats:held",
  "seats:released",
  "seats:booked",
]);

/**
 * Consume a bounded page of retained Redis Stream events.
 *
 * "0-0" starts at the oldest retained event.
 * Pass nextCursor on the following request to continue.
 *
 * Event history is not the authoritative current seat state:
 * previous holds may have expired.
 */
async function consumeSeatEventPage({
  showId,
  after = "0-0",
  limit = DEFAULT_LIMIT,
}) {
  const cursor = String(after ?? "0-0");

  if (!CURSOR_PATTERN.test(cursor)) {
    const error = new Error("Invalid event cursor.");
    error.code = "INVALID_EVENT_CURSOR";
    throw error;
  }

  const size = Number(limit);

  if (
    !Number.isInteger(size) ||
    size < MIN_LIMIT ||
    size > MAX_LIMIT
  ) {
    const error = new Error(
      "Event limit must be between 1 and 100."
    );
    error.code = "INVALID_EVENT_LIMIT";
    throw error;
  }

  const stored = await readSeatEvents(showId, {
    fromId: cursor,
    count: size,
  });

  // Only expose supported public seat events.
  const events = stored
    .filter(
      (item) =>
        PUBLIC_EVENTS.has(item?.type) &&
        Array.isArray(item?.seatIds)
    )
    .map((item) => ({
      id: item.id,
      type: item.type,
      seatIds: item.seatIds,
      occurredAt: item.occurredAt,
      ...(item.expiresAt
        ? { expiresAt: item.expiresAt }
        : {}),
    }));

  const nextCursor = stored.length
    ? stored[stored.length - 1].id
    : cursor;

  return {
    events,
    nextCursor,
    mayHaveMore: stored.length === size,
  };
}

module.exports = {
  consumeSeatEventPage,
};
