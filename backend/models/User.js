
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

  // =====================================================
  // ACCOUNT ROLES
  // =====================================================
  //
  // user    - Customer
  // admin   - Platform administrator
  // partner - Cinema operator
  //
  // Partner accounts must be assigned to theatres by
  // an authorized administrator. A partner role alone
  // does not grant access to any theatre.
  //
  // Existing account roles are preserved.

  role: {
    type: String,
    enum: ["user", "admin", "partner"],
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

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "User",
  userSchema
);
