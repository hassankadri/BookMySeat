
"use strict";

const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const BookedSeat = require("../models/BookedSeat");
const Show = require("../models/Show");
const Refund = require("../models/Refund");
const { auth, adminAuth } = require("../middleware/auth");
const { releaseSeats } = require("../services/seatLockService");
const { getStripe, retrievePaymentIntent } = require("../utils/stripe");

const router = express.Router();

const CANCELLATION_CUTOFF_MINUTES = Math.max(
  Number(process.env.CANCELLATION_CUTOFF_MINUTES || 60),
  0
);

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const getShowId = (booking) => booking.show?._id || booking.show;

const normalizeSeats = (items = []) =>
  [...new Set(items.map((x) => String(x).trim().toUpperCase()).filter(Boolean))];

const errorMessage = (error) => error?.message || "Unknown error";

const intentIdFor = (booking) =>
  booking.payment?.stripePaymentIntentId ||
  (String(booking.paymentId || "").startsWith("pi_")
    ? booking.paymentId
    : null);

// =====================================================
// ELIGIBILITY
// =====================================================

function cancellationEligibility(booking) {
  const showStart = booking.show?.startTime;

  if (!showStart) {
    return {
      canCancel: false,
      action: null,
      reason: "Show information is unavailable.",
    };
  }

  if (booking.ticketUsed) {
    return {
      canCancel: false,
      action: null,
      reason: "Ticket has already been used.",
    };
  }

  if (
    [
      "CANCELLED",
      "REFUND_PENDING",
      "REFUNDED",
      "PAYMENT_FAILED",
      "EXPIRED",
    ].includes(booking.status)
  ) {
    return {
      canCancel: false,
      action: null,
      reason: "This booking can no longer be cancelled.",
    };
  }

  const start = new Date(showStart);

  if (!Number.isFinite(start.getTime()) || start <= new Date()) {
    return {
      canCancel: false,
      action: null,
      reason: "The show has already started.",
    };
  }

  if (booking.status === "PENDING_PAYMENT") {
    return {
      canCancel: true,
      action: "CANCEL",
      reason: null,
    };
  }

  if (booking.status === "CONFIRMED") {
    if (
      Date.now() >=
      start.getTime() - CANCELLATION_CUTOFF_MINUTES * 60000
    ) {
      return {
        canCancel: false,
        action: null,
        reason:
          `Paid bookings cannot be cancelled within ` +
          `${CANCELLATION_CUTOFF_MINUTES} minutes of showtime.`,
      };
    }

    return {
      canCancel: true,
      action: "REFUND",
      reason: null,
    };
  }

  return {
    canCancel: false,
    action: null,
    reason: "Cancellation is unavailable.",
  };
}

// =====================================================
// REDIS LOCK CLEANUP
// =====================================================

async function releaseRedisLock(booking) {
  if (!booking.seatLock?.lockId) return;

  try {
    await releaseSeats({
      showId: getShowId(booking),
      seatIds: normalizeSeats(booking.seats),
      userId: booking.user,
      lockId: booking.seatLock.lockId,
    });
  } catch (error) {
    console.error("[Refund] Redis old-lock cleanup:", error);
  }
}

// =====================================================
// PERMANENT SEAT RELEASE
// =====================================================

async function releasePermanentSeats(booking) {
  const showId = getShowId(booking);
  const seatIds = normalizeSeats(booking.seats);

  if (!showId || !seatIds.length) return;

  const [otherPermanent, otherConfirmed] = await Promise.all([
    BookedSeat.find({
      show: showId,
      seatId: { $in: seatIds },
      booking: { $ne: booking._id },
    })
      .select("seatId")
      .lean(),

    Booking.find({
      _id: { $ne: booking._id },
      show: showId,
      status: "CONFIRMED",
      seats: { $in: seatIds },
    })
      .select("seats")
      .lean(),
  ]);

  const excluded = new Set(
    otherPermanent.map((row) => row.seatId)
  );

  for (const row of otherConfirmed) {
    for (const seatId of normalizeSeats(row.seats)) {
      excluded.add(seatId);
    }
  }

  const releasable = seatIds.filter(
    (seat) => !excluded.has(seat)
  );

  if (releasable.length !== seatIds.length) {
    throw new Error(
      "Another confirmed booking owns a requested seat; manual review required."
    );
  }

  // Remove legacy seat entries first.
  // The unique BookedSeat index prevents another booking
  // from taking this seat until its original row is gone.
  await Show.updateOne(
    { _id: showId },
    {
      $pull: {
        bookedSeats: {
          $in: releasable,
        },
      },
    }
  );

  // Delete only records belonging to this booking.
  await BookedSeat.deleteMany({
    booking: booking._id,
    show: showId,
    seatId: { $in: releasable },
  });

  await releaseRedisLock(booking);
}

