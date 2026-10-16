
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Show = require("../models/Show");
const BookedSeat = require("../models/BookedSeat");

const { auth } = require("../middleware/auth");

const {
  getLockedSeats,
} = require("../services/seatLockService");

const {
  recommendSeatGroups,
} = require("../services/seatIntelligenceService");

const router = express.Router();

// GET /api/seat-intelligence/:showId
//
// Query parameters:
// count  - number of adjacent seats, 1–10
// view   - CENTER, FRONT or BACK
// type   - ANY or a specific seat category
// aisle  - true or false
// budget - optional maximum total price
//
// Recommendations are read-only.
// Actual reservation remains in /api/seat-locks/hold.

router.get(
  "/:showId",
  auth,
  async (req, res) => {
    const { showId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(showId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid show ID.",
      });
    }

    const count = Number(
      req.query.count ?? 2
    );

    const view = String(
      req.query.view ?? "CENTER"
    ).toUpperCase();

    const type = String(
      req.query.type ?? "ANY"
    ).toUpperCase();

    const aisle =
      String(req.query.aisle ?? "false") ===
      "true";

    const budget =
      req.query.budget === undefined
        ? null
        : Number(req.query.budget);

    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 10 ||
      !["CENTER", "FRONT", "BACK"].includes(
        view
      ) ||
      ![
        "ANY",
        "REGULAR",
        "PREMIUM",
        "RECLINER",
        "LOUNGER",
        "WHEELCHAIR",
      ].includes(type) ||
      (budget !== null &&
        (!Number.isFinite(budget) ||
          budget <= 0 ||
          budget > 1000000)) ||
      !["true", "false"].includes(
        String(req.query.aisle ?? "false")
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid seat preferences.",
      });
    }

    try {
      const show = await Show.findOne({
        _id: showId,
        isActive: true,
        status: "SCHEDULED",
        startTime: {
          $gt: new Date(),
        },
      })
        .populate("screen")
        .lean();

      if (
        !show ||
        !show.screen?.isActive
      ) {
        return res.status(404).json({
          success: false,
          message: "Show unavailable.",
        });
      }

      const seats = (
        show.screen.seats || []
      ).filter(
        (seat) => seat.isActive !== false
      );

      const seatIds = seats.map(
        (seat) => seat.seatId
      );

      // Read permanent bookings from MongoDB
      // and temporary holds from Redis.
      const [booked, locked] =
        await Promise.all([
          BookedSeat.find({
            show: showId,
          })
            .select("seatId -_id")
            .lean(),

          getLockedSeats({
            showId,
            seatIds,
          }),
        ]);

      const suggestions =
        recommendSeatGroups({
          seats,

          bookedSeatIds: [
            ...booked.map(
              (record) => record.seatId
            ),
            ...(Array.isArray(
              show.bookedSeats
            )
              ? show.bookedSeats
              : []),
          ],

          heldSeatIds: locked,
          pricing: show.pricing || [],
          fallbackPrice: show.price || 0,
          partySize: count,
          seatType: type,
          view,
          preferAisle: aisle,
          maxTotal: budget,
          limit: 3,
        });

      return res.json({
        success: true,
        showId,
        suggestions,
        requiresHold: true,

        message: suggestions.length
          ? "Recommendations are live and may change. Hold seats before checkout."
          : "No adjacent seats match these preferences.",
      });
    } catch (error) {
      console.error(
        "Seat intelligence error:",
        error
      );

      return res.status(503).json({
        success: false,
        message:
          "Seat recommendations are temporarily unavailable.",
      });
    }
  }
);

module.exports = router;
