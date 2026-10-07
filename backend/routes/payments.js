const express = require("express");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const BookedSeat = require("../models/BookedSeat");
const Show = require("../models/Show");

const {
  verifySeatLocks,
} = require("../services/seatLockService");

const {
  createPaymentIntent,
  retrievePaymentIntent,
} = require("../utils/stripe");

const {
  auth,
} = require("../middleware/auth");

const router =
  express.Router();

const MAX_SEATS_PER_BOOKING = 10;

/**
 * Normalize:
 *
 * ["a1", " A2 ", "A1"]
 *
 * into:
 *
 * ["A1", "A2"]
 */
const normalizeSeats = (seatIds = []) => [
  ...new Set(
    seatIds
      .map((seatId) =>
        String(seatId)
          .trim()
          .toUpperCase()
      )
      .filter(Boolean)
  ),
];

/**
 * Seat arrays may arrive in a different order.
 *
 * ["A1", "A2"]
 *
 * and
 *
 * ["A2", "A1"]
 *
 * still mean the same seat selection.
 */
const sameSeats = (
  first = [],
  second = []
) => {
  const a =
    [...first].sort();

  const b =
    [...second].sort();

  return (
    a.length ===
      b.length &&
    a.every(
      (seat, index) =>
        seat === b[index]
    )
  );
};

// =====================================================
// CREATE V2 PAYMENT INTENT
// POST /api/payments/create-intent
// =====================================================

