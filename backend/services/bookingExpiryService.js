
"use strict";

const Booking = require("../models/Booking");
const BookedSeat = require("../models/BookedSeat");
const { releaseSeats } = require("./seatLockService");
const { getStripe } = require("../utils/stripe");
const { bookingEventsTotal } = require("../config/metrics");

const INTERVAL_MS = Math.max(
  Number(process.env.BOOKING_EXPIRY_CHECK_INTERVAL_MS || 30000),
  10000
);
const NO_INTENT_GRACE_MS = 10 * 60 * 1000;

let running = false;
let intervalHandle = null;
let initialHandle = null;
const lastWarning = new Map();

function warn(bookingId, message) {
  const key = `${bookingId}:${message}`;
  if (Date.now() - (lastWarning.get(key) || 0) < 300000) return;

  lastWarning.set(key, Date.now());
  console.warn(`[Booking Expiry] ${bookingId}: ${message}`);
}

// Never release a lock belonging to another customer.
async function releaseOldLock(booking) {
  if (!booking.seatLock?.lockId) return;

  try {
    await releaseSeats({
      showId: booking.show,
      seatIds: booking.seats || [],
      userId: booking.user,
      lockId: booking.seatLock.lockId,
    });
  } catch (error) {
    console.error(
      `[Booking Expiry] Redis release failed for ${booking._id}:`,
      error
    );
  }
}

// A stale booking is only safe to expire after checking
// the actual Stripe payment state.
async function safeToExpire(booking) {
  const intentId = booking.payment?.stripePaymentIntentId;

  if (!intentId) {
    const deadline = new Date(booking.seatLock?.expiresAt).getTime();

    if (
      !Number.isFinite(deadline) ||
      Date.now() - deadline < NO_INTENT_GRACE_MS
    ) {
      return false;
    }

    // Payment creation could be in progress.
    if (
      !["NOT_STARTED", undefined, null].includes(
        booking.payment?.status
      )
    ) {
      warn(
        booking._id,
        "PaymentIntent is missing but payment may have started; investigate."
      );
      return false;
    }

    return true;
  }

  let stripe;
  let intent;

  try {
    stripe = getStripe();
    intent = await stripe.paymentIntents.retrieve(intentId);
  } catch (error) {
    warn(
      booking._id,
      `Stripe lookup failed; NOT expiring: ${error.message}`
    );
    return false;
  }

  if (
    intent.id !== intentId ||
    intent.metadata?.bookingId !== String(booking._id)
  ) {
    warn(
      booking._id,
      "Stripe intent metadata mismatch; NOT expiring."
    );
    return false;
  }

  if (
    ["succeeded", "processing", "requires_capture"].includes(
      intent.status
    )
  ) {
    warn(
      booking._id,
      `Stripe payment ${intent.status}; waiting for confirmation/reconciliation.`
    );
    return false;
  }

  if (intent.status === "canceled") return true;

  // Cancel an unpaid intent BEFORE releasing seats.
  // If a payment succeeds concurrently, Stripe refuses
  // cancellation and we do not expire it.
  if (
    [
      "requires_payment_method",
      "requires_confirmation",
      "requires_action",
    ].includes(intent.status)
  ) {
    try {
      const cancelled = await stripe.paymentIntents.cancel(
        intentId,
        {},
        {
          idempotencyKey: `bms-expiry-cancel-${booking._id}`,
        }
      );

      return cancelled.status === "canceled";
    } catch (error) {
      warn(
        booking._id,
        `Cannot verify canceled intent; NOT expiring: ${error.message}`
      );
      return false;
    }
  }

  warn(
    booking._id,
    `Unhandled Stripe state ${intent.status}; NOT expiring.`
  );
  return false;
}

async function expireOne(booking) {
  if (!(await safeToExpire(booking))) return false;

  // Permanent seats can mean the webhook is midway through
  // confirmation. Never delete them during expiry.
  if (await BookedSeat.exists({ booking: booking._id })) {
    warn(
      booking._id,
      "Permanent seat record exists; manual review required."
    );
    return false;
  }

  const expectedIntentId = booking.payment?.stripePaymentIntentId;
  const expectedPaymentStatus = booking.payment?.status;

  const filter = {
    _id: booking._id,
    status: "PENDING_PAYMENT",
    "seatLock.expiresAt": { $lte: new Date() },
    "payment.stripePaymentIntentId": expectedIntentId || null,
  };

  if (expectedPaymentStatus) {
    filter["payment.status"] = expectedPaymentStatus;
  }

  const result = await Booking.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "EXPIRED",
        paymentStatus: "failed",
        "payment.status": "FAILED",
        "payment.failureReason":
          "Unpaid seat hold expired; Stripe canceled or no payment was started.",
      },
    },
    { new: true, runValidators: true }
  );

  if (!result) return false;

  // Count a completed MongoDB state transition, not a polling iteration.
  bookingEventsTotal.inc({ event: "expired" });

  await releaseOldLock(result);

  // Do NOT delete BookedSeat records or $pull Show.bookedSeats.
  // Another confirmed booking may own the seat now.
  return true;
}

async function expirePendingBookings() {
  if (running) {
    return { checked: 0, expired: 0, skipped: true };
  }

  running = true;

  try {
    const pending = await Booking.find({
      status: "PENDING_PAYMENT",
      "seatLock.expiresAt": {
        $ne: null,
        $lte: new Date(),
      },
    })
      .select("_id user show seats status seatLock payment paymentStatus")
      .sort({ "seatLock.expiresAt": 1 })
      .limit(200)
      .lean();

    let expired = 0;

    for (const booking of pending) {
      try {
        if (await expireOne(booking)) expired++;
      } catch (error) {
        console.error(
          `[Booking Expiry] Error for ${booking._id}:`,
          error
        );
      }
    }

    if (expired) {
      console.log(
        `[Booking Expiry] Expired ${expired} verified unpaid booking(s).`
      );
    }

    return {
      checked: pending.length,
      expired,
      skipped: false,
    };
  } catch (error) {
    console.error("[Booking Expiry] Worker error:", error);

    return {
      checked: 0,
      expired: 0,
      skipped: false,
      error: error.message,
    };
  } finally {
    running = false;
  }
}

function startBookingExpiryWorker() {
  if (intervalHandle) return intervalHandle;

  console.log(
    `[Booking Expiry] Worker started (${INTERVAL_MS / 1000}s interval).`
  );

  initialHandle = setTimeout(() => {
    void expirePendingBookings();
  }, 3000);

  intervalHandle = setInterval(() => {
    void expirePendingBookings();
  }, INTERVAL_MS);

  initialHandle.unref?.();
  intervalHandle.unref?.();

  return intervalHandle;
}

function stopBookingExpiryWorker() {
  if (initialHandle) clearTimeout(initialHandle);
  if (intervalHandle) clearInterval(intervalHandle);

  initialHandle = null;
  intervalHandle = null;
}

module.exports = {
  expirePendingBookings,
  startBookingExpiryWorker,
  stopBookingExpiryWorker,
};