// =====================================================
// VERIFY STRIPE PAYMENT
// =====================================================

async function verifyPaidIntent(booking) {
  const intentId = intentIdFor(booking);

  if (!intentId) {
    throw new Error(
      "This booking has no Stripe PaymentIntent; contact support."
    );
  }

  const intent = await retrievePaymentIntent(intentId);

  if (
    intent.status !== "succeeded" ||
    intent.metadata?.bookingId !== String(booking._id) ||
    intent.amount_received !==
      Math.round(Number(booking.totalAmount) * 100) ||
    String(intent.currency).toLowerCase() !==
      String(booking.currency || "INR").toLowerCase()
  ) {
    throw new Error(
      "Stripe payment could not be verified for this booking."
    );
  }

  return intent;
}

// =====================================================
// STOP UNPAID PAYMENT SAFELY
// =====================================================

async function stopPendingPaymentSafely(booking) {
  if (
    booking.paymentStatus === "completed" ||
    booking.payment?.status === "PAID" ||
    booking.payment?.paidAt
  ) {
    throw new Error(
      "Payment is already recorded as paid. Refresh My Bookings."
    );
  }

  const intentId = intentIdFor(booking);

  if (intentId) {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(intentId);

    if (
      ["succeeded", "processing", "requires_capture"].includes(
        intent.status
      )
    ) {
      throw new Error(
        "Stripe has received or is processing payment. Do not cancel or pay again; contact support."
      );
    }

    if (intent.status !== "canceled") {
      if (
        ![
          "requires_payment_method",
          "requires_confirmation",
          "requires_action",
        ].includes(intent.status)
      ) {
        throw new Error(
          "Payment is in an uncertain state. Try later."
        );
      }

      const cancelled = await stripe.paymentIntents.cancel(
        intentId,
        {},
        {
          idempotencyKey:
            `bms-customer-cancel-${booking._id}`,
        }
      );

      if (cancelled.status !== "canceled") {
        throw new Error(
          "Stripe payment cancellation could not be verified."
        );
      }
    }
  }

  const sessionId =
    booking.payment?.stripeCheckoutSessionId ||
    booking.sessionId;

  if (sessionId) {
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(
      sessionId
    );

    if (
      session.payment_status === "paid" ||
      session.status === "complete"
    ) {
      throw new Error(
        "Stripe checkout has completed; manual reconciliation is required."
      );
    }

    if (session.status === "open") {
      await stripe.checkout.sessions.expire(sessionId);
    } else if (session.status !== "expired") {
      throw new Error(
        "Checkout session is not safely cancellable yet."
      );
    }
  }
}

// =====================================================
// CUSTOMER BOOKING HISTORY
// GET /api/customer-bookings
// =====================================================

router.get("/", auth, async (req, res) => {
  try {
    const bookings = await Booking.find({
      user: req.userId,
    })
      .populate(
        "movie",
        "title poster banner duration genre rating"
      )
      .populate({
        path: "show",
        select:
          "startTime endTime language format theatre screen status",
        populate: [
          {
            path: "theatre",
            select: "name city address coverImage",
          },
          {
            path: "screen",
            select: "name screenNumber format audio",
          },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      cancellationCutoffMinutes:
        CANCELLATION_CUTOFF_MINUTES,
      bookings: bookings.map((booking) => ({
        ...booking,
        cancellation: cancellationEligibility(booking),
      })),
    });
  } catch (error) {
    console.error("Customer booking history:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load bookings.",
    });
  }
});

