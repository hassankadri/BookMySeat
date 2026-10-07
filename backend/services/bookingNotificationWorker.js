const Booking =
  require("../models/Booking");

const Show =
  require("../models/Show");

const NotificationLog =
  require("../models/NotificationLog");

const {
  sendBookingNotification,
} =
  require("../utils/bookingNotificationEmail");

// =====================================================
// SETTINGS
// =====================================================

const WORKER_INTERVAL_MS =
  Math.max(
    Number(
      process.env
        .NOTIFICATION_WORKER_INTERVAL_MS ||
        60000
    ),
    30000
  );

const SHOW_REMINDER_MINUTES =
  Math.max(
    Number(
      process.env
        .SHOW_REMINDER_MINUTES ||
        120
    ),
    15
  );

const STATUS_LOOKBACK_HOURS =
  Math.max(
    Number(
      process.env
        .NOTIFICATION_STATUS_LOOKBACK_HOURS ||
        24
    ),
    1
  );

const MAX_ATTEMPTS = 3;

let workerRunning =
  false;

let intervalHandle =
  null;

// =====================================================
// BOOKING CODE
// =====================================================

const getBookingCode =
  (booking) =>
    booking.bookingCode ||
    booking.bookingReference ||
    String(
      booking._id ||
        ""
    ).slice(-8);

// =====================================================
// BUILD EMAIL DATA
// =====================================================

const buildPayload =
  (
    booking,
    type
  ) => {
    const show =
      booking.show;

    const movie =
      booking.movie ||
      show?.movie;

    const user =
      booking.user;

    return {
      to:
        user?.email,

      type,

      name:
        user?.name ||
        "Moviegoer",

      movieTitle:
        movie?.title ||
        "your movie",

      bookingCode:
        getBookingCode(
          booking
        ),

      showTime:
        show?.startTime ||
        null,

      theatreName:
        show?.theatre
          ?.name ||
        "",

      screenName:
        show?.screen
          ?.name ||
        "",

      seats:
        booking.seats ||
        [],

      amount:
        booking.totalAmount ||
        0,

      reason:
        booking.cancellationReason ||
        booking.payment
          ?.failureReason ||
        "",
    };
  };

// =====================================================
// GET / CREATE LOG
// =====================================================

const getNotificationLog =
  async (
    booking,
    type
  ) => {
    let log =
      await NotificationLog.findOne({
        booking:
          booking._id,

        type,
      });

    if (log) {
      return log;
    }

    try {
      log =
        await NotificationLog.create({
          booking:
            booking._id,

          user:
            booking.user
              ?._id ||
            booking.user ||
            null,

          email:
            booking.user
              ?.email ||
            "",

          type,

          status:
            "PENDING",
        });

      return log;
    } catch (error) {
      /**
       * If another process created the unique
       * booking+type row first, simply reuse it.
       */
      if (
        error?.code ===
        11000
      ) {
        return NotificationLog.findOne({
          booking:
            booking._id,

          type,
        });
      }

      throw error;
    }
  };

// =====================================================
// SEND ONCE
// =====================================================

const sendOnce =
  async (
    booking,
    type
  ) => {
    const email =
      booking.user
        ?.email;

    if (!email) {
      return false;
    }

    const log =
      await getNotificationLog(
        booking,
        type
      );

    if (!log) {
      return false;
    }

    if (
      log.status ===
      "SENT"
    ) {
      return false;
    }

    if (
      log.attempts >=
      MAX_ATTEMPTS
    ) {
      return false;
    }

    log.status =
      "PENDING";

    log.attempts +=
      1;

    log.email =
      email;

    await log.save();

    try {
      await sendBookingNotification(
        buildPayload(
          booking,
          type
        )
      );

      log.status =
        "SENT";

      log.sentAt =
        new Date();

      log.lastError =
        "";

      await log.save();

      console.log(
        `[Notification] ${type} sent for booking ${getBookingCode(
          booking
        )}`
      );

      return true;
    } catch (error) {
      log.status =
        "FAILED";

      log.lastError =
        String(
          error.message ||
            error
        ).slice(
          0,
          1000
        );

      await log.save();

      console.error(
        `[Notification] ${type} failed for booking ${booking._id}:`,
        error.message
      );

      return false;
    }
  };

// =====================================================
// POPULATE QUERY
// =====================================================

