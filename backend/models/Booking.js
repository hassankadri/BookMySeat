
const mongoose = require("mongoose");
const crypto = require("crypto");

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
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      unique: true,
      index: true,
    },
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
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      default: null,
      index: true,
    },
    seats: {
      type: [String],
      required: true,
      default: [],
    },
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

    // BOOKING STATUS
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

    // LEGACY PAYMENT FIELDS
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

    // REDIS SEAT HOLD
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

    // STRIPE PAYMENT
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

    // QR TICKET
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

    // NOTIFICATIONS
    notifications: {
      confirmationEmailSentAt: {
        type: Date,
        default: null,
      },
    },

    // NEW: CUSTOMER REFUND REQUEST + ADMIN APPROVAL
    refundRequest: {
      requestedAt: {
        type: Date,
        default: null,
      },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      status: {
        type: String,
        enum: [
          "REQUESTED",
          "APPROVED",
          "PROCESSING",
          "SUCCEEDED",
          "FAILED",
          null,
        ],
        default: null,
      },
      seatReleasedAt: {
        type: Date,
        default: null,
      },
      approvedAt: {
        type: Date,
        default: null,
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      lastError: {
        type: String,
        default: "",
      },
    },

    // CANCELLATION
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
  { timestamps: true }
);

bookingSchema.index({
  user: 1,
  createdAt: -1,
});

bookingSchema.index({
  show: 1,
  status: 1,
});

bookingSchema.pre("validate", function (next) {
  if (!this.bookingCode && this.bookingReference) {
    this.bookingCode = this.bookingReference;
  }

  if (!this.bookingCode) {
    const randomCode = crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase();

    this.bookingCode = `BMS-${randomCode}`;
  }

  this.bookingReference = this.bookingCode;
  next();
});

module.exports = mongoose.model("Booking", bookingSchema);
