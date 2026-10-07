const mongoose = require("mongoose");

const seatSchema = new mongoose.Schema(
  {
    seatId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    row: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    number: {
      type: Number,
      required: true,
      min: 1,
    },

    // Physical position inside the row.
    // Missing column numbers can represent aisles/gaps.
    column: {
      type: Number,
      required: true,
      min: 1,
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
      default: "REGULAR",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  }
);

const screenSchema = new mongoose.Schema(
  {
    theatre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theatre",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    screenNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    format: {
      type: String,
      enum: [
        "STANDARD",
        "IMAX",
        "IMAX_3D",
        "3D",
        "4DX",
        "DOLBY_CINEMA",
      ],
      default: "STANDARD",
    },

    audio: {
      type: String,
      enum: [
        "STANDARD",
        "DOLBY_7_1",
        "DOLBY_ATMOS",
      ],
      default: "STANDARD",
    },

    seats: {
      type: [seatSchema],
      default: [],
    },

    totalSeats: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

screenSchema.index(
  {
    theatre: 1,
    screenNumber: 1,
  },
  {
    unique: true,
  }
);

screenSchema.pre("save", function (next) {
  const seatIds = this.seats.map((seat) => seat.seatId);

  if (new Set(seatIds).size !== seatIds.length) {
    return next(new Error("Duplicate seat IDs are not allowed."));
  }

  const positions = this.seats.map(
    (seat) => `${seat.row}-${seat.column}`
  );

  if (new Set(positions).size !== positions.length) {
    return next(
      new Error("Two seats cannot occupy the same position.")
    );
  }

  this.totalSeats = this.seats.filter(
    (seat) => seat.isActive
  ).length;

  next();
});

module.exports = mongoose.model("Screen", screenSchema);