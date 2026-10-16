
"use strict";

const MAX_SEATS = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * 24 * ONE_HOUR_MS;

const SEAT_TYPES = new Set([
  "REGULAR",
  "PREMIUM",
  "RECLINER",
  "LOUNGER",
  "WHEELCHAIR",
]);

const toId = (value) =>
  String(
    typeof value === "string"
      ? value
      : value?.seatId || ""
  )
    .trim()
    .toUpperCase();

const roundMoney = (value) =>
  Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;

const clamp = (value, low, high) =>
  Math.max(
    low,
    Math.min(high, value)
  );

const asDate = (value) => {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date
    : null;
};

/**
 * Calculate trusted ticket prices using:
 *
 * - Confirmed show occupancy
 * - Time remaining until showtime
 * - Weekend demand
 * - Movie opening week
 * - Admin-defined pricing boundaries
 *
 * This function is read-only.
 *
 * It does not:
 * - Reserve seats
 * - Modify MongoDB
 * - Create Stripe payments
 * - Change existing bookings
 *
 * The payment route must save the calculated
 * amount in the booking snapshot before payment.
 */
function calculateDynamicPricingQuote({
  show,
  screen = show?.screen,
  movie = show?.movie,
  seatIds,
  bookedSeatIds = [],
  policy = null,
  now = new Date(),
} = {}) {
  if (
    !show ||
    !screen ||
    !Array.isArray(screen.seats)
  ) {
    throw new Error(
      "Show and physical screen are required for pricing."
    );
  }

  if (
    !Array.isArray(seatIds) ||
    seatIds.length < 1 ||
    seatIds.length > MAX_SEATS
  ) {
    throw new RangeError(
      "Select between 1 and 10 seats."
    );
  }

  const requested = seatIds.map(toId);

  if (
    requested.some((id) => !id) ||
    new Set(requested).size !== requested.length
  ) {
    throw new Error(
      "Seat IDs must be present and unique."
    );
  }

  // =================================================
  // PHYSICAL SEAT MAP
  // =================================================

  const activeSeats = screen.seats.filter(
    (seat) => seat.isActive !== false
  );

  const seatById = new Map(
    activeSeats.map((seat) => [
      toId(seat),
      seat,
    ])
  );

  const pricingByType = new Map(
    (show.pricing || []).map((row) => [
      String(
        row.seatType || ""
      ).toUpperCase(),

      Number(row.price),
    ])
  );

  // =================================================
  // OCCUPANCY
  // =================================================
  //
  // Only permanently booked seats influence demand.
  //
  // Temporary Redis holds must not let users
  // artificially increase ticket prices.

  const booked = new Set(
    [
      ...bookedSeatIds,
      ...(show.bookedSeats || []),
    ]
      .map(toId)
      .filter(Boolean)
  );

  const occupiedCount = [...booked].filter(
    (id) => seatById.has(id)
  ).length;

  const occupancy = activeSeats.length
    ? occupiedCount / activeSeats.length
    : 0;

  // =================================================
  // TIME VALIDATION
  // =================================================

  const currentTime = asDate(now);
  const startTime = asDate(show.startTime);

  if (
    !currentTime ||
    !startTime
  ) {
    throw new Error(
      "Valid current time and show start time are required."
    );
  }

  // =================================================
  // DYNAMIC PRICING FACTORS
  // =================================================

  const dynamicEnabled =
    policy?.enabled === true;

  const factors = [];
  let multiplier = 1;

  if (dynamicEnabled) {
    const getFactor = (key, fallback) => {
      const value = Number(
        policy[key] ?? fallback
      );

      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > 0.3
      ) {
        throw new Error(
          `Invalid dynamic pricing factor: ${key}.`
        );
      }

      return value;
    };

    const lowThreshold = Number(
      policy.lowOccupancyThreshold ?? 0.3
    );

    const highThreshold = Number(
      policy.highOccupancyThreshold ?? 0.75
    );

    const minMultiplier = Number(
      policy.minMultiplier ?? 0.9
    );

    const maxMultiplier = Number(
      policy.maxMultiplier ?? 1.3
    );

    if (
      !Number.isFinite(lowThreshold) ||
      !Number.isFinite(highThreshold) ||
      lowThreshold < 0 ||
      highThreshold > 1 ||
      lowThreshold >= highThreshold ||
      !Number.isFinite(minMultiplier) ||
      !Number.isFinite(maxMultiplier) ||
      minMultiplier < 0.8 ||
      maxMultiplier > 1.5 ||
      minMultiplier > maxMultiplier
    ) {
      throw new Error(
        "Invalid dynamic pricing policy boundaries."
      );
    }

    const applyFactor = (
      label,
      adjustment
    ) => {
      if (adjustment !== 0) {
        multiplier += adjustment;

        factors.push({
          label,
          adjustment,
        });
      }
    };

    // -----------------------------------------------
    // Demand-based adjustment
    // -----------------------------------------------

    if (occupancy < lowThreshold) {
      applyFactor(
        "Lower demand",
        -getFactor(
          "lowDemandDiscount",
          0.05
        )
      );
    } else if (
      occupancy >= highThreshold
    ) {
      applyFactor(
        "Higher demand",
        getFactor(
          "highDemandSurcharge",
          0.15
        )
      );
    }

    // -----------------------------------------------
    // Time-based adjustment
    // -----------------------------------------------

    const hoursToShow =
      (startTime - currentTime) /
      ONE_HOUR_MS;

    if (
      hoursToShow >= 0 &&
      hoursToShow <= 48
    ) {
      applyFactor(
        "Within 48 hours of showtime",
        getFactor(
          "last48HoursSurcharge",
          0.05
        )
      );
    }

    if (
      hoursToShow >= 0 &&
      hoursToShow <= 12
    ) {
      applyFactor(
        "Within 12 hours of showtime",
        getFactor(
          "last12HoursSurcharge",
          0.05
        )
      );
    }

    // -----------------------------------------------
    // Weekend adjustment (India timezone)
    // -----------------------------------------------

    const weekday =
      new Intl.DateTimeFormat(
        "en-US",
        {
          weekday: "short",
          timeZone: "Asia/Kolkata",
        }
      ).format(startTime);

    if (
      weekday === "Sat" ||
      weekday === "Sun"
    ) {
      applyFactor(
        "Weekend show",
        getFactor(
          "weekendSurcharge",
          0.05
        )
      );
    }

    // -----------------------------------------------
    // Opening week adjustment
    // -----------------------------------------------

    const releaseDate =
      movie?.releaseDate
        ? asDate(movie.releaseDate)
        : null;

    if (
      releaseDate &&
      startTime >= releaseDate &&
      startTime - releaseDate <
        ONE_WEEK_MS
    ) {
      applyFactor(
        "Opening week",
        getFactor(
          "openingWeekSurcharge",
          0.05
        )
      );
    }

    // Never exceed admin-defined boundaries.
    multiplier = clamp(
      multiplier,
      minMultiplier,
      maxMultiplier
    );
  }

  // =================================================
  // FINAL SERVER-SIDE PRICES
  // =================================================

  let baseSubtotalCents = 0;
  let subtotalCents = 0;

  const seatDetails = requested.map(
    (id) => {
      const physicalSeat =
        seatById.get(id);

      if (!physicalSeat) {
        throw new Error(
          `Seat ${id} is not active on this screen.`
        );
      }

      const type = String(
        physicalSeat.type || "REGULAR"
      ).toUpperCase();

      if (!SEAT_TYPES.has(type)) {
        throw new Error(
          `Unsupported seat category: ${type}.`
        );
      }

      const base =
        pricingByType.get(type);

      if (
        !Number.isFinite(base) ||
        base < 0
      ) {
        throw new Error(
          `Pricing is not configured for ${type} seats.`
        );
      }

      const baseCents =
        Math.round(base * 100);

      // Accessible seats retain their
      // configured price without a demand surcharge.
      const appliedMultiplier =
        type === "WHEELCHAIR"
          ? 1
          : multiplier;

      const chargedCents =
        Math.round(
          baseCents *
            appliedMultiplier
        );

      baseSubtotalCents +=
        baseCents;

      subtotalCents +=
        chargedCents;

      return {
        seatId: id,
        type,
        price:
          chargedCents / 100,
      };
    }
  );

  return {
    seatDetails,

    totalAmount:
      subtotalCents / 100,

    baseSubtotal:
      baseSubtotalCents / 100,

    adjustmentAmount:
      (subtotalCents -
        baseSubtotalCents) / 100,

    currency: "INR",

    occupancyPercent:
      Math.round(
        occupancy * 100
      ),

    dynamicPricingApplied:
      dynamicEnabled,

    multiplier:
      roundMoney(multiplier),

    factors,
  };
}

module.exports = {
  calculateDynamicPricingQuote,
};
