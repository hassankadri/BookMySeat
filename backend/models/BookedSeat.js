const mongoose = require("mongoose");

// =====================================================
// CONFIRMED SEAT OWNERSHIP
// =====================================================

/**
 * Redis protects a seat temporarily while the customer pays.
 *
 * BookedSeat protects the seat permanently after payment.
 *
 * One document = one confirmed seat for one show.
 */
const bookedSeatSchema = new mongoose.Schema(
  {
    show: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Show",
      required: true,
      index: true,
    },

    seatId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Final database-level double-booking protection.
 *
 * MongoDB will reject:
 *
 * Show A + A1
 * Show A + A1   <- duplicate, not allowed
 *
 * But this is valid:
 *
 * Show A + A1
 * Show B + A1
 */
bookedSeatSchema.index(
  {
    show: 1,
    seatId: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "BookedSeat",
  bookedSeatSchema
);