// =====================================================
// CUSTOMER — REFUND REQUEST
// POST /api/customer-bookings/:id/refund-request
// =====================================================

router.post("/:id/refund-request", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    let booking = await Booking.findOne({
      _id: req.params.id,
      user: req.userId,
    }).populate("show", "startTime status");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    // A retry may finish seat cleanup.
    // It must NEVER initiate a Stripe refund.
    const retry =
      booking.status === "REFUND_PENDING" &&
      booking.refundRequest?.requestedAt &&
      String(booking.refundRequest.requestedBy) ===
        String(req.userId);

    if (!retry) {
      const eligibility = cancellationEligibility(booking);

      if (
        !eligibility.canCancel ||
        eligibility.action !== "REFUND"
      ) {
        return res.status(409).json({
          success: false,
          message:
            eligibility.reason ||
            "This booking is not eligible for a refund request.",
        });
      }

      try {
        await verifyPaidIntent(booking);
      } catch (error) {
        return res.status(409).json({
          success: false,
          message: errorMessage(error),
        });
      }

      const now = new Date();

      const reason = String(
        req.body?.reason || "Cancelled by customer"
      )
        .trim()
        .slice(0, 500);

      // Atomic state change invalidates the QR.
      // Ticket check-in only accepts CONFIRMED.
      const updated = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          user: req.userId,
          status: "CONFIRMED",
          ticketUsed: false,
          "refundRequest.requestedAt": null,
        },
        {
          $set: {
            status: "REFUND_PENDING",
            paymentStatus: "refund_pending",
            "payment.status": "REFUND_PENDING",
            cancelledAt: now,
            cancellationReason: reason,
            "refundRequest.requestedAt": now,
            "refundRequest.requestedBy": req.userId,
            "refundRequest.status": "REQUESTED",
            "refundRequest.lastError": "",
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updated) {
        return res.status(409).json({
          success: false,
          message:
            "Booking changed. Refresh and try again.",
        });
      }

      booking = updated;
    }

    if (!booking.refundRequest?.seatReleasedAt) {
      try {
        await releasePermanentSeats(booking);

        await Booking.updateOne(
          {
            _id: booking._id,
            status: "REFUND_PENDING",
          },
          {
            $set: {
              "refundRequest.seatReleasedAt": new Date(),
              "refundRequest.lastError": "",
            },
          }
        );
      } catch (error) {
        console.error(
          "[Refund] Seat cleanup needs retry:",
          error
        );

        await Booking.updateOne(
          {
            _id: booking._id,
            status: "REFUND_PENDING",
          },
          {
            $set: {
              "refundRequest.lastError":
                `Seat release needs retry: ${errorMessage(error)}`
                  .slice(0, 500),
            },
          }
        );

        return res.status(202).json({
          success: true,
          pending: true,
          seatReleasePending: true,
          message:
            "Ticket cancelled and refund request saved. Seat release needs attention; please contact support.",
        });
      }
    }

    return res.status(202).json({
      success: true,
      pending: true,
      refunded: false,
      message:
        "Ticket cancelled, seat released. Refund request sent to the admin for approval.",
    });
  } catch (error) {
    console.error("Customer refund request:", error);

    return res.status(500).json({
      success: false,
      message:
        "Could not submit refund request.",
    });
  }
});

// =====================================================
// CUSTOMER — UNPAID CANCELLATION ONLY
// POST /api/customer-bookings/:id/cancel
// =====================================================

