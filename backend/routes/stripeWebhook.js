
const express = require("express");
const crypto = require("crypto");

const Booking = require("../models/Booking");
const BookedSeat = require("../models/BookedSeat");
const Show = require("../models/Show");

const {
  verifySeatLocks,
  releaseSeats,
} = require("../services/seatLockService");

const {
  constructWebhookEvent,
  refundPaymentIntent,
} = require("../utils/stripe");

const {
  sendBookingConfirmation,
} = require("../utils/email");

const {
  emitToShow,
} = require("../config/socket");

const {
  bookingEventsTotal,
  paymentEventsTotal,
} = require("../config/metrics");

const router = express.Router();

// =====================================================
// HELPERS
// =====================================================

const formatTheatreAddress = (address) => {
  if (!address) {
    return "";
  }

  if (typeof address === "object") {
    return [
      address.street,
      address.area,
      address.city,
      address.state,
      address.postalCode,
    ]
      .filter(Boolean)
      .join(", ");
  }

  return String(address);
};

// =====================================================
// RELEASE REDIS LOCK SAFELY
// =====================================================

const releaseBookingLock = async (booking) => {
  const lockId = booking.seatLock?.lockId;

  if (!lockId) {
    return {
      success: true,
      released: 0,
      releasedSeats: [],
    };
  }

  try {
    return await releaseSeats({
      showId: booking.show?._id || booking.show,
      seatIds: booking.seats,
      userId: booking.user?._id || booking.user,
      lockId,
    });
  } catch (error) {
    /**
     * Redis cleanup failures must not invalidate
     * an otherwise valid paid booking.
     * Redis TTL remains the final cleanup mechanism.
     */
    console.error(
      "Failed to release Redis seats:",
      error
    );

    return {
      success: false,
      released: 0,
      releasedSeats: [],
    };
  }
};

const broadcastReleasedSeats = (
  booking,
  releaseResult
) => {
  if (!releaseResult?.releasedSeats?.length) {
    return;
  }

  emitToShow(
    booking.show?._id || booking.show,
    "seats:released",
    {
      seatIds: releaseResult.releasedSeats,
    }
  );
};

const broadcastBookedSeats = (booking) => {
  emitToShow(
    booking.show?._id || booking.show,
    "seats:booked",
    {
      seatIds: booking.seats,
    }
  );
};

// =====================================================
// REFUND UNSAFE PAYMENT
// =====================================================

const refundUnsafeBooking = async ({
  booking,
  paymentIntent,
  reason,
  eventId,
}) => {
  booking.status = "REFUND_PENDING";
  booking.paymentStatus = "refund_pending";
  booking.payment.status = "REFUND_PENDING";
  booking.payment.failureReason = reason;
  booking.payment.lastStripeEventId = eventId;

  await booking.save();

  try {
    const refund = await refundPaymentIntent({
      paymentIntentId: paymentIntent.id,
      bookingId: booking._id,
    });

    booking.status = "REFUNDED";
    booking.paymentStatus = "refunded";
    booking.payment.status = "REFUNDED";
    booking.payment.stripeRefundId = refund.id;
    booking.payment.refundedAt = new Date();

    await booking.save();

    // FEATURE 10: Count a completed refund, not the request.
    bookingEventsTotal.inc({
      event: "refunded",
    });

    paymentEventsTotal.inc({
      event: "refunded",
    });

    const releaseResult = await releaseBookingLock(
      booking
    );

    // Only broadcast seats actually released by Redis.
    broadcastReleasedSeats(
      booking,
      releaseResult
    );

    return true;
  } catch (refundError) {
    /**
     * Keep REFUND_PENDING when a refund fails.
     * Do not release seats while payment remains uncertain.
     */
    console.error(
      "Automatic Stripe refund failed:",
      refundError
    );

    return false;
  }
};

// =====================================================
// PAYMENT SUCCEEDED
// =====================================================

