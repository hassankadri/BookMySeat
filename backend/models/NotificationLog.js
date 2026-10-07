const mongoose = require("mongoose");

const notificationLogSchema =
  new mongoose.Schema(
    {
      booking: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Booking",

        required: true,

        index: true,
      },

      user: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        default: null,
      },

      type: {
        type: String,

        enum: [
          "CANCELLATION",
          "REFUND_PENDING",
          "REFUND_COMPLETED",
          "PAYMENT_FAILED",
          "SHOW_REMINDER",
        ],

        required: true,
      },

      email: {
        type: String,

        trim: true,

        lowercase: true,

        default: "",
      },

      status: {
        type: String,

        enum: [
          "PENDING",
          "SENT",
          "FAILED",
        ],

        default: "PENDING",
      },

      attempts: {
        type: Number,

        default: 0,

        min: 0,
      },

      sentAt: {
        type: Date,

        default: null,
      },

      lastError: {
        type: String,

        default: "",
      },
    },

    {
      timestamps: true,
    }
  );

/**
 * A particular notification should only be sent
 * once for a booking.
 *
 * A booking can still receive:
 *
 * SHOW_REMINDER
 * REFUND_PENDING
 * REFUND_COMPLETED
 *
 * because each has a different type.
 */
notificationLogSchema.index(
  {
    booking: 1,
    type: 1,
  },

  {
    unique: true,
  }
);

module.exports =
  mongoose.model(
    "NotificationLog",
    notificationLogSchema
  );