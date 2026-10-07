const mongoose = require("mongoose");

// =====================================================
// SHOW PRICING
// =====================================================

/**
 * Different seat categories can have different prices.
 *
 * Example:
 *
 * REGULAR  -> ₹250
 * PREMIUM  -> ₹400
 * RECLINER -> ₹650
 */
const pricingSchema = new mongoose.Schema(
  {
    seatType: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,

      enum: [
        "REGULAR",
        "PREMIUM",
        "RECLINER",
        "LOUNGER",
        "WHEELCHAIR",
      ],
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// SHOW MODEL
// =====================================================

const showSchema = new mongoose.Schema(
  {
    // Which movie is playing?
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
      index: true,
    },

    // Which theatre is showing it?
    theatre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theatre",
      required: true,
      index: true,
    },

    // Which physical screen inside the theatre?
    screen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Screen",
      required: true,
      index: true,
    },

    // =================================================
    // SHOW TIME
    // =================================================

    startTime: {
      type: Date,
      required: true,
      index: true,
    },

    endTime: {
      type: Date,
      required: true,
    },

    /**
     * LEGACY COMPATIBILITY
     *
     * Your old frontend uses:
     *
     * show.date
     * show.time
     *
     * We temporarily keep these fields and automatically
     * generate them from startTime.
     */
    date: {
      type: Date,
      default: null,
    },

    time: {
      type: String,
      default: "",
    },

    // =================================================
    // MOVIE PRESENTATION
    // =================================================

    language: {
      type: String,
      required: true,
      trim: true,
    },

    format: {
      type: String,

      enum: [
        "STANDARD",
        "3D",
        "IMAX",
        "IMAX_3D",
        "4DX",
        "DOLBY_CINEMA",
      ],

      default: "STANDARD",
      uppercase: true,
    },

    // =================================================
    // V2 PRICING
    // =================================================

    pricing: {
      type: [pricingSchema],
      default: [],
    },

    /**
     * LEGACY PRICE
     *
     * Old BookMySeat assumes every seat has one price:
     *
     * show.price
     *
     * We keep this temporarily.
     *
     * New code uses show.pricing instead.
     */
    price: {
      type: Number,
      min: 0,
      default: 0,
    },

    // =================================================
    // LEGACY BOOKED SEATS
    // =================================================

    /**
     * New permanent bookings use the BookedSeat collection.
     *
     * We keep bookedSeats temporarily because the existing
     * frontend may still read it.
     */
    bookedSeats: {
      type: [String],
      default: [],
    },

    // =================================================
    // BOOKING WINDOW
    // =================================================

    /**
     * Optional:
     *
     * bookingOpensAt
     * bookingClosesAt
     *
     * lets an admin control when users can book.
     */
    bookingOpensAt: {
      type: Date,
      default: null,
    },

    bookingClosesAt: {
      type: Date,
      default: null,
    },

    // =================================================
    // STATUS
    // =================================================

    status: {
      type: String,

      enum: [
        "SCHEDULED",
        "CANCELLED",
        "COMPLETED",
      ],

      default: "SCHEDULED",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    /**
     * Old admin route used this.
     *
     * Keeping it does not hurt and preserves old data.
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// INDEXES
// =====================================================

/**
 * Common query:
 *
 * "Give me upcoming shows for this movie."
 */
showSchema.index({
  movie: 1,
  startTime: 1,
});

/**
 * Common theatre query:
 *
 * theatre -> date -> shows
 */
showSchema.index({
  theatre: 1,
  startTime: 1,
});

/**
 * Used when checking whether another show overlaps
 * on the same screen.
 */
showSchema.index({
  screen: 1,
  startTime: 1,
  endTime: 1,
});

// =====================================================
// NORMALIZE SHOW BEFORE VALIDATION
// =====================================================

showSchema.pre(
  "validate",
  function (next) {
    // -----------------------------------------------
    // Normalize seat IDs
    // -----------------------------------------------

    if (
      Array.isArray(
        this.bookedSeats
      )
    ) {
      this.bookedSeats = [
        ...new Set(
          this.bookedSeats
            .map((seat) =>
              String(seat)
                .trim()
                .toUpperCase()
            )
            .filter(Boolean)
        ),
      ];
    }

    // -----------------------------------------------
    // Validate times
    // -----------------------------------------------

    if (
      this.startTime &&
      this.endTime &&
      this.endTime <=
        this.startTime
    ) {
      return next(
        new Error(
          "Show end time must be after start time."
        )
      );
    }

    // -----------------------------------------------
    // Keep old date/time frontend working
    // -----------------------------------------------

    if (this.startTime) {
      this.date =
        new Date(
          this.startTime
        );

      /**
       * BookMySeat currently targets India,
       * so legacy display time is generated in IST.
       */
      this.time =
        new Date(
          this.startTime
        ).toLocaleTimeString(
          "en-IN",
          {
            hour:
              "2-digit",

            minute:
              "2-digit",

            hour12: true,

            timeZone:
              "Asia/Kolkata",
          }
        );
    }

    // -----------------------------------------------
    // Keep legacy show.price synchronized
    // -----------------------------------------------

    if (
      Array.isArray(
        this.pricing
      ) &&
      this.pricing.length >
        0
    ) {
      const prices =
        this.pricing
          .map((item) =>
            Number(
              item.price
            )
          )
          .filter(
            (price) =>
              Number.isFinite(
                price
              )
          );

      if (
        prices.length > 0
      ) {
        this.price =
          Math.min(
            ...prices
          );
      }
    }

    next();
  }
);

// =====================================================
// EXPORT
// =====================================================

module.exports =
  mongoose.models.Show ||
  mongoose.model(
    "Show",
    showSchema
  );