const populateBooking =
  (query) =>
    query

      .populate(
        "user",
        "name email"
      )

      .populate(
        "movie",
        "title poster"
      )

      .populate({
        path:
          "show",

        select:
          "startTime endTime language format theatre screen movie status",

        populate: [
          {
            path:
              "movie",

            select:
              "title poster",
          },

          {
            path:
              "theatre",

            select:
              "name city address",
          },

          {
            path:
              "screen",

            select:
              "name screenNumber format",
          },
        ],
      });

// =====================================================
// STATUS EMAILS
// =====================================================

const processStatusNotifications =
  async () => {
    const lookback =
      new Date(
        Date.now() -
          STATUS_LOOKBACK_HOURS *
            60 *
            60 *
            1000
      );

    const bookings =
      await populateBooking(
        Booking.find({
          status: {
            $in: [
              "CANCELLED",
              "REFUND_PENDING",
              "REFUNDED",
              "PAYMENT_FAILED",
            ],
          },

          updatedAt: {
            $gte:
              lookback,
          },
        })

          .sort({
            updatedAt: -1,
          })

          .limit(200)
      );

    for (
      const booking
      of bookings
    ) {
      let type =
        null;

      switch (
        booking.status
      ) {
        case "CANCELLED":
          type =
            "CANCELLATION";

          break;

        case "REFUND_PENDING":
          type =
            "REFUND_PENDING";

          break;

        case "REFUNDED":
          type =
            "REFUND_COMPLETED";

          break;

        case "PAYMENT_FAILED":
          type =
            "PAYMENT_FAILED";

          break;

        default:
          break;
      }

      if (type) {
        await sendOnce(
          booking,
          type
        );
      }
    }
  };

// =====================================================
// UPCOMING SHOW REMINDERS
// =====================================================

const processShowReminders =
  async () => {
    const now =
      new Date();

    const latestReminderTime =
      new Date(
        now.getTime() +
          SHOW_REMINDER_MINUTES *
            60 *
            1000
      );

    /**
     * Find shows starting during our reminder window.
     *
     * Example with SHOW_REMINDER_MINUTES=120:
     *
     * any confirmed booking whose show starts within
     * the next two hours becomes eligible.
     *
     * NotificationLog ensures it is only sent once.
     */
    const shows =
      await Show.find({
        status:
          "SCHEDULED",

        isActive: {
          $ne: false,
        },

        startTime: {
          $gt: now,

          $lte:
            latestReminderTime,
        },
      })

        .select(
          "_id"
        )

        .lean();

    if (
      shows.length ===
      0
    ) {
      return;
    }

    const showIds =
      shows.map(
        (show) =>
          show._id
      );

    const bookings =
      await populateBooking(
        Booking.find({
          status:
            "CONFIRMED",

          show: {
            $in:
              showIds,
          },

          ticketUsed: {
            $ne: true,
          },
        })

          .sort({
            createdAt: 1,
          })

          .limit(500)
      );

    for (
      const booking
      of bookings
    ) {
      await sendOnce(
        booking,
        "SHOW_REMINDER"
      );
    }
  };

// =====================================================
// RUN WORKER
// =====================================================

const runNotificationWorker =
  async () => {
    if (
      workerRunning
    ) {
      return;
    }

    workerRunning =
      true;

    try {
      await processStatusNotifications();

      await processShowReminders();
    } catch (error) {
      console.error(
        "Notification worker:",
        error
      );
    } finally {
      workerRunning =
        false;
    }
  };

// =====================================================
// START
// =====================================================

const startBookingNotificationWorker =
  () => {
    if (
      intervalHandle
    ) {
      return intervalHandle;
    }

    console.log(
      `[Notification] Worker started (${WORKER_INTERVAL_MS / 1000}s interval, ${SHOW_REMINDER_MINUTES}m reminder).`
    );

    // Initial run shortly after backend starts.
    setTimeout(
      () => {
        runNotificationWorker();
      },
      5000
    );

    intervalHandle =
      setInterval(
        () => {
          runNotificationWorker();
        },
        WORKER_INTERVAL_MS
      );

    if (
      typeof intervalHandle.unref ===
      "function"
    ) {
      intervalHandle.unref();
    }

    return intervalHandle;
  };

// =====================================================
// STOP
// =====================================================

const stopBookingNotificationWorker =
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
  runNotificationWorker,
  startBookingNotificationWorker,
  stopBookingNotificationWorker,
};