const handlePaymentSucceeded = async (
  paymentIntent,
  eventId
) => {
  const bookingId =
    paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    console.error(
      "Stripe PaymentIntent missing bookingId metadata:",
      paymentIntent.id
    );
    return;
  }

  const booking = await Booking.findById(bookingId)
    .populate("user")
    .populate("movie")
    .populate({
      path: "show",
      populate: [
        { path: "movie" },
        { path: "theatre" },
        { path: "screen" },
      ],
    });

  if (!booking) {
    console.error(
      "Webhook booking not found:",
      bookingId
    );
    return;
  }

  // -----------------------------------------------
  // IDEMPOTENT CONFIRMED RETRY
  // -----------------------------------------------

  if (booking.status === "CONFIRMED") {
    await Show.updateOne(
      { _id: booking.show._id },
      {
        $addToSet: {
          bookedSeats: {
            $each: booking.seats,
          },
        },
      }
    );

    // Re-broadcasting repairs missed real-time updates.
    // Do not increment confirmation counters on retry.
    broadcastBookedSeats(booking);

    return;
  }

  if (booking.status === "REFUNDED") {
    return;
  }

  // -----------------------------------------------
  // VERIFY PAYMENT INTENT
  // -----------------------------------------------

  const expectedIntentId =
    booking.payment?.stripePaymentIntentId;

  if (
    expectedIntentId &&
    expectedIntentId !== paymentIntent.id
  ) {
    console.error(
      "Stripe PaymentIntent ID mismatch:",
      {
        bookingId: booking._id,
        expected: expectedIntentId,
        received: paymentIntent.id,
      }
    );

    return;
  }

  // -----------------------------------------------
  // VERIFY AMOUNT AND CURRENCY
  // -----------------------------------------------

  const expectedAmount = Math.round(
    Number(booking.totalAmount) * 100
  );

  const receivedAmount =
    paymentIntent.amount_received;

  const receivedCurrency = String(
    paymentIntent.currency || ""
  ).toLowerCase();

  if (
    receivedAmount !== expectedAmount ||
    receivedCurrency !== "inr"
  ) {
    await refundUnsafeBooking({
      booking,
      paymentIntent,
      eventId,
      reason:
        "Stripe payment amount or currency did not match the booking.",
    });

    return;
  }

  // -----------------------------------------------
  // VERIFY REDIS LOCK
  // -----------------------------------------------

  const lockVerification = await verifySeatLocks({
    showId: booking.show._id,
    seatIds: booking.seats,
    userId: booking.user._id,
    lockId: booking.seatLock?.lockId,
  });

  if (!lockVerification.valid) {
    await refundUnsafeBooking({
      booking,
      paymentIntent,
      eventId,
      reason:
        `Seat lock expired or changed before payment confirmation. Seat: ${
          lockVerification.seatId || "unknown"
        }`,
    });

    return;
  }

  // -----------------------------------------------
  // PERMANENT BOOKED SEATS
  // -----------------------------------------------

  try {
    await BookedSeat.bulkWrite(
      booking.seats.map((seatId) => ({
        updateOne: {
          /**
           * Repeated webhook:
           * Same booking is safe to retry.
           *
           * Different booking:
           * Unique show + seatId index prevents
           * selling the same seat twice.
           */
          filter: {
            show: booking.show._id,
            seatId,
            booking: booking._id,
          },
          update: {
            $setOnInsert: {
              show: booking.show._id,
              seatId,
              booking: booking._id,
              user: booking.user._id,
            },
          },
          upsert: true,
        },
      })),
      { ordered: true }
    );
  } catch (seatError) {
    /**
     * Ordered bulkWrite may have inserted some rows
     * before hitting a unique-index conflict.
     * Remove only rows belonging to this booking.
     */
    await BookedSeat.deleteMany({
      booking: booking._id,
    });

    if (seatError?.code === 11000) {
      await refundUnsafeBooking({
        booking,
        paymentIntent,
        eventId,
        reason:
          "A permanent seat conflict occurred while confirming the booking.",
      });

      return;
    }

    throw seatError;
  }

  // -----------------------------------------------
  // CONFIRM BOOKING
  // -----------------------------------------------

  booking.status = "CONFIRMED";
  booking.paymentStatus = "completed";
  booking.paymentId = paymentIntent.id;
  booking.payment.status = "PAID";

  booking.payment.stripePaymentIntentId =
    paymentIntent.id;

  booking.payment.amount =
    booking.totalAmount;

  booking.payment.currency = "INR";
  booking.payment.paidAt = new Date();
  booking.payment.lastStripeEventId = eventId;

  if (!booking.qrToken) {
    booking.qrToken = crypto
      .randomBytes(32)
      .toString("hex");
  }

  await booking.save();

  // FEATURE 10: Count the confirmed booking transition.
  bookingEventsTotal.inc({
    event: "confirmed",
  });

  paymentEventsTotal.inc({
    event: "payment_confirmed",
  });

  // -----------------------------------------------
  // LEGACY bookedSeats SYNC
  // -----------------------------------------------

  await Show.updateOne(
    { _id: booking.show._id },
    {
      $addToSet: {
        bookedSeats: {
          $each: booking.seats,
        },
      },
    }
  );

  // -----------------------------------------------
  // RELEASE TEMPORARY REDIS LOCK
  // -----------------------------------------------

  await releaseBookingLock(booking);

  // Permanent MongoDB booking is now authoritative.
  broadcastBookedSeats(booking);

  // -----------------------------------------------
  // CONFIRMATION EMAIL
  // -----------------------------------------------

  if (
    !booking.notifications?.confirmationEmailSentAt
  ) {
    try {
      const show = booking.show;

      const movie =
        booking.movie || show.movie;

      const showTime = show.startTime
        ? new Date(show.startTime)
        : null;

      await sendBookingConfirmation({
        email: booking.user.email,
        name: booking.user.name,
        bookingReference:
          booking.bookingReference,
        movieTitle:
          movie?.title || "Movie",
        movieRating:
          movie?.rating || "",

        showDate: showTime
          ? showTime.toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "",

        showTime: showTime
          ? showTime.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",

        seats: booking.seats,
        totalAmount: booking.totalAmount,

        theaterName:
          show.theatre?.name ||
          "BookMySeat Cinema",

        theaterAddress:
          formatTheatreAddress(
            show.theatre?.address
          ),
      });

      booking.notifications.confirmationEmailSentAt =
        new Date();

      await booking.save();
    } catch (emailError) {
      /**
       * Email failure must not invalidate
       * an already-paid booking.
       */
      console.error(
        "Confirmation email failed:",
        emailError
      );
    }
  }
};

