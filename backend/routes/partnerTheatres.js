
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Theatre = require("../models/Theatre");
const Screen = require("../models/Screen");

const { auth } = require("../middleware/auth");

const {
  partnerAuth,
  requireOwnedTheatre,
} = require("../middleware/partnerAccess");

const partnerOperations = require("./partnerOperations");

const router = express.Router();

router.use(auth, partnerAuth);

const EDITABLE_FIELDS = new Set([
  "description",
  "amenities",
  "contact",
]);

const CONTACT_FIELDS = new Set([
  "phone",
  "email",
  "whatsapp",
]);

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

// =====================================================
// LIST ASSIGNED THEATRES
// GET /api/partner/theatres
// =====================================================

router.get("/", async (req, res) => {
  try {
    const theatres = await Theatre.find({
      partner: req.userId,
      isActive: true,
    })
      .sort({ city: 1, name: 1 })
      .lean();

    return res.json({
      success: true,
      count: theatres.length,
      theatres,
    });
  } catch (error) {
    console.error(
      "Get partner theatres error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned theatres.",
    });
  }
});

// =====================================================
// READ SCREEN PRICING CATEGORIES
// GET /api/partner/theatres/:theatreId/screens/:screenId
// =====================================================
//
// Requires verified theatre ownership.
// Returns counts by active seat category only.
// Does not expose individual seat identifiers/layouts.

router.get(
  "/:theatreId/screens/:screenId",
  requireOwnedTheatre,
  async (req, res) => {
    try {
      const { screenId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(screenId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID.",
        });
      }

      const screen = await Screen.findOne({
        _id: screenId,
        theatre: req.partnerTheatre._id,
        isActive: true,
      })
        .select(
          "name screenNumber format audio theatre seats totalSeats"
        )
        .lean();

      if (!screen) {
        return res.status(404).json({
          success: false,
          message:
            "Active screen not found in your assigned cinema.",
        });
      }

      const counts = new Map();

      for (const seat of screen.seats || []) {
        if (seat.isActive === false) {
          continue;
        }

        counts.set(
          seat.type,
          (counts.get(seat.type) || 0) + 1
        );
      }

      const categories = [...counts.entries()].map(
        ([seatType, count]) => ({
          seatType,
          count,
        })
      );

      return res.json({
        success: true,
        screen: {
          _id: screen._id,
          theatre: screen.theatre,
          name: screen.name,
          screenNumber: screen.screenNumber,
          format: screen.format,
          audio: screen.audio,
          totalSeats: categories.reduce(
            (sum, category) => sum + category.count,
            0
          ),
        },
        categories,
      });
    } catch (error) {
      console.error(
        "Partner screen category error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch screen pricing categories.",
      });
    }
  }
);

// =====================================================
// GET SINGLE OWNED THEATRE
// GET /api/partner/theatres/:theatreId
// =====================================================

router.get(
  "/:theatreId",
  requireOwnedTheatre,
  (req, res) => {
    return res.json({
      success: true,
      theatre: req.partnerTheatre,
    });
  }
);

// =====================================================
// UPDATE OWNED THEATRE
// PATCH /api/partner/theatres/:theatreId
// =====================================================

router.patch(
  "/:theatreId",
  requireOwnedTheatre,
  async (req, res) => {
    try {
      if (!isPlainObject(req.body)) {
        return res.status(400).json({
          success: false,
          message: "A valid update object is required.",
        });
      }

      const fields = Object.keys(req.body);

      if (
        fields.length === 0 ||
        fields.some(
          (field) => !EDITABLE_FIELDS.has(field)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only description, amenities and contact details can be edited.",
        });
      }

      const updates = {};

      // =============================================
      // DESCRIPTION
      // =============================================

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          "description"
        )
      ) {
        if (
          typeof req.body.description !== "string" ||
          req.body.description.length > 1500
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Description must be text under 1500 characters.",
          });
        }

        updates.description =
          req.body.description.trim();
      }

      // =============================================
      // AMENITIES
      // =============================================

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          "amenities"
        )
      ) {
        if (
          !Array.isArray(req.body.amenities) ||
          req.body.amenities.length > 20 ||
          !req.body.amenities.every(
            (item) => typeof item === "string"
          )
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid theatre amenities.",
          });
        }

        updates.amenities = [
          ...new Set(req.body.amenities),
        ];
      }

      // =============================================
      // CONTACT
      // =============================================

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          "contact"
        )
      ) {
        const contact = req.body.contact;

        if (
          !isPlainObject(contact) ||
          Object.keys(contact).some(
            (field) => !CONTACT_FIELDS.has(field)
          )
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid contact fields.",
          });
        }

        for (const [field, value] of Object.entries(
          contact
        )) {
          if (
            typeof value !== "string" ||
            value.length > 254
          ) {
            return res.status(400).json({
              success: false,
              message:
                `Invalid contact value for ${field}.`,
            });
          }

          const normalized = value.trim();

          if (
            field === "email" &&
            normalized &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              normalized
            )
          ) {
            return res.status(400).json({
              success: false,
              message: "Invalid contact email.",
            });
          }

          updates[`contact.${field}`] =
            field === "email"
              ? normalized.toLowerCase()
              : normalized;
        }
      }

      if (!Object.keys(updates).length) {
        return res.status(400).json({
          success: false,
          message: "No changes were provided.",
        });
      }

      // Ownership is rechecked in the write query.

      const theatre =
        await Theatre.findOneAndUpdate(
          {
            _id: req.partnerTheatre._id,
            partner: req.userId,
            isActive: true,
          },
          { $set: updates },
          {
            new: true,
            runValidators: true,
            context: "query",
          }
        );

      if (!theatre) {
        return res.status(404).json({
          success: false,
          message:
            "Theatre not found or unavailable.",
        });
      }

      return res.json({
        success: true,
        message:
          "Theatre details updated successfully.",
        theatre,
      });
    } catch (error) {
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Invalid theatre details.",
        });
      }

      console.error(
        "Partner theatre update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update theatre details.",
      });
    }
  }
);

// =====================================================
// PARTNER OPERATIONS
// =====================================================

router.use(
  "/:theatreId",
  requireOwnedTheatre,
  partnerOperations
);

module.exports = router;
