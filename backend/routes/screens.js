const express = require("express");
const mongoose = require("mongoose");

const Screen = require("../models/Screen");
const Theatre = require("../models/Theatre");

const { adminAuth } = require("../middleware/auth");

const router = express.Router();

const SCREEN_FORMATS = [
  "STANDARD",
  "IMAX",
  "IMAX_3D",
  "3D",
  "4DX",
  "DOLBY_CINEMA",
];

const AUDIO_FORMATS = [
  "STANDARD",
  "DOLBY_7_1",
  "DOLBY_ATMOS",
];

const SEAT_TYPES = [
  "REGULAR",
  "PREMIUM",
  "RECLINER",
  "LOUNGER",
  "WHEELCHAIR",
];

// ------------------------------------------------------
// GET SCREENS
// GET /api/screens
// GET /api/screens?theatre=<theatreId>
// ------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const filter = {
      isActive: true,
    };

    if (req.query.theatre) {
      if (!mongoose.Types.ObjectId.isValid(req.query.theatre)) {
        return res.status(400).json({
          success: false,
          message: "Invalid theatre ID.",
        });
      }

      filter.theatre = req.query.theatre;
    }

    const screens = await Screen.find(filter)
      .populate(
        "theatre",
        "name city address coverImage amenities"
      )
      .sort({
        theatre: 1,
        screenNumber: 1,
      })
      .lean();

    res.json({
      success: true,
      count: screens.length,
      screens,
    });
  } catch (error) {
    console.error("Get screens error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch screens.",
    });
  }
});

// ------------------------------------------------------
// GET SINGLE SCREEN
// GET /api/screens/:id
// ------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID.",
      });
    }

    const screen = await Screen.findOne({
      _id: req.params.id,
      isActive: true,
    })
      .populate(
        "theatre",
        "name city address coverImage amenities"
      )
      .lean();

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found.",
      });
    }

    res.json({
      success: true,
      screen,
    });
  } catch (error) {
    console.error("Get screen error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch screen.",
    });
  }
});

// ------------------------------------------------------
// CREATE SCREEN
// POST /api/screens
// ADMIN ONLY
// ------------------------------------------------------
router.post("/", adminAuth, async (req, res) => {
  try {
    const {
      theatre,
      name,
      screenNumber,
      format = "STANDARD",
      audio = "STANDARD",
      seats = [],
    } = req.body;

    if (!theatre || !name || !screenNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Theatre, screen name and screen number are required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(theatre)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theatre ID.",
      });
    }

    const theatreExists = await Theatre.exists({
      _id: theatre,
      isActive: true,
    });

    if (!theatreExists) {
      return res.status(404).json({
        success: false,
        message: "Theatre not found.",
      });
    }

    if (!SCREEN_FORMATS.includes(format)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen format.",
      });
    }

    if (!AUDIO_FORMATS.includes(audio)) {
      return res.status(400).json({
        success: false,
        message: "Invalid audio format.",
      });
    }

    const existingScreen = await Screen.findOne({
      theatre,
      screenNumber,
    });

    if (existingScreen) {
      return res.status(409).json({
        success: false,
        message:
          "A screen with this number already exists in this theatre.",
      });
    }

    const screen = await Screen.create({
      theatre,
      name,
      screenNumber,
      format,
      audio,
      seats,
    });

    res.status(201).json({
      success: true,
      message: "Screen created successfully.",
      screen,
    });
  } catch (error) {
    console.error("Create screen error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create screen.",
    });
  }
});

// ------------------------------------------------------
// GENERATE / REPLACE SEAT LAYOUT
//
// POST /api/screens/:id/layout
//
// Example body:
// {
//   "rows": [
//     {
//       "row": "A",
//       "seatCount": 10,
//       "type": "REGULAR",
//       "aislesAfter": [5]
//     },
//     {
//       "row": "B",
//       "seatCount": 8,
//       "type": "PREMIUM",
//       "aislesAfter": [4]
//     }
//   ]
// }
// ------------------------------------------------------
router.post("/:id/layout", adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID.",
      });
    }

    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one seat row is required.",
      });
    }

    const screen = await Screen.findById(req.params.id);

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found.",
      });
    }

    const generatedSeats = [];
    const usedRows = new Set();

    for (const config of rows) {
      const row = String(config.row || "")
        .trim()
        .toUpperCase();

      const seatCount = Number(config.seatCount);

      const type = config.type || "REGULAR";

      const aislesAfter = Array.isArray(config.aislesAfter)
        ? config.aislesAfter.map(Number)
        : [];

      if (!row) {
        return res.status(400).json({
          success: false,
          message: "Every row requires a row name.",
        });
      }

      if (usedRows.has(row)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate row: ${row}`,
        });
      }

      usedRows.add(row);

      if (
        !Number.isInteger(seatCount) ||
        seatCount < 1 ||
        seatCount > 100
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid seat count for row ${row}.`,
        });
      }

      if (!SEAT_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid seat type for row ${row}.`,
        });
      }

      let physicalColumn = 1;

      for (let number = 1; number <= seatCount; number++) {
        generatedSeats.push({
          seatId: `${row}${number}`,
          row,
          number,
          column: physicalColumn,
          type,
          isActive: true,
        });

        physicalColumn += 1;

        // Leave one empty physical column after this seat.
        if (aislesAfter.includes(number)) {
          physicalColumn += 1;
        }
      }
    }

    screen.seats = generatedSeats;

    await screen.save();

    res.json({
      success: true,
      message: "Seat layout generated successfully.",
      totalSeats: screen.totalSeats,
      seats: screen.seats,
    });
  } catch (error) {
    console.error("Generate layout error:", error);

    res.status(500).json({
      success: false,
      message:
        error.message || "Failed to generate seat layout.",
    });
  }
});

// ------------------------------------------------------
// UPDATE SCREEN
// PUT /api/screens/:id
// ADMIN ONLY
// ------------------------------------------------------
router.put("/:id", adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID.",
      });
    }

    const screen = await Screen.findById(req.params.id);

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found.",
      });
    }

    const allowedFields = [
      "name",
      "screenNumber",
      "format",
      "audio",
      "isActive",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        screen[field] = req.body[field];
      }
    });

    await screen.save();

    res.json({
      success: true,
      message: "Screen updated successfully.",
      screen,
    });
  } catch (error) {
    console.error("Update screen error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "That screen number already exists in this theatre.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update screen.",
    });
  }
});

// ------------------------------------------------------
// DEACTIVATE SCREEN
// DELETE /api/screens/:id
// ADMIN ONLY
// ------------------------------------------------------
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID.",
      });
    }

    const screen = await Screen.findById(req.params.id);

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found.",
      });
    }

    screen.isActive = false;

    await screen.save();

    res.json({
      success: true,
      message: "Screen deactivated successfully.",
    });
  } catch (error) {
    console.error("Delete screen error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to deactivate screen.",
    });
  }
});

module.exports = router;