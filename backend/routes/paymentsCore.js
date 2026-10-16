
const express = require("express");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const DynamicPricingPolicy = require("../models/DynamicPricingPolicy");
const {
  calculateDynamicPricingQuote,
} = require("../services/dynamicPricingService");
const BookedSeat = require("../models/BookedSeat");
const Show = require("../models/Show");

const {
  verifySeatLocks,
} = require("../services/seatLockService");

const {
  createPaymentIntent,
  retrievePaymentIntent,
} = require("../utils/stripe");

const { auth } = require("../middleware/auth");

const {
  bookingEventsTotal,
  paymentEventsTotal,
} = require("../config/metrics");

const router = express.Router();
const MAX_SEATS_PER_BOOKING = 10;

/**
 * Normalize seat IDs and remove duplicates.
 */
const normalizeSeats = (seatIds = []) => [
  ...new Set(
    seatIds
      .map((seatId) =>
        String(seatId).trim().toUpperCase()
      )
      .filter(Boolean)
  ),
];

/**
 * Seat selections can arrive in different orders.
 */
const sameSeats = (first = [], second = []) => {
  const a = [...first].sort();
  const b = [...second].sort();

  return (
    a.length === b.length &&
    a.every((seat, index) => seat === b[index])
  );
};

// =====================================================
// CREATE V2 PAYMENT INTENT
// POST /api/payments/create-intent
// =====================================================

