
"use strict";

const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");

const Movie = require("../models/Movie");
const Theatre = require("../models/Theatre");
const Screen = require("../models/Screen");
const Show = require("../models/Show");
const Booking = require("../models/Booking");

const {
  getRedisClient,
} = require("../config/redis");

const router = express.Router({
  mergeParams: true,
});

const SHOW_FORMATS = new Set([
  "STANDARD",
  "3D",
  "IMAX",
  "IMAX_3D",
  "4DX",
  "DOLBY_CINEMA",
]);

const SEAT_TYPES = new Set([
  "REGULAR",
  "PREMIUM",
  "RECLINER",
  "LOUNGER",
  "WHEELCHAIR",
]);

const SHOW_FIELDS = new Set([
  "movie",
  "screen",
  "startTime",
  "endTime",
  "language",
  "format",
  "pricing",
  "bookingOpensAt",
  "bookingClosesAt",
]);

const SCHEDULING_LOCK_MS = 45000;

const RELEASE_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end

  return 0
`;

const isValidId = (id) =>
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id);

const isObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

function parseOptionalDate(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? undefined
    : date;
}

function validationError(res, message) {
  return res.status(400).json({
    success: false,
    message,
  });
}

// =====================================================
// GET ASSIGNED THEATRE SCREENS
// GET /api/partner/theatres/:theatreId/screens
// =====================================================

router.get("/screens", async (req, res) => {
  try {
    const screens = await Screen.find({
      theatre: req.partnerTheatre._id,
    })
      .select(
        "theatre name screenNumber format audio totalSeats isActive createdAt updatedAt"
      )
      .sort({
        screenNumber: 1,
      })
      .lean();

    return res.json({
      success: true,
      count: screens.length,
      screens,
    });
  } catch (error) {
    console.error(
      "Partner screens listing error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load cinema screens.",
    });
  }
});

// =====================================================
// RENAME AN ASSIGNED SCREEN
// PATCH /api/partner/theatres/:theatreId/screens/:screenId
// =====================================================
//
// Changing physical seats, format, audio or status
// requires additional booking-safety checks.
// This endpoint deliberately changes only the name.

router.patch(
  "/screens/:screenId",
  async (req, res) => {
    try {
      const { screenId } = req.params;

      if (!isValidId(screenId)) {
        return validationError(
          res,
          "Invalid screen ID."
        );
      }

      if (
        !isObject(req.body) ||
        Object.keys(req.body).length !== 1 ||
        typeof req.body.name !== "string"
      ) {
        return validationError(
          res,
          "Only the screen name can be updated."
        );
      }

      const name = req.body.name.trim();

      if (name.length < 2 || name.length > 100) {
        return validationError(
          res,
          "Screen name must be between 2 and 100 characters."
        );
      }

      // Ownership is enforced in the database query,
      // not through a client-supplied theatre field.

      const screen = await Screen.findOneAndUpdate(
        {
          _id: screenId,
          theatre: req.partnerTheatre._id,
          isActive: true,
        },
        {
          $set: { name },
        },
        {
          new: true,
          runValidators: true,
        }
      ).select(
        "theatre name screenNumber format audio totalSeats isActive"
      );

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Screen not found or unavailable.",
        });
      }

      return res.json({
        success: true,
        message: "Screen name updated successfully.",
        screen,
      });
    } catch (error) {
      if (error.name === "ValidationError") {
        return validationError(
          res,
          "Invalid screen details."
        );
      }

      console.error(
        "Partner screen update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to update screen.",
      });
    }
  }
);

// =====================================================
// GET THEATRE SHOWTIMES
// GET /api/partner/theatres/:theatreId/shows
// =====================================================
//
// Includes historical and cancelled shows.
// Returns the latest 200 records for this theatre.

router.get("/shows", async (req, res) => {
  try {
    const shows = await Show.find({
      theatre: req.partnerTheatre._id,
    })
      .populate(
        "movie",
        "title poster duration language listingStatus"
      )
      .populate(
        "screen",
        "name screenNumber format audio totalSeats"
      )
      .sort({
        startTime: -1,
      })
      .limit(200)
      .lean();

    return res.json({
      success: true,
      count: shows.length,
      shows,
    });
  } catch (error) {
    console.error(
      "Partner showtimes listing error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load cinema showtimes.",
    });
  }
});

// =====================================================
// CREATE AN ASSIGNED THEATRE SHOWTIME
// POST /api/partner/theatres/:theatreId/shows
// =====================================================
//
// Theatre ID comes only from the verified ownership
// middleware. Partners cannot create shows elsewhere.
//
// Existing show records, booked seats, cancellations
// and payment state are never modified here.

router.post("/shows", async (req, res) => {
  if (!isObject(req.body)) {
    return validationError(
      res,
      "A valid showtime request is required."
    );
  }

  const unexpected = Object.keys(req.body).filter(
    (field) => !SHOW_FIELDS.has(field)
  );

  if (unexpected.length) {
    return validationError(
      res,
      "The request contains unsupported showtime fields."
    );
  }

  const {
    movie: movieId,
    screen: screenId,
    startTime,
    endTime,
    language,
    format = "STANDARD",
    pricing,
    bookingOpensAt,
    bookingClosesAt,
  } = req.body;

  if (!isValidId(movieId) || !isValidId(screenId)) {
    return validationError(
      res,
      "Valid movie and screen IDs are required."
    );
  }

  const start = parseOptionalDate(startTime);
  const end = parseOptionalDate(endTime);

  if (
    !start ||
    !end ||
    start === undefined ||
    end === undefined
  ) {
    return validationError(
      res,
      "Valid start and end times are required."
    );
  }

  if (start <= new Date()) {
    return validationError(
      res,
      "New showtimes must begin in the future."
    );
  }

  if (end <= start) {
    return validationError(
      res,
      "Show end time must be after its start time."
    );
  }

  if (
    typeof language !== "string" ||
    language.trim().length < 2 ||
    language.trim().length > 60
  ) {
    return validationError(
      res,
      "A valid show language is required."
    );
  }

  if (
    typeof format !== "string" ||
    !SHOW_FORMATS.has(format)
  ) {
    return validationError(
      res,
      "Invalid show format."
    );
  }

  if (
    !Array.isArray(pricing) ||
    pricing.length === 0 ||
    pricing.length > SEAT_TYPES.size
  ) {
    return validationError(
      res,
      "Valid seat-category pricing is required."
    );
  }

  const prices = new Map();

  for (const item of pricing) {
    if (
      !isObject(item) ||
      !SEAT_TYPES.has(item.seatType) ||
      typeof item.price !== "number" ||
      !Number.isFinite(item.price) ||
      item.price < 0 ||
      item.price > 100000 ||
      prices.has(item.seatType)
    ) {
      return validationError(
        res,
        "Each seat category must have one valid price."
      );
    }

    prices.set(item.seatType, item.price);
  }

  const opensAt = parseOptionalDate(bookingOpensAt);
  const closesAt = parseOptionalDate(bookingClosesAt);

  if (
    opensAt === undefined ||
    closesAt === undefined
  ) {
    return validationError(
      res,
      "Invalid booking window."
    );
  }

  if (
    (opensAt && opensAt >= start) ||
    (closesAt && closesAt > start) ||
    (opensAt && closesAt && closesAt <= opensAt)
  ) {
    return validationError(
      res,
      "The booking window must end no later than the show start time."
    );
  }

  let redis;
  let lockAcquired = false;

  const lockKey =
    `bms:partner:show-scheduling:${screenId}`;

  const lockOwner = crypto.randomUUID();

  try {
    const theatreId = req.partnerTheatre._id;

    // Validate movie, active screen and theatre scope.
    const [movie, screen] = await Promise.all([
      Movie.findOne({
        _id: movieId,
        listingStatus: "ACTIVE",
      })
        .select("_id")
        .lean(),

      Screen.findOne({
        _id: screenId,
        theatre: theatreId,
        isActive: true,
      })
        .select("_id theatre seats")
        .lean(),
    ]);

    if (!movie) {
      return validationError(
        res,
        "The movie must be active before scheduling."
      );
    }

    if (!screen) {
      return res.status(404).json({
        success: false,
        message:
          "Active screen not found in your assigned theatre.",
      });
    }

    const activeSeats = (screen.seats || []).filter(
      (seat) => seat.isActive !== false
    );

    if (!activeSeats.length) {
      return validationError(
        res,
        "The screen must have active seats."
      );
    }

    const requiredSeatTypes = new Set(
      activeSeats.map((seat) => seat.type)
    );

    for (const seatType of requiredSeatTypes) {
      if (!prices.has(seatType)) {
        return validationError(
          res,
          `Price required for ${seatType} seats.`
        );
      }
    }

    // Serialize concurrent partner scheduling requests
    // for this screen through a distributed Redis lock.

    redis = await getRedisClient();

    lockAcquired =
      (await redis.set(lockKey, lockOwner, {
        NX: true,
        PX: SCHEDULING_LOCK_MS,
      })) === "OK";

    if (!lockAcquired) {
      return res.status(409).json({
        success: false,
        code: "SCHEDULING_IN_PROGRESS",
        message:
          "Another scheduling request is in progress for this screen. Please retry.",
      });
    }

    // Recheck theatre ownership after acquiring the lock.
    // An administrator may have reassigned the theatre.

    const stillOwned = await Theatre.exists({
      _id: theatreId,
      partner: req.userId,
      isActive: true,
    });

    if (!stillOwned) {
      return res.status(403).json({
        success: false,
        message:
          "You no longer have access to this theatre.",
      });
    }

    // Enforce the existing BookMySeat overlap rule.
    const overlap = await Show.exists({
      screen: screenId,
      status: { $ne: "CANCELLED" },
      isActive: { $ne: false },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });

    if (overlap) {
      return res.status(409).json({
        success: false,
        message:
          "Another show is scheduled on this screen during the selected time.",
      });
    }

    // Never accept theatre, creator or status from
    // the request body.

    const created = await Show.create({
      movie: movieId,
      theatre: theatreId,
      screen: screenId,
      startTime: start,
      endTime: end,
      language: language.trim(),
      format,
      pricing: [...prices].map(
        ([seatType, price]) => ({
          seatType,
          price,
        })
      ),
      bookingOpensAt: opensAt,
      bookingClosesAt: closesAt,
      status: "SCHEDULED",
      isActive: true,
      createdBy: req.userId,
    });

    const show = await Show.findById(created._id)
      .populate(
        "movie",
        "title poster duration language listingStatus"
      )
      .populate(
        "screen",
        "name screenNumber format audio totalSeats"
      )
      .lean();

    return res.status(201).json({
      success: true,
      message: "Showtime created successfully.",
      show,
    });
  } catch (error) {
    console.error(
      "Partner showtime creation error:",
      error
    );

    return res.status(503).json({
      success: false,
      message:
        "Showtime could not be created. Please try again.",
    });
  } finally {
    if (redis && lockAcquired) {
      try {
        await redis.eval(RELEASE_LOCK_SCRIPT, {
          keys: [lockKey],
          arguments: [lockOwner],
        });
      } catch (error) {
        console.error(
          "Partner scheduling lock cleanup error:",
          error
        );
      }
    }
  }
});

// =====================================================
// READ-ONLY THEATRE BOOKING ACTIVITY
// GET /api/partner/theatres/:theatreId/bookings
// =====================================================
//
// Returns the latest 100 bookings associated with
// this theatre's shows.
//
// Customer identity, authentication data, Stripe
// identifiers and refund internals are excluded.

router.get("/bookings", async (req, res) => {
  try {
    const showIds = await Show.distinct("_id", {
      theatre: req.partnerTheatre._id,
    });

    if (!showIds.length) {
      return res.json({
        success: true,
        count: 0,
        bookings: [],
      });
    }

    const bookings = await Booking.find({
      show: { $in: showIds },
    })
      .select(
        "bookingCode show status seats totalAmount currency createdAt"
      )
      .populate({
        path: "show",
        select: "movie screen startTime endTime status",
        populate: {
          path: "movie",
          select: "title",
        },
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error(
      "Partner booking activity error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load cinema bookings.",
    });
  }
});

module.exports = router;
