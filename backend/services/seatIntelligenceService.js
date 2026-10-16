
"use strict";

const MAX_PARTY_SIZE = 10;

const ALLOWED_TYPES = new Set([
  "ANY",
  "REGULAR",
  "PREMIUM",
  "RECLINER",
  "LOUNGER",
  "WHEELCHAIR",
]);

const ALLOWED_VIEWS = new Set([
  "CENTER",
  "FRONT",
  "BACK",
]);

const seatId = (value) =>
  String(
    typeof value === "string"
      ? value
      : value?.seatId || ""
  )
    .trim()
    .toUpperCase();

const clamp = (number, min, max) =>
  Math.max(min, Math.min(max, number));

/**
 * Rank groups of seats using physical positions,
 * availability, preferences and pricing.
 *
 * This is an explainable optimization algorithm,
 * not a trained machine-learning model.
 *
 * It never reserves seats or modifies booking data.
 */
function recommendSeatGroups({
  seats = [],
  bookedSeatIds = [],
  heldSeatIds = [],
  pricing = [],
  fallbackPrice = 0,
  partySize = 2,
  seatType = "ANY",
  view = "CENTER",
  preferAisle = false,
  maxTotal = null,
  limit = 3,
} = {}) {
  const count = Number(partySize);
  const type = String(seatType).toUpperCase();
  const preferredView = String(view).toUpperCase();

  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_PARTY_SIZE
  ) {
    throw new RangeError(
      "Party size must be between 1 and 10."
    );
  }

  if (
    !ALLOWED_TYPES.has(type) ||
    !ALLOWED_VIEWS.has(preferredView)
  ) {
    throw new RangeError(
      "Invalid seat preference."
    );
  }

  if (
    maxTotal !== null &&
    (!Number.isFinite(maxTotal) || maxTotal <= 0)
  ) {
    throw new RangeError(
      "Maximum total must be a positive amount."
    );
  }

  // Permanent bookings and temporary Redis holds
  // are both unavailable for recommendation.
  const occupied = new Set(
    [...bookedSeatIds, ...heldSeatIds].map(seatId)
  );

  const prices = new Map(
    pricing.map((item) => [
      String(item.seatType || "").toUpperCase(),
      Number(item.price),
    ])
  );

  const physical = seats
    .filter(
      (seat) =>
        seat?.isActive !== false &&
        seatId(seat)
    )
    .map((seat) => ({
      seatId: seatId(seat),
      row: String(
        seat.row || ""
      ).toUpperCase(),
      column: Number(
        seat.column ?? seat.number
      ),
      type: String(
        seat.type || "REGULAR"
      ).toUpperCase(),
    }))
    .filter(
      (seat) =>
        seat.row &&
        Number.isInteger(seat.column) &&
        seat.column > 0
    );

  if (!physical.length) return [];

  const rows = [
    ...new Set(physical.map((seat) => seat.row)),
  ].sort((a, b) =>
    a.localeCompare(b, undefined, {
      numeric: true,
    })
  );

  const byRow = new Map(
    rows.map((row) => [row, []])
  );

  for (const seat of physical) {
    byRow.get(seat.row).push(seat);
  }

  const columns = physical.map(
    (seat) => seat.column
  );

  const middle =
    (Math.min(...columns) +
      Math.max(...columns)) /
    2;

  const halfWidth = Math.max(
    1,
    (Math.max(...columns) -
      Math.min(...columns)) /
      2
  );

  // Rows are ordered from the cinema screen
  // towards the back of the auditorium.
  const targetRow = {
    CENTER: 0.63,
    FRONT: 0.3,
    BACK: 0.85,
  }[preferredView];

  const options = [];

  for (const [rowIndex, row] of rows.entries()) {
    const all = byRow
      .get(row)
      .sort((a, b) => a.column - b.column);

    const actualColumns = new Set(
      all.map((seat) => seat.column)
    );

    const runs = [];
    let run = [];

    const flush = () => {
      if (run.length) runs.push(run);
      run = [];
    };

    for (const seat of all) {
      // Accessible positions are recommended only
      // when explicitly requested.
      const permitted =
        type === "ANY"
          ? seat.type !== "WHEELCHAIR"
          : seat.type === type;

      const price = prices.has(seat.type)
        ? prices.get(seat.type)
        : Number(fallbackPrice);

      const usable =
        permitted &&
        !occupied.has(seat.seatId) &&
        Number.isFinite(price) &&
        price > 0;

      if (!usable) {
        flush();
        continue;
      }

      if (run.length) {
        const previous =
          run[run.length - 1];

        // Missing columns represent aisles.
        // Different seat categories start new runs.
        if (
          seat.column !==
            previous.column + 1 ||
          seat.type !== previous.type
        ) {
          flush();
        }
      }

      run.push({ ...seat, price });
    }

    flush();

    for (const block of runs) {
      if (block.length < count) continue;

      for (
        let start = 0;
        start <= block.length - count;
        start += 1
      ) {
        const group = block.slice(
          start,
          start + count
        );

        const totalPrice = group.reduce(
          (sum, seat) => sum + seat.price,
          0
        );

        if (
          maxTotal !== null &&
          totalPrice > maxTotal
        ) {
          continue;
        }

        const groupMiddle =
          (group[0].column +
            group[group.length - 1].column) /
          2;

        const horizontalDistance =
          Math.abs(groupMiddle - middle) /
          halfWidth;

        const rowPosition =
          rows.length > 1
            ? rowIndex / (rows.length - 1)
            : targetRow;

        const verticalDistance =
          Math.abs(rowPosition - targetRow);

        const endsByAisle =
          !actualColumns.has(
            group[0].column - 1
          ) ||
          !actualColumns.has(
            group[group.length - 1].column + 1
          );

        // Avoid splitting an available group in
        // a way that leaves one isolated seat.
        const leavesSingleSeat =
          start === 1 ||
          block.length - (start + count) === 1;

        const score = Math.round(
          clamp(
            100 -
              35 * horizontalDistance -
              37 * verticalDistance -
              (leavesSingleSeat ? 13 : 0) -
              (preferAisle && !endsByAisle
                ? 12
                : 0),
            0,
            100
          )
        );

        const reasons = [
          "Seats together",
        ];

        if (horizontalDistance < 0.3) {
          reasons.push("Near the centre");
        }

        if (verticalDistance < 0.18) {
          reasons.push(
            "Preferred viewing distance"
          );
        }

        if (endsByAisle) {
          reasons.push("Aisle access");
        }

        if (!leavesSingleSeat) {
          reasons.push(
            "Avoids isolated seats"
          );
        }

        options.push({
          seatIds: group.map(
            (seat) => seat.seatId
          ),
          row,
          category: group[0].type,
          totalPrice:
            Math.round(totalPrice * 100) / 100,
          score,
          reasons,
        });
      }
    }
  }

  options.sort(
    (a, b) =>
      b.score - a.score ||
      a.totalPrice - b.totalPrice ||
      a.seatIds[0].localeCompare(
        b.seatIds[0],
        undefined,
        { numeric: true }
      )
  );

  // Provide distinct recommendations rather than
  // several overlapping variations of one group.
  const selected = [];
  const used = new Set();

  for (const option of options) {
    if (
      option.seatIds.some(
        (id) => used.has(id)
      )
    ) {
      continue;
    }

    selected.push(option);

    option.seatIds.forEach(
      (id) => used.add(id)
    );

    if (
      selected.length >=
      clamp(Number(limit) || 3, 1, 5)
    ) {
      break;
    }
  }

  return selected;
}

module.exports = {
  recommendSeatGroups,
};
