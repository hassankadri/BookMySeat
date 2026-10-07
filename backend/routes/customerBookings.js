const express = require("express");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const BookedSeat = require("../models/BookedSeat");
const Show = require("../models/Show");

const {
  auth,
} = require("../middleware/auth");

const {
  releaseSeats,
} = require("../services/seatLockService");

const {
  refundPaymentIntent,
} = require("../utils/stripe");

const router =
  express.Router();

const CANCELLATION_CUTOFF_MINUTES =
  Math.max(
    Number(
      process.env
        .CANCELLATION_CUTOFF_MINUTES ||
        60
    ),
    0
  );

// =====================================================
// HELPERS
// =====================================================

const isValidId = (
  id
) =>
  mongoose.Types.ObjectId.isValid(
    id
  );

const normalizeSeats = (
  seats = []
) =>
  [
    ...new Set(
      seats
        .map((seat) =>
          String(
            seat
          )
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    ),
  ];

const getShowId = (
  booking
) =>
  booking.show?._id ||
  booking.show;

const releaseRedisLock =
  async (
    booking,
    userId
  ) => {
    const lockId =
      booking.seatLock
        ?.lockId;

    if (!lockId) {
      return;
    }

    try {
      await releaseSeats({
        showId:
          getShowId(
            booking
          ),

        seatIds:
          normalizeSeats(
            booking.seats
          ),

        userId,

        lockId,
      });
    } catch (error) {
      console.error(
        "Customer booking Redis release:",
        error
      );
    }
  };

const releasePermanentSeats =
  async (
    booking
  ) => {
    const showId =
      getShowId(
        booking
      );

    const seats =
      normalizeSeats(
        booking.seats
      );

    await BookedSeat.deleteMany({
      booking:
        booking._id,
    });

    if (
      showId &&
      seats.length
    ) {
      await Show.updateOne(
        {
          _id:
            showId,
        },

        {
          $pull: {
            bookedSeats: {
              $in:
                seats,
            },
          },
        }
      );
    }
  };

const getEligibility = (
  booking
) => {
    const status =
      booking.status;

    const startTime =
      booking.show
        ?.startTime;

    if (
      !startTime
    ) {
      return {
        canCancel:
          false,

        action:
          null,

        reason:
          "Show information is unavailable.",
      };
    }

    if (
      booking.ticketUsed
    ) {
      return {
        canCancel:
          false,

        action:
          null,

        reason:
          "Ticket has already been used.",
      };
    }

    if (
      [
        "CANCELLED",
        "REFUND_PENDING",
        "REFUNDED",
        "PAYMENT_FAILED",
        "EXPIRED",
      ].includes(
        status
      )
    ) {
      return {
        canCancel:
          false,

        action:
          null,

        reason:
          "This booking can no longer be cancelled.",
      };
    }

    const start =
      new Date(
        startTime
      );

    const now =
      new Date();

    if (
      start <= now
    ) {
      return {
        canCancel:
          false,

        action:
          null,

        reason:
          "The show has already started.",
      };
    }

    if (
      status ===
      "PENDING_PAYMENT"
    ) {
      return {
        canCancel:
          true,

        action:
          "CANCEL",

        reason:
          null,
      };
    }

    if (
      status ===
      "CONFIRMED"
    ) {
      const cutoff =
        new Date(
          start.getTime() -
            CANCELLATION_CUTOFF_MINUTES *
              60 *
              1000
        );

      if (
        now >= cutoff
      ) {
        return {
          canCancel:
            false,

          action:
            null,

          reason:
            `Paid bookings cannot be cancelled within ${CANCELLATION_CUTOFF_MINUTES} minutes of showtime.`,
        };
      }

      return {
        canCancel:
          true,

        action:
          "REFUND",

        reason:
          null,
      };
    }

    return {
      canCancel:
        false,

      action:
        null,

      reason:
        "Cancellation is unavailable.",
    };
  };

// =====================================================
// GET CUSTOMER BOOKING HISTORY
// GET /api/customer-bookings
// =====================================================

router.get(
  "/",

  auth,

  async (
    req,
    res
  ) => {
    try {
      const bookings =
        await Booking.find({
          user:
            req.userId,
        })

          .populate(
            "movie",
            "title poster banner duration genre rating"
          )

          .populate({
            path:
              "show",

            select:
              "startTime endTime language format theatre screen status",

            populate: [
              {
                path:
                  "theatre",

                select:
                  "name city address coverImage",
              },

              {
                path:
                  "screen",

                select:
                  "name screenNumber format audio",
              },
            ],
          })

          .sort({
            createdAt: -1,
          })

          .lean();

      const result =
        bookings.map(
          (booking) => ({
            ...booking,

            cancellation:
              getEligibility(
                booking
              ),
          })
        );

      return res.json({
        success: true,

        cancellationCutoffMinutes:
          CANCELLATION_CUTOFF_MINUTES,

        bookings:
          result,
      });
    } catch (error) {
      console.error(
        "Customer booking history:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to load bookings.",
        });
    }
  }
);

