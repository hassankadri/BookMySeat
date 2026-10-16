
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const Theatre = require("../models/Theatre");

const {
  auth,
  adminAuth,
} = require("../middleware/auth");

const router = express.Router();

// =====================================================
// SECURITY — ADMIN ACCESS ONLY
// =====================================================

router.use(auth, adminAuth);

// =====================================================
// GET ALL CINEMA PARTNERS
// GET /api/admin/partner-assignments/partners
// =====================================================

router.get("/partners", async (req, res) => {
  try {
    const partners = await User.find({
      role: "partner",
    })
      .select("_id name email role emailVerified")
      .sort({ name: 1 })
      .lean();

    return res.json({
      success: true,
      count: partners.length,
      partners,
    });
  } catch (error) {
    console.error("List partners error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load cinema partners.",
    });
  }
});

// =====================================================
// GET THEATRE OWNERSHIP ASSIGNMENTS
// GET /api/admin/partner-assignments/theatres
// =====================================================

router.get("/theatres", async (req, res) => {
  try {
    const theatres = await Theatre.find({})
      .select("_id name city slug isActive partner")
      .populate("partner", "_id name email role")
      .sort({
        city: 1,
        name: 1,
      })
      .lean();

    return res.json({
      success: true,
      count: theatres.length,
      theatres,
    });
  } catch (error) {
    console.error(
      "List theatre assignments error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load theatre assignments.",
    });
  }
});

// =====================================================
// GRANT CINEMA PARTNER ACCESS
// PATCH /api/admin/partner-assignments/users/:userId
// =====================================================

router.patch("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Administrator accounts cannot be modified here.",
      });
    }

    if (user.emailVerified === false) {
      return res.status(400).json({
        success: false,
        message:
          "Email verification is required before granting partner access.",
      });
    }

    if (user.role === "partner") {
      return res.json({
        success: true,
        message: "Account already has partner access.",
        partner: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }

    if (user.role !== "user") {
      return res.status(400).json({
        success: false,
        message: "Account is not eligible for partner access.",
      });
    }

    const partner = await User.findOneAndUpdate(
      {
        _id: userId,
        role: "user",
        emailVerified: { $ne: false },
      },
      {
        $set: {
          role: "partner",
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("_id name email role");

    if (!partner) {
      return res.status(409).json({
        success: false,
        message:
          "Account eligibility changed. Please refresh and retry.",
      });
    }

    return res.json({
      success: true,
      message: "Cinema partner access granted.",
      partner,
    });
  } catch (error) {
    console.error(
      "Grant partner access error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to grant partner access.",
    });
  }
});

// =====================================================
// ASSIGN / UNASSIGN THEATRE
// PATCH /api/admin/partner-assignments/theatres/:theatreId
//
// Assign:   { "partnerId": "USER_OBJECT_ID" }
// Unassign: { "partnerId": null }
// =====================================================

router.patch(
  "/theatres/:theatreId",
  async (req, res) => {
    try {
      const { theatreId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(theatreId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid theatre ID.",
        });
      }

      if (
        !Object.prototype.hasOwnProperty.call(
          req.body || {},
          "partnerId"
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "partnerId is required.",
        });
      }

      const { partnerId } = req.body;

      if (
        partnerId !== null &&
        (
          typeof partnerId !== "string" ||
          !mongoose.Types.ObjectId.isValid(partnerId)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "partnerId must be a valid user ID or null.",
        });
      }

      let partner = null;

      if (partnerId !== null) {
        partner = await User.findOne({
          _id: partnerId,
          role: "partner",
          emailVerified: { $ne: false },
        }).select("_id name email role");

        if (!partner) {
          return res.status(404).json({
            success: false,
            message:
              "Eligible cinema partner not found.",
          });
        }
      }

      const theatre = await Theatre.findById(theatreId);

      if (!theatre) {
        return res.status(404).json({
          success: false,
          message: "Theatre not found.",
        });
      }

      theatre.partner = partner ? partner._id : null;

      await theatre.save();

      return res.json({
        success: true,
        message: partner
          ? "Cinema partner assigned successfully."
          : "Cinema partner assignment removed.",
        theatre: {
          _id: theatre._id,
          name: theatre.name,
          city: theatre.city,
          isActive: theatre.isActive,
          partner: theatre.partner,
        },
      });
    } catch (error) {
      console.error(
        "Theatre partner assignment error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update theatre ownership.",
      });
    }
  }
);

// =====================================================
// EXPORT EXPRESS ROUTER
// =====================================================

module.exports = router;