// =====================================================
// PAYMENT FAILED
// =====================================================

const handlePaymentFailed = async (
  paymentIntent,
  eventId
) => {
  const bookingId =
    paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    return;
  }

  const booking =
    await Booking.findById(bookingId);

  if (!booking) {
    return;
  }

  // Never allow late failure events to overwrite
  // confirmed, expired or refunded bookings.
  const protectedStatuses = [
    "CONFIRMED",
    "CANCELLED",
    "EXPIRED",
    "REFUND_PENDING",
    "REFUNDED",
  ];

  if (protectedStatuses.includes(booking.status)) {
    return;
  }

  // Stripe may retry the same webhook.
  if (booking.status === "PAYMENT_FAILED") {
    if (booking.payment) {
      booking.payment.lastStripeEventId = eventId;
      await booking.save();
    }

    return;
  }

  booking.status = "PAYMENT_FAILED";
  booking.paymentStatus = "failed";

  if (!booking.payment) {
    booking.payment = {};
  }

  booking.payment.status = "FAILED";
  booking.payment.failureReason =
    paymentIntent.last_payment_error?.message ||
    "Stripe payment failed.";

  booking.payment.lastStripeEventId = eventId;

  await booking.save();

  // FEATURE 10: Count only the new failed state.
  bookingEventsTotal.inc({
    event: "payment_failed",
  });

  paymentEventsTotal.inc({
    event: "payment_failed",
  });

  // Failed payments stop blocking seats.
  await releaseBookingLock(booking);
};

// =====================================================
// STRIPE WEBHOOK
// POST /api/webhooks/stripe
// =====================================================

router.post("/", async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res
      .status(400)
      .send("Missing Stripe signature.");
  }

  let event;

  try {
    /**
     * req.body must remain the original raw Buffer.
     * Signature verification is not optional.
     */
    event = constructWebhookEvent({
      rawBody: req.body,
      signature,
    });
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed:",
      error.message
    );

    return res
      .status(400)
      .send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(
          event.data.object,
          event.id
        );
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(
          event.data.object,
          event.id
        );
        break;

      default:
        // Unhandled Stripe events are not errors.
        break;
    }

    return res.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Stripe webhook processing failed:",
      error
    );

    // HTTP 500 instructs Stripe to retry.
    return res.status(500).json({
      received: false,
      error: "Webhook processing failed.",
    });
  }
});

module.exports = router;