router.post("/create-intent", auth, async (req, res) => {
  try {
    const { showId, seatIds, lockId } = req.body;
    const userId = req.userId;

    // -----------------------------------------------
    // 1. Validate basic request
    // -----------------------------------------------

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(showId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid show ID.",
      });
    }

    if (!lockId) {
      return res.status(400).json({
        success: false,
        message: "Seat lock ID is required.",
      });
    }

    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one seat is required.",
      });
    }

    const seats = normalizeSeats(seatIds);

    if (seats.length > MAX_SEATS_PER_BOOKING) {
      return res.status(400).json({
        success: false,
        message:
          `You can book a maximum of ${MAX_SEATS_PER_BOOKING} seats at once.`,
      });
    }

    // -----------------------------------------------
    // 2. Verify Redis seat ownership
    // -----------------------------------------------

    const lockVerification = await verifySeatLocks({
      showId,
      seatIds: seats,
      userId,
      lockId,
    });

    if (!lockVerification.valid) {
      return res.status(409).json({
        success: false,
        message:
          `Seat ${lockVerification.seatId || ""} is no longer reserved for you. ` +
          "Please select your seats again.",
      });
    }

    // -----------------------------------------------
    // 3. Load show, screen and movie
    // -----------------------------------------------

    const show = await Show.findOne({
      _id: showId,
      status: "SCHEDULED",
      isActive: true,
    })
      .populate("screen")
      .populate("movie", "title poster releaseDate");

    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found or unavailable.",
      });
    }

    if (!show.screen) {
      return res.status(400).json({
        success: false,
        message: "This show does not have a valid cinema screen.",
      });
    }

    if (show.startTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "This show has already started.",
      });
    }

    // -----------------------------------------------
    // 4. Check permanent bookings
    // -----------------------------------------------

    const alreadyBooked = await BookedSeat.find({
      show: showId,
      seatId: { $in: seats },
    })
      .select("seatId")
      .lean();

    if (alreadyBooked.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          `Seat(s) already booked: ${alreadyBooked
            .map((seat) => seat.seatId)
            .join(", ")}`,
      });
    }

    // Preserve the legacy bookedSeats compatibility check.
    const legacyBookedSeats = new Set(
      (show.bookedSeats || []).map((seat) =>
        String(seat).toUpperCase()
      )
    );

    const legacyConflict = seats.filter((seatId) =>
      legacyBookedSeats.has(seatId)
    );

    if (legacyConflict.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          `Seat(s) already booked: ${legacyConflict.join(", ")}`,
      });
    }

    // -----------------------------------------------
    // 5. Validate seats against the physical screen
    // -----------------------------------------------

    const physicalSeatMap = new Map();

    for (const seat of show.screen.seats) {
      if (!seat.isActive) {
        continue;
      }

      physicalSeatMap.set(
        seat.seatId.toUpperCase(),
        seat
      );
    }

    const invalidSeats = seats.filter(
      (seatId) => !physicalSeatMap.has(seatId)
    );

    if (invalidSeats.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid seat(s): ${invalidSeats.join(", ")}`,
      });
    }

    // -----------------------------------------------
    // 6. Build trusted backend pricing
    // -----------------------------------------------

    const pricingMap = new Map();

    for (const pricing of show.pricing || []) {
      pricingMap.set(
        pricing.seatType,
        Number(pricing.price)
      );
    }

    // -----------------------------------------------
    // 7. Calculate final amount
    // -----------------------------------------------

    const seatDetails = [];
    let totalAmount = 0;

    for (const seatId of seats) {
      const physicalSeat = physicalSeatMap.get(seatId);
      const seatPrice = pricingMap.get(physicalSeat.type);

      if (
        typeof seatPrice !== "number" ||
        !Number.isFinite(seatPrice) ||
        seatPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Pricing is not configured for ${physicalSeat.type} seats.`,
        });
      }

      seatDetails.push({
        seatId,
        type: physicalSeat.type,
        price: seatPrice,
      });

      totalAmount += seatPrice;
    }

    // =============================================
    // OPTIONAL DYNAMIC PRICING
    // =============================================

    const dynamicPolicy =
      await DynamicPricingPolicy.findOne({
        show: showId,
        enabled: true,
      }).lean();

    if (dynamicPolicy) {
      const occupiedSeatRows = await BookedSeat.find({
        show: showId,
      })
        .select("seatId -_id")
        .lean();

      const dynamicQuote =
        calculateDynamicPricingQuote({
          show,
          screen: show.screen,
          movie: show.movie,
          seatIds: seats,
          bookedSeatIds: occupiedSeatRows.map(
            (record) => record.seatId
          ),
          policy: dynamicPolicy,
        });

      // Preserve the seatDetails array while replacing prices.
      seatDetails.splice(
        0,
        seatDetails.length,
        ...dynamicQuote.seatDetails
      );

      totalAmount = dynamicQuote.totalAmount;
    }

    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "The calculated booking amount is invalid.",
      });
    }

    // -----------------------------------------------
    // 8. Reuse booking associated with this Redis lock
    // -----------------------------------------------

    let booking = await Booking.findOne({
      user: userId,
      show: showId,
      "seatLock.lockId": lockId,
      status: "PENDING_PAYMENT",
    });

    if (booking) {
      if (!sameSeats(booking.seats, seats)) {
        return res.status(409).json({
          success: false,
          message:
            "This seat lock is already associated with another booking.",
        });
      }

      if (!booking.payment?.stripePaymentIntentId) {
        booking.movie = show.movie?._id || show.movie;
        booking.seats = seats;
        booking.seatDetails = seatDetails;
        booking.totalAmount = totalAmount;
        booking.currency = "INR";
        booking.seatLock.expiresAt =
          lockVerification.expiresAt;
        booking.payment.amount = totalAmount;
        booking.payment.currency = "INR";

        await booking.save();
      }
    } else {
      booking = await Booking.create({
        user: userId,
        show: showId,
        movie: show.movie?._id || show.movie,
        seats,
        seatDetails,
        totalAmount,
        currency: "INR",
        status: "PENDING_PAYMENT",
        paymentStatus: "pending",
        seatLock: {
          lockId,
          expiresAt: lockVerification.expiresAt,
        },
        payment: {
          provider: "STRIPE",
          status: "NOT_STARTED",
          amount: totalAmount,
          currency: "INR",
        },
      });

      // FEATURE 10: One event per newly created booking.
      bookingEventsTotal.inc({
        event: "pending_payment_created",
      });
    }

    // -----------------------------------------------
    // 9. Reuse existing PaymentIntent
    // -----------------------------------------------

    if (booking.payment?.stripePaymentIntentId) {
      const existingIntent = await retrievePaymentIntent(
        booking.payment.stripePaymentIntentId
      );

      // FEATURE 10: Measures reuse requests, not unique intents.
      paymentEventsTotal.inc({
        event: "intent_reused",
      });

      return res.json({
        success: true,
        bookingId: booking._id,
        bookingCode: booking.bookingCode,
        clientSecret: existingIntent.client_secret,
        amount: booking.totalAmount,
        currency: booking.currency,
        seats: booking.seatDetails,
        lockExpiresAt: booking.seatLock?.expiresAt || null,
      });
    }

    // -----------------------------------------------
    // 10. Create Stripe PaymentIntent
    // -----------------------------------------------

    const paymentIntent = await createPaymentIntent({
      bookingId: booking._id,
      bookingCode: booking.bookingCode,
      userId,
      showId,
      lockId,
      seatIds: seats,
      amount: totalAmount,
    });

    // -----------------------------------------------
    // 11. Save payment state
    // -----------------------------------------------

    booking.payment.status = "PENDING";
    booking.payment.stripePaymentIntentId =
      paymentIntent.id;
    booking.payment.amount = totalAmount;
    booking.payment.currency = "INR";

    await booking.save();

    // FEATURE 10: Count after the PaymentIntent is saved.
    paymentEventsTotal.inc({
      event: "intent_created",
    });

    // -----------------------------------------------
    // 12. Return frontend-safe response
    // -----------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Payment created successfully.",
      bookingId: booking._id,
      bookingCode: booking.bookingCode,

      // The client secret belongs to this PaymentIntent.
      // The Stripe API secret key remains on the backend.
      clientSecret: paymentIntent.client_secret,

      amount: totalAmount,
      currency: "INR",
      seats: seatDetails,
      movie: show.movie?.title || null,
      lockExpiresAt: lockVerification.expiresAt,
    });
  } catch (error) {
    console.error("Create PaymentIntent error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to start payment. Please try again.",
    });
  }
});

module.exports = router;
