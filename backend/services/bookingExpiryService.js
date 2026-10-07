const Booking =
  require("../models/Booking");

const BookedSeat =
  require("../models/BookedSeat");

const Show =
  require("../models/Show");

const {
  releaseSeats,
} =
  require("./seatLockService");

// How often the backend checks stale bookings.
//
// 30 seconds is fast enough for cleanup while
// avoiding unnecessary database traffic.
const EXPIRY_CHECK_INTERVAL_MS =
  Math.max(
    Number(
      process.env
        .BOOKING_EXPIRY_CHECK_INTERVAL_MS ||
        30000
    ),
    10000
  );

// Prevent two cleanup runs from overlapping.
let cleanupRunning =
  false;

let intervalHandle =
  null;

// =====================================================
// RELEASE REDIS LOCK
// =====================================================

const releaseRedisLock =
  async (
    booking
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
          booking.show,

        seatIds:
          booking.seats ||
          [],

        userId:
          booking.user,

        lockId,
      });
    } catch (error) {
      /**
       * Do not fail the expiry process because
       * Redis cleanup failed.
       *
       * Redis seat locks also have TTL, so the
       * lock will disappear automatically.
       */
      console.error(
        "Expired booking Redis cleanup:",
        error.message
      );
    }
  };

// =====================================================
// DEFENSIVE DATABASE CLEANUP
// =====================================================

const releasePermanentSeats =
  async (
    booking
  ) => {
    try {
      /**
       * A PENDING_PAYMENT booking should never have
       * permanent BookedSeat records.
       *
       * This cleanup exists as protection against
       * old/legacy inconsistent data.
       */
      await BookedSeat.deleteMany({
        booking:
          booking._id,
      });

      if (
        booking.show &&
        Array.isArray(
          booking.seats
        ) &&
        booking.seats.length
      ) {
        await Show.updateOne(
          {
            _id:
              booking.show,
          },

          {
            $pull: {
              bookedSeats: {
                $in:
                  booking.seats,
              },
            },
          }
        );
      }
    } catch (error) {
      console.error(
        "Expired booking DB seat cleanup:",
        error.message
      );
    }
  };

// =====================================================
// EXPIRE ONE BOOKING SAFELY
// =====================================================

const expireBooking =
  async (
    booking
  ) => {
    /**
     * IMPORTANT:
     *
     * We update with status=PENDING_PAYMENT in the
     * MongoDB filter.
     *
     * This makes the operation atomic.
     *
     * If the Stripe webhook confirms the booking
     * one millisecond before this worker runs,
     * this update no longer matches and therefore
     * cannot overwrite CONFIRMED.
     */
    const expired =
      await Booking.findOneAndUpdate(
        {
          _id:
            booking._id,

          status:
            "PENDING_PAYMENT",

          "seatLock.expiresAt": {
            $lte:
              new Date(),
          },
        },

        {
          $set: {
            status:
              "EXPIRED",

            paymentStatus:
              "expired",

            "payment.status":
              "EXPIRED",

            "payment.failureReason":
              "Seat reservation expired before payment was completed.",
          },
        },

        {
          new: true,
        }
      );

    // Another process changed the booking first.
    if (!expired) {
      return false;
    }

    await releaseRedisLock(
      expired
    );

    await releasePermanentSeats(
      expired
    );

    return true;
  };

// =====================================================
// CLEANUP JOB
// =====================================================

const expirePendingBookings =
  async () => {
    if (cleanupRunning) {
      return {
        checked: 0,
        expired: 0,
        skipped: true,
      };
    }

    cleanupRunning =
      true;

    try {
      const now =
        new Date();

      /**
       * Process in batches so a very large database
       * does not get loaded into memory at once.
       */
      const bookings =
        await Booking.find({
          status:
            "PENDING_PAYMENT",

          "seatLock.expiresAt": {
            $exists: true,
            $ne: null,
            $lte: now,
          },
        })

          .select(
            "_id user show seats status seatLock payment paymentStatus"
          )

          .limit(200)

          .lean();

      let expiredCount =
        0;

      for (
        const booking
        of bookings
      ) {
        try {
          const changed =
            await expireBooking(
              booking
            );

          if (changed) {
            expiredCount +=
              1;
          }
        } catch (error) {
          console.error(
            `Failed to expire booking ${booking._id}:`,
            error
          );
        }
      }

      if (
        expiredCount > 0
      ) {
        console.log(
          `[Booking Expiry] Expired ${expiredCount} abandoned booking(s).`
        );
      }

      return {
        checked:
          bookings.length,

        expired:
          expiredCount,

        skipped:
          false,
      };
    } catch (error) {
      console.error(
        "Booking expiry worker:",
        error
      );

      return {
        checked: 0,
        expired: 0,
        skipped: false,
        error:
          error.message,
      };
    } finally {
      cleanupRunning =
        false;
    }
  };

// =====================================================
// START WORKER
// =====================================================

const startBookingExpiryWorker =
  () => {
    // Prevent duplicate workers during hot reload.
    if (
      intervalHandle
    ) {
      return intervalHandle;
    }

    console.log(
      `[Booking Expiry] Worker started (${EXPIRY_CHECK_INTERVAL_MS / 1000}s interval).`
    );

    /**
     * Run once shortly after startup instead of
     * waiting for the first interval.
     */
    setTimeout(
      () => {
        expirePendingBookings();
      },
      3000
    );

    intervalHandle =
      setInterval(
        () => {
          expirePendingBookings();
        },
        EXPIRY_CHECK_INTERVAL_MS
      );

    /**
     * Do not keep Node alive only because this timer
     * still exists during shutdown.
     */
    if (
      typeof intervalHandle.unref ===
      "function"
    ) {
      intervalHandle.unref();
    }

    return intervalHandle;
  };

// =====================================================
// STOP WORKER
// =====================================================

const stopBookingExpiryWorker =
  () => {
    if (
      !intervalHandle
    ) {
      return;
    }

    clearInterval(
      intervalHandle
    );

    intervalHandle =
      null;
  };

module.exports = {
  expirePendingBookings,
  startBookingExpiryWorker,
  stopBookingExpiryWorker,
};