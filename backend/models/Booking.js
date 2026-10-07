const mongoose = require("mongoose");
const crypto = require("crypto");

// =====================================================
// INDIVIDUAL SEAT SNAPSHOT
// =====================================================

/**
 * Store the seat type and price at the moment of booking.
 *
 * Example:
 *
 * Today:
 * Premium = ₹400
 *
 * Later:
 * Premium = ₹500
 *
 * The old ticket must still show ₹400.
 */
const seatDetailSchema = new mongoose.Schema(
  {
    seatId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "REGULAR",
        "PREMIUM",
        "RECLINER",
        "LOUNGER",
        "WHEELCHAIR",
      ],
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// BOOKING MODEL
// =====================================================

const bookingSchema = new mongoose.Schema(
  {
    // Human-friendly booking ID.
    // Example: BMS-8F4A92C1
    bookingCode: {
      type: String,
      unique: true,
      index: true,
    },

    /**
     * LEGACY COMPATIBILITY
     *
     * Old frontend still expects bookingReference.
     */
    bookingReference: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    show: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Show",
      required: true,
      index: true,
    },

    /**
     * LEGACY COMPATIBILITY
     *
     * V2 can reach Movie through Show,
     * but old frontend expects booking.movie.
     */
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      default: null,
      index: true,
    },

    // Simple list used throughout booking logic.
    seats: {
      type: [String],
      required: true,
      default: [],
    },

    // Detailed V2 seat snapshot.
    seatDetails: {
      type: [seatDetailSchema],
      default: [],
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    // =================================================
    // BOOKING STATUS
    // =================================================

    /**
     * Normal successful flow:
     *
     * PENDING_PAYMENT
     *        ↓
     * CONFIRMED
     *
     * Problem flow:
     *
     * PENDING_PAYMENT
     *        ↓
     * PAYMENT_FAILED
     *
     * Rare race condition:
     *
     * payment succeeds
     *        ↓
     * seat cannot safely be confirmed
     *        ↓
     * REFUND_PENDING
     *        ↓
     * REFUNDED
     */
    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "CONFIRMED",
        "PAYMENT_FAILED",
        "EXPIRED",
        "CANCELLED",
        "REFUND_PENDING",
        "REFUNDED",
      ],
      default: "PENDING_PAYMENT",
      index: true,
    },

    // =================================================
    // LEGACY PAYMENT FIELDS
    // =================================================

    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "completed",
        "failed",
        "refund_pending",
        "refunded",
      ],
      default: "pending",
      index: true,
    },

    sessionId: {
      type: String,
      default: null,
      index: true,
    },

    paymentId: {
      type: String,
      default: null,
    },

    // =================================================
    // REDIS SEAT LOCK
    // =================================================

    seatLock: {
      lockId: {
        type: String,
        default: null,
      },

      expiresAt: {
        type: Date,
        default: null,
      },
    },

    // =================================================
    // STRIPE PAYMENT
    // =================================================

    payment: {
      provider: {
        type: String,
        enum: ["STRIPE"],
        default: "STRIPE",
      },

      status: {
        type: String,
        enum: [
          "NOT_STARTED",
          "PENDING",
          "PAID",
          "FAILED",
          "REFUND_PENDING",
          "REFUNDED",
        ],
        default: "NOT_STARTED",
      },

      stripeCheckoutSessionId: {
        type: String,
        default: null,
        index: true,
      },

      stripePaymentIntentId: {
        type: String,
        default: null,
        index: true,
      },

      stripeRefundId: {
        type: String,
        default: null,
        index: true,
      },

      /**
       * Stripe retries webhooks if our server is temporarily
       * unavailable.
       *
       * Keeping the latest event ID helps us understand/debug
       * which Stripe event updated this booking.
       */
      lastStripeEventId: {
        type: String,
        default: null,
      },

      amount: {
        type: Number,
        default: 0,
        min: 0,
      },

      currency: {
        type: String,
        default: "INR",
        uppercase: true,
      },

      paidAt: {
        type: Date,
        default: null,
      },

      refundedAt: {
        type: Date,
        default: null,
      },

      failureReason: {
        type: String,
        default: "",
      },
    },

    // =================================================
    // QR TICKET
    // =================================================

    /**
     * QR will contain this random token instead of exposing
     * MongoDB booking IDs.
     */
    qrToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    ticketUsed: {
      type: Boolean,
      default: false,
    },

    ticketUsedAt: {
      type: Date,
      default: null,
    },

    // =================================================
    // NOTIFICATIONS
    // =================================================

    notifications: {
      /**
       * Prevent confirmation emails being sent repeatedly
       * if Stripe retries the webhook.
       */
      confirmationEmailSentAt: {
        type: Date,
        default: null,
      },
    },

    // =================================================
    // CANCELLATION
    // =================================================

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Common query: user's latest bookings.
bookingSchema.index({
  user: 1,
  createdAt: -1,
});

// Useful for admin analytics.
bookingSchema.index({
  show: 1,
  status: 1,
});

// =====================================================
// BOOKING CODE
// =====================================================

bookingSchema.pre(
  "validate",
  function (next) {
    /**
     * If an old booking already has bookingReference,
     * reuse it as bookingCode.
     */
    if (
      !this.bookingCode &&
      this.bookingReference
    ) {
      this.bookingCode =
        this.bookingReference;
    }

    if (!this.bookingCode) {
      const randomCode =
        crypto
          .randomBytes(4)
          .toString("hex")
          .toUpperCase();

      this.bookingCode =
        `BMS-${randomCode}`;
    }

    // Keep old + new names synchronized.
    this.bookingReference =
      this.bookingCode;

    next();
  }
);

module.exports =
  mongoose.model(
    "Booking",
    bookingSchema
  );