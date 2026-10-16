
"use strict";

const mongoose = require("mongoose");

const {
  verifyAdmission,
} = require("../services/virtualQueueService");

/**
 * Feature 8 — Virtual Queue Admission Guard
 *
 * Runs after authentication, before the existing
 * seat-hold route.
 *
 * The normal seat-locking and payment implementations
 * remain untouched.
 *
 * No queue configured:
 *   Request continues normally.
 *
 * Queue enabled:
 *   The authenticated user needs a valid admission
 *   token for this specific show.
 *
 * Redis unavailable:
 *   Fail closed rather than bypassing the queue.
 */
async function requireQueueAdmission(req, res, next) {
  const { showId } = req.body || {};

  // Leave invalid-payload handling to the existing
  // seat-hold route and fraud protection.
  if (
    typeof showId !== "string" ||
    !mongoose.Types.ObjectId.isValid(showId)
  ) {
    return next();
  }

  if (!req.userId) {
    return res.status(401).json({
      success: false,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
    });
  }

  try {
    const admissionToken =
      req.get("X-Queue-Admission") || "";

    const admission = await verifyAdmission({
      showId,
      userId: req.userId,
      token: admissionToken,
    });

    if (!admission.allowed) {
      res.set("Cache-Control", "no-store");

      return res.status(403).json({
        success: false,
        code: "QUEUE_ADMISSION_REQUIRED",
        message:
          "This screening has a waiting room. " +
          "Join the queue before selecting seats.",
      });
    }

    return next();
  } catch (error) {
    console.error(
      "Virtual queue admission error:",
      error
    );

    return res.status(503).json({
      success: false,
      code: "QUEUE_SERVICE_UNAVAILABLE",
      message:
        "The waiting room is temporarily unavailable. " +
        "Please try again shortly.",
    });
  }
}

module.exports = {
  requireQueueAdmission,
};
