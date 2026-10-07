const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },

  password: {
    type: String,
    required: true,
  },

  // Google account ID.
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    default: null,
  },

  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },

  emailVerified: {
    type: Boolean,
    default: true,
  },

  emailVerification: {
    otpHash: {
      type: String,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    lastSentAt: {
      type: Date,
      default: null,
    },

    attempts: {
      type: Number,
      default: 0,
    },
  },

  passwordReset: {
    otpHash: {
      type: String,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    lastSentAt: {
      type: Date,
      default: null,
    },

    attempts: {
      type: Number,
      default: 0,
    },
  },

  favorites: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
    },
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports =
  mongoose.model(
    "User",
    userSchema
  );