router.post("/:id/cancel", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.userId,
    }).populate("show", "startTime status");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    const eligibility = cancellationEligibility(booking);

    if (
      !eligibility.canCancel ||
      eligibility.action !== "CANCEL"
    ) {
      return res.status(409).json({
        success: false,
        message:
          booking.status === "CONFIRMED"
            ? "Paid bookings must use Request cancellation & refund."
            : eligibility.reason ||
              "Cancellation is not available.",
      });
    }

    try {
      await stopPendingPaymentSafely(booking);
    } catch (error) {
      console.error(
        "Unpaid booking Stripe cancellation preflight:",
        error
      );

      return res.status(409).json({
        success: false,
        message: errorMessage(error),
      });
    }

    const cancelled = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        user: req.userId,
        status: "PENDING_PAYMENT",
      },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: String(
            req.body?.reason || "Cancelled by customer"
          )
            .trim()
            .slice(0, 500),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!cancelled) {
      return res.status(409).json({
        success: false,
        message:
          "Booking status changed. Refresh and try again.",
      });
    }

    try {
      await releasePermanentSeats(cancelled);
    } catch (error) {
      console.error(
        "Unpaid booking seat cleanup:",
        error
      );

      return res.status(202).json({
        success: true,
        message:
          "Booking cancelled. Seat cleanup requires support.",
      });
    }

    return res.json({
      success: true,
      refunded: false,
      message: "Booking cancelled successfully.",
    });
  } catch (error) {
    console.error("Customer cancel booking:", error);

    return res.status(500).json({
      success: false,
      message: "Could not cancel booking.",
    });
  }
});

// =====================================================
// ADMIN — APPROVE CUSTOMER REFUND
//
// POST
// /api/customer-bookings/admin/refund-requests/:id/approve
// =====================================================

