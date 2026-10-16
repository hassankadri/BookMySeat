
"use strict";

const mongoose = require("mongoose");
const Theatre = require("../models/Theatre");

// =====================================================
// PARTNER ROLE AUTHORIZATION
// =====================================================

function partnerAuth(req, res, next) {
  // Must run after the existing auth middleware.
  if (!req.userId || !req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "partner") {
    return res.status(403).json({
      success: false,
      message: "Cinema partner access required.",
    });
  }

  return next();
}

// =====================================================
// THEATRE OWNERSHIP AUTHORIZATION
// =====================================================

async function requireOwnedTheatre(req, res, next) {
  const { theatreId } = req.params;

  if (!req.userId || req.user?.role !== "partner") {
    return res.status(403).json({
      success: false,
      message: "Cinema partner access required.",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(theatreId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid theatre ID.",
    });
  }

  try {
    // Ownership is checked against MongoDB on
    // every request. The client cannot choose
    // which partner owns the theatre.
    const theatre = await Theatre.findOne({
      _id: theatreId,
      partner: req.userId,
      isActive: true,
    });

    if (!theatre) {
      return res.status(404).json({
        success: false,
        message: "Theatre not found or unavailable.",
      });
    }

    req.partnerTheatre = theatre;

    return next();
  } catch (error) {
    console.error(
      "Partner theatre authorization error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to verify theatre access.",
    });
  }
}

module.exports = {
  partnerAuth,
  requireOwnedTheatre,
};