router.post(
  "/create-intent",
  auth,
  async (req, res) => {
    try {
      const {
        showId,
        seatIds,
        lockId,
      } = req.body;

      /**
       * Your current auth middleware uses req.userId.
       *
       * We keep the same convention throughout
       * the entire backend.
       */
      const userId =
        req.userId;

      // -----------------------------------------------
      // 1. Validate basic request
      // -----------------------------------------------

      if (!userId) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Authentication required.",
          });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          showId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid show ID.",
          });
      }

      if (!lockId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Seat lock ID is required.",
          });
      }

      if (
        !Array.isArray(
          seatIds
        ) ||
        seatIds.length ===
          0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "At least one seat is required.",
          });
      }

      const seats =
        normalizeSeats(
          seatIds
        );

      if (
        seats.length >
        MAX_SEATS_PER_BOOKING
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              `You can book a maximum of ${MAX_SEATS_PER_BOOKING} seats at once.`,
          });
      }

      // -----------------------------------------------
      // 2. Verify Redis seat ownership
      // -----------------------------------------------

      /**
       * Never trust a seat list sent by the browser.
       *
       * Redis must prove that this authenticated user
       * still owns these exact seats.
       */
      const lockVerification =
        await verifySeatLocks(
          {
            showId,
            seatIds:
              seats,
            userId,
            lockId,
          }
        );

      if (
        !lockVerification.valid
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              `Seat ${
                lockVerification
                  .seatId || ""
              } is no longer reserved for you. ` +
              "Please select your seats again.",
          });
      }

      // -----------------------------------------------
      // 3. Load show + screen + movie
      // -----------------------------------------------

      const show =
        await Show.findOne(
          {
            _id: showId,
            status:
              "SCHEDULED",
            isActive: true,
          }
        )
          .populate(
            "screen"
          )
          .populate(
            "movie",
            "title poster"
          );

      if (!show) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Show not found or unavailable.",
          });
      }

      if (!show.screen) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "This show does not have a valid cinema screen.",
          });
      }

      if (
        show.startTime <=
        new Date()
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "This show has already started.",
          });
      }

      // -----------------------------------------------
      // 4. Check permanent bookings
      // -----------------------------------------------

      /**
       * Redis protects temporary holds.
       *
       * MongoDB BookedSeat protects confirmed bookings.
       */
      const alreadyBooked =
        await BookedSeat.find(
          {
            show:
              showId,

            seatId: {
              $in:
                seats,
            },
          }
        )
          .select(
            "seatId"
          )
          .lean();

      if (
        alreadyBooked.length >
        0
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              `Seat(s) already booked: ${alreadyBooked
                .map(
                  (seat) =>
                    seat.seatId
                )
                .join(", ")}`,
          });
      }

      /**
       * Temporary backward-compatibility check.
       *
       * Old BookMySeat still stores booked seats in:
       * show.bookedSeats
       */
      const legacyBookedSeats =
        new Set(
          (
            show.bookedSeats ||
            []
          ).map(
            (seat) =>
              String(
                seat
              ).toUpperCase()
          )
        );

      const legacyConflict =
        seats.filter(
          (seatId) =>
            legacyBookedSeats.has(
              seatId
            )
        );

      if (
        legacyConflict.length >
        0
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              `Seat(s) already booked: ${legacyConflict.join(
                ", "
              )}`,
          });
      }

      // -----------------------------------------------
      // 5. Validate seats against physical screen
      // -----------------------------------------------

      const physicalSeatMap =
        new Map();

      for (
        const seat of
        show.screen.seats
      ) {
        if (!seat.isActive) {
          continue;
        }

        physicalSeatMap.set(
          seat.seatId.toUpperCase(),
          seat
        );
      }

      const invalidSeats =
        seats.filter(
          (seatId) =>
            !physicalSeatMap.has(
              seatId
            )
        );

      if (
        invalidSeats.length >
        0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              `Invalid seat(s): ${invalidSeats.join(
                ", "
              )}`,
          });
      }

      // -----------------------------------------------
      // 6. Build trusted price lookup
      // -----------------------------------------------

      /**
       * Frontend never supplies the trusted price.
       *
       * Example:
       *
       * REGULAR  -> ₹250
       * PREMIUM  -> ₹400
       * RECLINER -> ₹650
       */
      const pricingMap =
        new Map();

      for (
        const pricing of
        show.pricing || []
      ) {
        pricingMap.set(
          pricing.seatType,
          Number(
            pricing.price
          )
        );
      }

      // -----------------------------------------------
      // 7. Calculate price on backend
      // -----------------------------------------------

      const seatDetails = [];

      let totalAmount = 0;

      for (
        const seatId of
        seats
      ) {
        const physicalSeat =
          physicalSeatMap.get(
            seatId
          );

        const seatPrice =
          pricingMap.get(
            physicalSeat.type
          );

        if (
          typeof seatPrice !==
            "number" ||
          !Number.isFinite(
            seatPrice
          ) ||
          seatPrice < 0
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                `Pricing is not configured for ${physicalSeat.type} seats.`,
            });
        }

        seatDetails.push({
          seatId,

          type:
            physicalSeat.type,

          price:
            seatPrice,
        });

        totalAmount +=
          seatPrice;
      }

      if (
        totalAmount <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "The calculated booking amount is invalid.",
          });
      }

      // -----------------------------------------------
      // 8. Handle retries safely
      // -----------------------------------------------

      /**
       * Users can double-click the payment button.
       *
       * Network requests can also retry.
       *
       * We reuse the booking associated with the same
       * Redis lock instead of creating duplicates.
       */
      let booking =
        await Booking.findOne(
          {
            user:
              userId,

            show:
              showId,

            "seatLock.lockId":
              lockId,

            status:
              "PENDING_PAYMENT",
          }
        );

      if (booking) {
        if (
          !sameSeats(
            booking.seats,
            seats
          )
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "This seat lock is already associated with another booking.",
            });
        }

        if (
          !booking.payment
            ?.stripePaymentIntentId
        ) {
          booking.movie =
            show.movie?._id ||
            show.movie;

          booking.seats =
            seats;

          booking.seatDetails =
            seatDetails;

          booking.totalAmount =
            totalAmount;

          booking.currency =
            "INR";

          booking.seatLock.expiresAt =
            lockVerification.expiresAt;

          booking.payment.amount =
            totalAmount;

          booking.payment.currency =
            "INR";

          await booking.save();
        }
      } else {
        booking =
          await Booking.create(
            {
              user:
                userId,

              show:
                showId,

              movie:
                show.movie?._id ||
                show.movie,

              seats,

              seatDetails,

              totalAmount,

              currency:
                "INR",

              status:
                "PENDING_PAYMENT",

              paymentStatus:
                "pending",

              seatLock: {
                lockId,

                expiresAt:
                  lockVerification.expiresAt,
              },

              payment: {
                provider:
                  "STRIPE",

                status:
                  "NOT_STARTED",

                amount:
                  totalAmount,

                currency:
                  "INR",
              },
            }
          );
      }

      // -----------------------------------------------
      // 9. Reuse existing PaymentIntent
      // -----------------------------------------------

      if (
        booking.payment
          ?.stripePaymentIntentId
      ) {
        const existingIntent =
          await retrievePaymentIntent(
            booking.payment
              .stripePaymentIntentId
          );

        return res.json({
          success: true,

          bookingId:
            booking._id,

          bookingCode:
            booking.bookingCode,

          clientSecret:
            existingIntent.client_secret,

          amount:
            booking.totalAmount,

          currency:
            booking.currency,

          seats:
            booking.seatDetails,

          lockExpiresAt:
            booking.seatLock
              ?.expiresAt ||
            null,
        });
      }

      // -----------------------------------------------
      // 10. Create Stripe PaymentIntent
      // -----------------------------------------------

      const paymentIntent =
        await createPaymentIntent(
          {
            bookingId:
              booking._id,

            bookingCode:
              booking.bookingCode,

            userId,

            showId,

            lockId,

            seatIds:
              seats,

            amount:
              totalAmount,
          }
        );

      // -----------------------------------------------
      // 11. Save payment state
      // -----------------------------------------------

      booking.payment.status =
        "PENDING";

      booking.payment.stripePaymentIntentId =
        paymentIntent.id;

      booking.payment.amount =
        totalAmount;

      booking.payment.currency =
        "INR";

      await booking.save();

      // -----------------------------------------------
      // 12. Return frontend-safe information
      // -----------------------------------------------

      res
        .status(201)
        .json({
          success: true,

          message:
            "Payment created successfully.",

          bookingId:
            booking._id,

          bookingCode:
            booking.bookingCode,

          /**
           * client_secret is safe to give to the
           * frontend for this individual PaymentIntent.
           *
           * The Stripe secret API key NEVER leaves backend.
           */
          clientSecret:
            paymentIntent.client_secret,

          amount:
            totalAmount,

          currency:
            "INR",

          seats:
            seatDetails,

          movie:
            show.movie
              ?.title ||
            null,

          lockExpiresAt:
            lockVerification.expiresAt,
        });
    } catch (error) {
      console.error(
        "Create PaymentIntent error:",
        error
      );

      res
        .status(500)
        .json({
          success: false,

          message:
            "Unable to start payment. Please try again.",
        });
    }
  }
);

module.exports = router;