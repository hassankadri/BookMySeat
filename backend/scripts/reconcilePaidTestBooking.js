
"use strict";

// One-time recovery for the existing successful TEST payment.
//
// Default: READ-ONLY.
//
// --apply must be explicitly provided to change MongoDB.
//
// This script does not charge or refund a card.

require("dotenv").config();

const crypto = require("crypto");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const BookedSeat = require("../models/BookedSeat");
const Show = require("../models/Show");

const { getStripe } = require("../utils/stripe");

const {
  getLockedSeats,
  lockSeats,
  verifySeatLocks,
  releaseSeats,
} = require("../services/seatLockService");

const BOOKING_ID = "6acf387b574b73e67e1f5c4f";
const INTENT_ID = "pi_3UQNEhRzk7Bu17iF1wsLeUiE";
const EXPECTED_BOOKING_CODE = "BMS-B8788249";

const APPLY = process.argv.includes("--apply");

const norm = (values) =>
  [
    ...new Set(
      values.map((x) =>
        String(x).trim().toUpperCase()
      )
    ),
  ].sort();

const same = (a, b) =>
  JSON.stringify(norm(a)) === JSON.stringify(norm(b));

async function main() {
  if (!process.env.MONGO_URL || !process.env.DB_NAME) {
    throw new Error("MongoDB environment is missing");
  }

  const dbUri =
    `${process.env.MONGO_URL.replace(/\/$/, "")}/` +
    process.env.DB_NAME;

  await mongoose.connect(dbUri, {
    serverSelectionTimeoutMS: 10000,
  });

  const booking = await Booking.findById(BOOKING_ID).lean();

  if (!booking) throw new Error("Booking not found");

  if (booking.bookingCode !== EXPECTED_BOOKING_CODE) {
    throw new Error("Unexpected bookingCode");
  }

  if (booking.status !== "EXPIRED") {
    throw new Error(
      `Booking is ${booking.status}; refusing recovery`
    );
  }

  if (
    booking.payment?.stripePaymentIntentId !== INTENT_ID
  ) {
    throw new Error(
      "PaymentIntent does not match booking"
    );
  }

  if (!booking.seats?.length || booking.qrToken) {
    throw new Error("Invalid expired booking state");
  }

  const stripe = getStripe();

  const intent =
    await stripe.paymentIntents.retrieve(INTENT_ID);

  const refunds = await stripe.refunds.list({
    payment_intent: INTENT_ID,
    limit: 100,
  });

  if (
    intent.livemode ||
    intent.status !== "succeeded"
  ) {
    throw new Error(
      "Payment is not a succeeded TEST payment"
    );
  }

  if (
    refunds.data.length ||
    intent.amount_refunded > 0
  ) {
    throw new Error(
      "Payment has a refund; refusing to issue ticket"
    );
  }

  if (
    intent.metadata?.bookingId !== BOOKING_ID ||
    intent.metadata?.bookingCode !== EXPECTED_BOOKING_CODE
  ) {
    throw new Error(
      "Payment metadata booking identity mismatch"
    );
  }

  if (
    intent.metadata?.showId !== String(booking.show) ||
    intent.metadata?.userId !== String(booking.user) ||
    !same(
      String(intent.metadata?.seatIds || "").split(","),
      booking.seats
    )
  ) {
    throw new Error(
      "Payment metadata show/user/seats mismatch"
    );
  }

  if (
    intent.amount_received !==
      Math.round(booking.totalAmount * 100) ||
    intent.currency !== "inr"
  ) {
    throw new Error("Stripe amount or currency mismatch");
  }

  const show = await Show.findById(booking.show).lean();

  if (
    !show ||
    show.status !== "SCHEDULED" ||
    show.isActive === false ||
    new Date(show.startTime).getTime() <= Date.now()
  ) {
    throw new Error(
      "Show unavailable or already started; do not issue a late ticket"
    );
  }

  const ids = norm(booking.seats);

  // Require the permanent database uniqueness constraint.
  const indexList = await BookedSeat.collection.indexes();

  if (
    !indexList.some(
      (index) =>
        index.unique &&
        index.key?.show === 1 &&
        index.key?.seatId === 1
    )
  ) {
    throw new Error(
      "MongoDB unique show/seatId index missing; refusing recovery"
    );
  }

  async function checkConflicts() {
    const permanent = await BookedSeat.find({
      show: booking.show,
      seatId: { $in: ids },
    }).lean();

    if (permanent.length) {
      throw new Error(
        `Permanent seat record exists: ${permanent
          .map((x) => x.seatId)
          .join(", ")}`
      );
    }

    if (
      ids.some((id) =>
        (show.bookedSeats || [])
          .map((s) => String(s).toUpperCase())
          .includes(id)
      )
    ) {
      throw new Error(
        "Show.bookedSeats already contains a requested seat"
      );
    }

    const other = await Booking.exists({
      _id: { $ne: booking._id },
      show: booking.show,
      status: "CONFIRMED",
      seats: { $in: ids },
    });

    if (other) {
      throw new Error(
        "Another confirmed booking owns a requested seat"
      );
    }
  }

  await checkConflicts();

  const currentlyLocked = await getLockedSeats({
    showId: booking.show,
    seatIds: ids,
  });

  if (currentlyLocked.length) {
    throw new Error(
      "Seat currently held in Redis; recovery postponed"
    );
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "APPLY" : "DRY_RUN",
        bookingCode: booking.bookingCode,
        bookingStatus: booking.status,
        payment: intent.status,
        testMode: !intent.livemode,
        amountINR: intent.amount_received / 100,
        show: String(booking.show),
        seats: ids,
        startTime: show.startTime,
        permanentConflicts: 0,
        redisHolds: 0,
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log(
      "DRY RUN ONLY. No changes made. Review this output before --apply."
    );
    return;
  }

  // Reacquire the seat. Redis prevents claiming a seat
  // currently held by another customer.
  const lock = await lockSeats({
    showId: booking.show,
    seatIds: ids,
    userId: booking.user,
  });

  if (!lock.success) {
    throw new Error(
      `Cannot reacquire seat: ${lock.message}`
    );
  }

  const inserted = [];
  let confirmed = false;

  try {
    await checkConflicts();

    const verified = await verifySeatLocks({
      showId: booking.show,
      seatIds: ids,
      userId: booking.user,
      lockId: lock.lockId,
    });

    if (!verified.valid) {
      throw new Error(
        "Recovery lock verification failed"
      );
    }

    // Unique MongoDB index blocks duplicate permanent seats.
    for (const seatId of ids) {
      const record = await BookedSeat.create({
        show: booking.show,
        seatId,
        booking: booking._id,
        user: booking.user,
      });

      inserted.push(record._id);
    }

    const saved = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        status: "EXPIRED",
        "payment.stripePaymentIntentId": INTENT_ID,
      },
      {
        $set: {
          status: "CONFIRMED",
          paymentStatus: "completed",
          paymentId: INTENT_ID,
          "payment.status": "PAID",
          "payment.paidAt":
            new Date(intent.created * 1000),
          "payment.failureReason": "",
          qrToken:
            crypto.randomBytes(32).toString("hex"),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!saved) {
      throw new Error(
        "Booking changed during recovery; refusing confirmation"
      );
    }

    confirmed = true;

    const sync = await Show.updateOne(
      { _id: booking.show },
      {
        $addToSet: {
          bookedSeats: { $each: ids },
        },
      }
    );

    if (!sync.matchedCount) {
      console.error(
        "WARNING: Show.bookedSeats sync failed; manual repair required."
      );
    }

    console.log(
      "RECOVERED. Booking CONFIRMED; QR generated. Verify My Bookings."
    );
  } catch (error) {
    // Roll back only seat records created by this script
    // if confirmation did not succeed.
    if (!confirmed && inserted.length) {
      await BookedSeat.deleteMany({
        _id: { $in: inserted },
        booking: booking._id,
      });
    }

    throw error;
  } finally {
    await releaseSeats({
      showId: booking.show,
      seatIds: ids,
      userId: booking.user,
      lockId: lock.lockId,
    });
  }
}

main()
  .catch((error) => {
    console.error(
      "RECOVERY BLOCKED:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
