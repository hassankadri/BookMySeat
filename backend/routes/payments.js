
"use strict";

const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");

const Booking = require("../models/Booking");
const { auth } = require("../middleware/auth");
const { getRedisClient } = require("../config/redis");
const { retrievePaymentIntent } = require("../utils/stripe");

// =====================================================
// FEATURE 6 — PAYMENT FRAUD PROTECTION
// =====================================================

const {
  paymentIntentAbuseGuard,
  observePaymentRisk,
} = require("../middleware/bookingRiskProtection");

const router = express.Router();

const MUTEX_TTL_MS = 120000;
const WAIT_FOR_REQUEST_MS = 15000;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Renew only a mutex owned by this request.
const RENEW = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
  end
  return 0
`;

// Never release another request's mutex.
const RELEASE = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`;

function paymentMutexKey(userId, showId, lockId) {
  const digest = crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        String(userId),
        String(showId),
        String(lockId),
      ])
    )
    .digest("hex");

  return `payment-create:{${digest}}`;
}

// =====================================================
// PAYMENTINTENT CREATION
// POST /api/payments/create-intent
// =====================================================
//
// The new middleware runs before the existing mutex.
//
// 1. Authenticate the customer.
// 2. Apply distributed payment-request limits.
// 3. Observe rejected payment requests.
// 4. Acquire the existing Redis payment mutex.
// 5. Continue into the original payment handler.
//
// No Stripe payment logic is replaced.

router.post(
  "/create-intent",
  auth,
  paymentIntentAbuseGuard,
  observePaymentRisk,
  async (req, res, next) => {
    const { showId, lockId } = req.body || {};

    if (
      !req.userId ||
      typeof showId !== "string" ||
      typeof lockId !== "string" ||
      !showId ||
      !lockId
    ) {
      // Existing payment route handles validation.
      return next();
    }

    const key = paymentMutexKey(
      req.userId,
      showId,
      lockId
    );

    const owner = crypto.randomUUID();

    let redis;
    let acquired = false;
    let cleaned = false;
    let renewal = null;

    try {
      redis = await getRedisClient();

      const deadline =
        Date.now() + WAIT_FOR_REQUEST_MS;

      while (
        !acquired &&
        Date.now() < deadline &&
        !res.destroyed
      ) {
        acquired =
          (await redis.set(key, owner, {
            NX: true,
            PX: MUTEX_TTL_MS,
          })) === "OK";

        if (!acquired) {
          await sleep(150);
        }
      }

      if (!acquired) {
        return res.status(409).json({
          success: false,
          code: "PAYMENT_REQUEST_IN_PROGRESS",
          message:
            "Your payment request is still being prepared. Please retry shortly.",
        });
      }

      // =============================================
      // OWNER-SAFE MUTEX CLEANUP
      // =============================================

      const cleanup = () => {
        if (cleaned) return;

        cleaned = true;

        if (renewal) {
          clearInterval(renewal);
        }

        void redis
          .eval(RELEASE, {
            keys: [key],
            arguments: [owner],
          })
          .catch((error) => {
            console.error(
              "Payment mutex release error:",
              error
            );
          });
      };

      // =============================================
      // MUTEX RENEWAL
      // =============================================

      renewal = setInterval(() => {
        void redis
          .eval(RENEW, {
            keys: [key],
            arguments: [
              owner,
              String(MUTEX_TTL_MS),
            ],
          })
          .then((renewed) => {
            if (Number(renewed) !== 1) {
              clearInterval(renewal);
              renewal = null;

              console.error(
                "Payment mutex lease was lost before request finished."
              );
            }
          })
          .catch((error) => {
            console.error(
              "Payment mutex renewal error:",
              error
            );
          });
      }, 10000);

      renewal.unref?.();

      res.once("finish", cleanup);
      res.once("close", cleanup);

      return next();
    } catch (error) {
      console.error(
        "Payment creation concurrency guard error:",
        error
      );

      return res.status(503).json({
        success: false,
        message:
          "Payment service is temporarily unavailable. Please retry.",
      });
    }
  }
);

// =====================================================
// FEATURE 2 — PAYMENT RECOVERY
// GET /api/payments/recovery/:bookingId
// =====================================================
//
// Preserve existing payment recovery.
//
// The signed Stripe webhook remains responsible for
// confirming bookings and permanent seat ownership.

router.get(
  "/recovery/:bookingId",
  auth,
  async (req, res) => {
    const { bookingId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        bookingId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    try {
      const booking =
        await Booking.findOne({
          _id: bookingId,
          user: req.userId,
        })
          .select(
            "bookingCode status paymentStatus totalAmount currency payment"
          )
          .lean();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found.",
        });
      }

      const response = {
        success: true,
        bookingId: String(booking._id),
        bookingCode: booking.bookingCode,
        bookingStatus: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentState: "NOT_STARTED",
        retryAfterSeconds: null,
      };

      const terminal = {
        CONFIRMED: "CONFIRMED",
        REFUND_PENDING: "REFUND_PENDING",
        REFUNDED: "REFUNDED",
        EXPIRED: "EXPIRED",
        CANCELLED: "CANCELLED",
      };

      if (terminal[booking.status]) {
        response.paymentState =
          terminal[booking.status];

        return res.json(response);
      }

      const intentId =
        booking.payment?.stripePaymentIntentId;

      if (!intentId) {
        response.paymentState =
          booking.status === "PAYMENT_FAILED"
            ? "PAYMENT_FAILED"
            : "NOT_STARTED";

        return res.json(response);
      }

      const intent =
        await retrievePaymentIntent(
          intentId
        );

      const belongsToBooking =
        intent.id === intentId &&
        String(
          intent.metadata?.bookingId
        ) === String(booking._id);

      const expectedAmount =
        Math.round(
          Number(booking.totalAmount) * 100
        );

      const amountMatches =
        intent.amount === expectedAmount &&
        String(
          intent.currency
        ).toLowerCase() ===
          String(
            booking.currency
          ).toLowerCase();

      if (
        !belongsToBooking ||
        !amountMatches
      ) {
        response.paymentState =
          "REVIEW_REQUIRED";

        return res.json(response);
      }

      if (
        intent.status === "succeeded"
      ) {
        response.paymentState =
          "AWAITING_WEBHOOK";

        response.retryAfterSeconds = 2;
      } else if (
        intent.status === "canceled"
      ) {
        response.paymentState =
          "PAYMENT_FAILED";
      } else if (
        intent.status ===
        "requires_payment_method"
      ) {
        response.paymentState =
          booking.status === "PAYMENT_FAILED"
            ? "PAYMENT_FAILED"
            : "PAYMENT_RETRY_AVAILABLE";
      } else {
        response.paymentState =
          "PAYMENT_PENDING";

        response.retryAfterSeconds = 2;
      }

      return res.json(response);
    } catch (error) {
      console.error(
        "Payment recovery lookup error:",
        error
      );

      return res.status(503).json({
        success: false,
        message:
          "Payment status is temporarily unavailable. Please check again.",
      });
    }
  }
);

// =====================================================
// EXISTING PAYMENT ROUTES — PRESERVED
// =====================================================
//
// All original booking and Stripe functionality
// remains in paymentsCore.js.
//
// Do not remove this compatibility route.

router.use(
  require("./paymentsCore")
);

module.exports = router;