// =====================================================
// CANCEL / REFUND CUSTOMER BOOKING
// POST /api/customer-bookings/:id/cancel
// =====================================================

router.post(
  "/:id/cancel",

  auth,

  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      if (
        !isValidId(id)
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid booking ID.",
          });
      }

      const booking =
        await Booking.findOne({
          _id: id,

          user:
            req.userId,
        }).populate(
          "show",
          "startTime status"
        );

      if (!booking) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Booking not found.",
          });
      }

      const eligibility =
        getEligibility(
          booking
        );

      if (
        !eligibility.canCancel
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              eligibility.reason ||
              "This booking cannot be cancelled.",
          });
      }

      const reason =
        String(
          req.body.reason ||
            "Cancelled by customer"
        )
          .trim()
          .slice(
            0,
            500
          );

      // =================================================
      // UNPAID BOOKING
      // =================================================

      if (
        eligibility.action ===
        "CANCEL"
      ) {
        booking.status =
          "CANCELLED";

        booking.cancelledAt =
          new Date();

        booking.cancellationReason =
          reason;

        if (
          booking.paymentStatus ===
          "pending"
        ) {
          booking.paymentStatus =
            "cancelled";
        }

        if (
          booking.payment
        ) {
          booking.payment.status =
            "CANCELLED";
        }

        await booking.save();

        await releaseRedisLock(
          booking,
          req.userId
        );

        await releasePermanentSeats(
          booking
        );

        return res.json({
          success: true,

          refunded:
            false,

          message:
            "Booking cancelled successfully.",
        });
      }

      // =================================================
      // PAID BOOKING → STRIPE REFUND
      // =================================================

      const paymentIntentId =
        booking.payment
          ?.stripePaymentIntentId ||
        (
          String(
            booking.paymentId ||
              ""
          ).startsWith(
            "pi_"
          )
            ? booking.paymentId
            : null
        );

      if (
        !paymentIntentId
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Automatic refund is unavailable for this booking. Please contact support.",
          });
      }

      // Mark first so duplicate requests cannot trigger
      // multiple refund attempts.
      booking.status =
        "REFUND_PENDING";

      booking.paymentStatus =
        "refund_pending";

      booking.cancelledAt =
        new Date();

      booking.cancellationReason =
        reason;

      if (
        !booking.payment
      ) {
        booking.payment = {};
      }

      booking.payment.status =
        "REFUND_PENDING";

      await booking.save();

      try {
        const refund =
          await refundPaymentIntent({
            paymentIntentId,

            bookingId:
              booking._id,
          });

        booking.status =
          "REFUNDED";

        booking.paymentStatus =
          "refunded";

        booking.payment.status =
          "REFUNDED";

        booking.payment.stripeRefundId =
          refund.id;

        booking.payment.refundedAt =
          new Date();

        await booking.save();

        await releasePermanentSeats(
          booking
        );

        await releaseRedisLock(
          booking,
          req.userId
        );

        return res.json({
          success: true,

          refunded:
            true,

          refundId:
            refund.id,

          message:
            "Booking cancelled and refund completed.",
        });
      } catch (
        refundError
      ) {
        console.error(
          "Customer Stripe refund:",
          refundError
        );

        // Keep REFUND_PENDING so the admin can
        // investigate/retry instead of falsely saying
        // money was returned.
        return res
          .status(202)
          .json({
            success:
              true,

            refunded:
              false,

            pending:
              true,

            message:
              "Cancellation was received, but the refund is still pending. It will remain visible to the admin.",
          });
      }
    } catch (error) {
      console.error(
        "Customer cancel booking:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Could not cancel booking.",
        });
    }
  }
);

module.exports =
  router;