router.post(
  "/admin/refund-requests/:id/approve",
  auth,
  adminAuth,
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID.",
        });
      }

      let booking = await Booking.findById(
        req.params.id
      );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found.",
        });
      }

      if (
        booking.status === "REFUNDED" &&
        booking.refundRequest?.status === "SUCCEEDED"
      ) {
        return res.json({
          success: true,
          refunded: true,
          message: "This refund was already completed.",
        });
      }

      if (
        booking.status !== "REFUND_PENDING" ||
        !booking.refundRequest?.requestedAt ||
        !booking.refundRequest?.requestedBy
      ) {
        return res.status(409).json({
          success: false,
          message:
            "No customer refund request is awaiting approval.",
        });
      }

      // Verify the seats were actually released.
      if (!booking.refundRequest?.seatReleasedAt) {
        try {
          await releasePermanentSeats(booking);

          booking.refundRequest.seatReleasedAt =
            new Date();

          await booking.save();
        } catch (error) {
          return res.status(409).json({
            success: false,
            message:
              "Seats have not been safely released: " +
              errorMessage(error),
          });
        }
      }

      if (
        await BookedSeat.exists({
          booking: booking._id,
        })
      ) {
        return res.status(409).json({
          success: false,
          message:
            "A permanent seat is still attached to this booking. Review before refunding.",
        });
      }

      let intent;

      try {
        intent = await verifyPaidIntent(booking);
      } catch (error) {
        return res.status(409).json({
          success: false,
          message: errorMessage(error),
        });
      }

      const stripe = getStripe();
      const intentId = intent.id;

      // Match the existing manual-refund idempotency key
      // so concurrent operations cannot create
      // two separate refunds for the same booking.
      const refundKey =
        `bookmyseat-full-refund-${booking._id}`;

      if (booking.refundRequest.status === "REQUESTED") {
        const claimed = await Booking.findOneAndUpdate(
          {
            _id: booking._id,
            status: "REFUND_PENDING",
            "refundRequest.status": "REQUESTED",
          },
          {
            $set: {
              "refundRequest.status": "APPROVED",
              "refundRequest.approvedAt": new Date(),
              "refundRequest.approvedBy": req.userId,
              "refundRequest.lastError": "",
            },
          },
          {
            new: true,
            runValidators: true,
          }
        );

        if (claimed) {
          booking = claimed;
        } else {
          booking = await Booking.findById(
            req.params.id
          );
        }
      }

      if (
        !booking ||
        ![
          "APPROVED",
          "PROCESSING",
          "SUCCEEDED",
        ].includes(booking.refundRequest?.status)
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Refund approval state changed. Refresh and retry.",
        });
      }

      try {
        const recorded = await Refund.findOne({
          booking: booking._id,
        });

        let stripeRefund = null;

        if (recorded?.stripeRefundId) {
          stripeRefund = await stripe.refunds.retrieve(
            recorded.stripeRefundId
          );
        } else if (booking.payment?.stripeRefundId) {
          stripeRefund = await stripe.refunds.retrieve(
            booking.payment.stripeRefundId
          );
        } else {
          // Search Stripe first to avoid creating a refund
          // when a previous request already succeeded.
          const existing = await stripe.refunds.list({
            payment_intent: intentId,
            limit: 100,
          });

          if (existing.data.length > 1) {
            return res.status(409).json({
              success: false,
              message:
                "Multiple refunds already exist for this payment. Review in Stripe.",
            });
          }

          if (existing.data.length === 1) {
            if (
              existing.data[0].amount !==
              intent.amount_received
            ) {
              return res.status(409).json({
                success: false,
                message:
                  "An existing partial refund needs manual review.",
              });
            }

            stripeRefund = existing.data[0];
          }
        }

        if (!stripeRefund) {
          stripeRefund = await stripe.refunds.create(
            {
              payment_intent: intentId,
              reason: "requested_by_customer",
              metadata: {
                bookingId: String(booking._id),
                bookingCode: String(
                  booking.bookingCode
                ),
                approvedBy: String(req.userId),
                source: "customer_admin_approval",
              },
            },
            {
              idempotencyKey: refundKey,
            }
          );
        }

        if (
          stripeRefund.payment_intent !== intentId ||
          stripeRefund.amount !== intent.amount_received
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Stripe refund does not match the full original payment. Manual review required.",
          });
        }

        const refundStatus = String(
          stripeRefund.status || "pending"
        ).toUpperCase();

        // Keep the existing Refund collection up to date.
        await Refund.findOneAndUpdate(
          {
            booking: booking._id,
          },
          {
            $set: {
              stripeRefundId: stripeRefund.id,
              amount: stripeRefund.amount / 100,
              currency: String(
                stripeRefund.currency || "inr"
              ).toUpperCase(),
              reason:
                booking.cancellationReason ||
                "Customer requested cancellation",
              status: refundStatus,
              processedBy: req.userId,
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            runValidators: true,
          }
        );

        if (refundStatus === "SUCCEEDED") {
          await Booking.findOneAndUpdate(
            {
              _id: booking._id,
              status: "REFUND_PENDING",
            },
            {
              $set: {
                status: "REFUNDED",
                paymentStatus: "refunded",
                "payment.status": "REFUNDED",
                "payment.stripeRefundId":
                  stripeRefund.id,
                "payment.refundedAt": new Date(),
                "refundRequest.status": "SUCCEEDED",
                "refundRequest.lastError": "",
              },
            },
            {
              new: true,
              runValidators: true,
            }
          );

          return res.json({
            success: true,
            refunded: true,
            message:
              "Admin-approved refund completed in Stripe.",
          });
        }

        await Booking.updateOne(
          {
            _id: booking._id,
            status: "REFUND_PENDING",
          },
          {
            $set: {
              "payment.stripeRefundId":
                stripeRefund.id,
              "refundRequest.status": "PROCESSING",
              "refundRequest.lastError":
                stripeRefund.failure_reason || "",
            },
          }
        );

        return res.status(202).json({
          success: true,
          pending: true,
          refunded: false,
          message:
            `Stripe refund is ${refundStatus.toLowerCase()}. ` +
            "Use the admin check button to refresh its status.",
        });
      } catch (error) {
        console.error(
          "Admin-approved refund execution:",
          error
        );

        await Booking.updateOne(
          {
            _id: booking._id,
            status: "REFUND_PENDING",
          },
          {
            $set: {
              "refundRequest.lastError":
                errorMessage(error).slice(0, 500),
            },
          }
        ).catch(() => {});

        return res.status(502).json({
          success: false,
          message:
            "Stripe refund could not be confirmed. Use the same approval action to retry safely.",
        });
      }
    } catch (error) {
      console.error("Admin refund approval:", error);

      return res.status(500).json({
        success: false,
        message:
          "Failed to review the refund request.",
      });
    }
  }
);

module.exports = router;
