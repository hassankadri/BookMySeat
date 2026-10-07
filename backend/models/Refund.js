const mongoose = require("mongoose");

const refundSchema =
  new mongoose.Schema(
    {
      // One full refund per booking.
      booking: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true,
        unique: true,
        index: true,
      },

      stripeRefundId: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
      },

      amount: {
        type: Number,
        required: true,
        min: 0,
      },

      currency: {
        type: String,
        default: "INR",
        uppercase: true,
      },

      reason: {
        type: String,
        default: "",
        trim: true,
      },

      status: {
        type: String,
        enum: [
          "PENDING",
          "SUCCEEDED",
          "FAILED",
          "CANCELED",
          "REQUIRES_ACTION",
        ],
        default: "PENDING",
      },

      processedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Refund",
    refundSchema
  );