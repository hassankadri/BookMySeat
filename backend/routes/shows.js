const express = require("express");
const mongoose = require("mongoose");

const Show = require("../models/Show");
const Movie = require("../models/Movie");
const Theatre = require("../models/Theatre");
const Screen = require("../models/Screen");

const {
  adminAuth,
} = require("../middleware/auth");

const router = express.Router();

// =====================================================
// CONSTANTS
// =====================================================

const SHOW_FORMATS = [
  "STANDARD",
  "3D",
  "IMAX",
  "IMAX_3D",
  "4DX",
  "DOLBY_CINEMA",
];

const SEAT_TYPES = [
  "REGULAR",
  "PREMIUM",
  "RECLINER",
  "LOUNGER",
  "WHEELCHAIR",
];

// =====================================================
// HELPERS
// =====================================================

const isValidId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const escapeRegex = (
  value = ""
) =>
  String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

// =====================================================
// VALIDATE SHOW DATA
// =====================================================

const validateShowData =
  async ({
    movie,
    theatre,
    screen,
    startTime,
    endTime,
    pricing,
    format,
    excludeShowId = null,
  }) => {
    // -------------------------------------------------
    // REQUIRED
    // -------------------------------------------------

    if (
      !movie ||
      !theatre ||
      !screen ||
      !startTime ||
      !endTime
    ) {
      return {
        valid: false,

        message:
          "Movie, theatre, screen, start time and end time are required.",
      };
    }

    // -------------------------------------------------
    // IDS
    // -------------------------------------------------

    if (
      !isValidId(movie) ||
      !isValidId(theatre) ||
      !isValidId(screen)
    ) {
      return {
        valid: false,

        message:
          "Invalid movie, theatre or screen ID.",
      };
    }

    // -------------------------------------------------
    // TIME
    // -------------------------------------------------

    const start =
      new Date(startTime);

    const end =
      new Date(endTime);

    if (
      Number.isNaN(
        start.getTime()
      ) ||
      Number.isNaN(
        end.getTime()
      )
    ) {
      return {
        valid: false,

        message:
          "Invalid show time.",
      };
    }

    if (
      end <= start
    ) {
      return {
        valid: false,

        message:
          "Show end time must be after start time.",
      };
    }

    // -------------------------------------------------
    // RELATED DATA
    //
    // IMPORTANT:
    // Only ACTIVE movies can receive bookable shows.
    // -------------------------------------------------

    const [
      movieData,
      theatreData,
      screenData,
    ] =
      await Promise.all([
        Movie.findOne({
          _id: movie,

          listingStatus:
            "ACTIVE",
        }).lean(),

        Theatre.findOne({
          _id: theatre,

          isActive:
            true,
        }).lean(),

        Screen.findOne({
          _id: screen,

          isActive:
            true,
        }).lean(),
      ]);

    if (!movieData) {
      return {
        valid: false,

        message:
          "Movie not found or is not ACTIVE. Set the movie to Active before scheduling shows.",
      };
    }

    if (!theatreData) {
      return {
        valid: false,

        message:
          "Theatre not found or inactive.",
      };
    }

    if (!screenData) {
      return {
        valid: false,

        message:
          "Screen not found or inactive.",
      };
    }

    // -------------------------------------------------
    // SCREEN OWNERSHIP
    // -------------------------------------------------

    if (
      screenData.theatre.toString() !==
      theatre.toString()
    ) {
      return {
        valid: false,

        message:
          "Selected screen does not belong to this theatre.",
      };
    }

    // -------------------------------------------------
    // FORMAT
    // -------------------------------------------------

    if (
      format &&
      !SHOW_FORMATS.includes(
        format
      )
    ) {
      return {
        valid: false,

        message:
          "Invalid show format.",
      };
    }

    // -------------------------------------------------
    // PRICING
    // -------------------------------------------------

    if (
      !Array.isArray(
        pricing
      ) ||
      pricing.length ===
        0
    ) {
      return {
        valid: false,

        message:
          "At least one seat price is required.",
      };
    }

    const pricingTypes =
      new Set();

    for (
      const item
      of pricing
    ) {
      if (
        !SEAT_TYPES.includes(
          item.seatType
        )
      ) {
        return {
          valid: false,

          message:
            `Invalid seat type: ${item.seatType}`,
        };
      }

      if (
        typeof item.price !==
          "number" ||
        item.price < 0
      ) {
        return {
          valid: false,

          message:
            `Invalid price for ${item.seatType}.`,
        };
      }

      if (
        pricingTypes.has(
          item.seatType
        )
      ) {
        return {
          valid: false,

          message:
            `Duplicate pricing for ${item.seatType}.`,
        };
      }

      pricingTypes.add(
        item.seatType
      );
    }

    // -------------------------------------------------
    // EVERY PHYSICAL SEAT TYPE MUST HAVE PRICE
    // -------------------------------------------------

    const requiredSeatTypes = [
      ...new Set(
        (
          screenData.seats ||
          []
        )
          .filter(
            (seat) =>
              seat.isActive !==
              false
          )
          .map(
            (seat) =>
              seat.type
          )
      ),
    ];

    for (
      const seatType
      of requiredSeatTypes
    ) {
      if (
        !pricingTypes.has(
          seatType
        )
      ) {
        return {
          valid: false,

          message:
            `Price required for ${seatType} seats.`,
        };
      }
    }

    // -------------------------------------------------
    // PREVENT SCREEN OVERLAP
    // -------------------------------------------------

    const overlapQuery = {
      screen,

      status: {
        $ne:
          "CANCELLED",
      },

      isActive: {
        $ne:
          false,
      },

      startTime: {
        $lt:
          end,
      },

      endTime: {
        $gt:
          start,
      },
    };

    if (
      excludeShowId
    ) {
      overlapQuery._id = {
        $ne:
          excludeShowId,
      };
    }

    const overlappingShow =
      await Show.findOne(
        overlapQuery
      ).lean();

    if (
      overlappingShow
    ) {
      return {
        valid: false,

        message:
          "Another show is already scheduled on this screen during this time.",
      };
    }

    return {
      valid: true,

      movieData,
      theatreData,
      screenData,
    };
  };

// =====================================================
// GET /api/shows
//
// PUBLIC SHOW INVENTORY
//
// Only:
// - active Show
// - ACTIVE Movie
//
// are returned.
//
// Hidden / Coming Soon movies with old Show documents
// automatically disappear from customer inventory.
// =====================================================

router.get(
  "/",

  async (
    req,
    res
  ) => {
    try {
      const {
        movie,
        theatre,
        screen,
        date,
        language,
        format,
        status,
      } =
        req.query;

      const filter = {
        isActive:
          true,
      };

      // -------------------------------------------------
      // MOVIE
      // -------------------------------------------------

      if (movie) {
        if (
          !isValidId(
            movie
          )
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Invalid movie ID.",
            });
        }

        filter.movie =
          movie;
      }

      // -------------------------------------------------
      // THEATRE
      // -------------------------------------------------

      if (theatre) {
        if (
          !isValidId(
            theatre
          )
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Invalid theatre ID.",
            });
        }

        filter.theatre =
          theatre;
      }

      // -------------------------------------------------
      // SCREEN
      // -------------------------------------------------

      if (screen) {
        if (
          !isValidId(
            screen
          )
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Invalid screen ID.",
            });
        }

        filter.screen =
          screen;
      }

      // -------------------------------------------------
      // LANGUAGE
      // -------------------------------------------------

      if (language) {
        filter.language = {
          $regex:
            `^${escapeRegex(
              language
            )}$`,

          $options:
            "i",
        };
      }

      // -------------------------------------------------
      // FORMAT
      // -------------------------------------------------

      if (format) {
        filter.format =
          String(
            format
          ).toUpperCase();
      }

      // -------------------------------------------------
      // STATUS
      // -------------------------------------------------

      if (status) {
        filter.status =
          String(
            status
          ).toUpperCase();
      }

      // -------------------------------------------------
      // DATE
      // -------------------------------------------------

      if (date) {
        const start =
          new Date(
            `${date}T00:00:00`
          );

        const end =
          new Date(
            `${date}T23:59:59.999`
          );

        if (
          Number.isNaN(
            start.getTime()
          ) ||
          Number.isNaN(
            end.getTime()
          )
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Invalid date.",
            });
        }

        filter.startTime = {
          $gte:
            start,

          $lte:
            end,
        };
      }

      // -------------------------------------------------
      // QUERY
      //
      // Movie population uses match ACTIVE.
      //
      // Mongoose will return movie: null for a hidden
      // or coming-soon movie. We remove those below.
      // -------------------------------------------------

      const rawShows =
        await Show.find(
          filter
        )
          .populate({
            path:
              "movie",

            match: {
              listingStatus:
                "ACTIVE",
            },

            select:
              "title poster banner genre duration language rating avgRating releaseYear listingStatus",
          })
          .populate(
            "theatre",
            "name city address coverImage amenities"
          )
          .populate(
            "screen",
            "name screenNumber format audio totalSeats"
          )
          .sort({
            startTime: 1,
          })
          .lean();

      const shows =
        rawShows.filter(
          (show) =>
            Boolean(
              show.movie
            )
        );

      return res.json({
        success:
          true,

        count:
          shows.length,

        shows,
      });
    } catch (error) {
      console.error(
        "Get shows error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch shows.",
        });
    }
  }
);

// =====================================================
// GET SINGLE SHOW
// =====================================================

router.get(
  "/:id",

  async (
    req,
    res
  ) => {
    try {
      if (
        !isValidId(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid show ID.",
          });
      }

      const show =
        await Show.findById(
          req.params.id
        )
          .populate({
            path:
              "movie",

            match: {
              listingStatus:
                "ACTIVE",
            },

            select:
              "title poster banner backdrop genre duration language rating avgRating releaseYear listingStatus",
          })
          .populate(
            "theatre",
            "name city address coverImage gallery amenities contact"
          )
          .populate(
            "screen",
            "name screenNumber format audio totalSeats seats"
          )
          .lean();

      // -------------------------------------------------
      // Movie can be null when lifecycle != ACTIVE.
      // -------------------------------------------------

      if (
        !show ||
        !show.isActive ||
        !show.movie
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Show not found.",
          });
      }

      return res.json({
        success:
          true,

        show,
      });
    } catch (error) {
      console.error(
        "Get show error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch show.",
        });
    }
  }
);

// =====================================================
// CREATE SHOW
// ADMIN ONLY
// =====================================================

router.post(
  "/",

  adminAuth,

  async (
    req,
    res
  ) => {
    try {
      const {
        movie,
        theatre,
        screen,
        startTime,
        endTime,
        language,
        format =
          "STANDARD",
        pricing,
        bookingOpensAt,
        bookingClosesAt,
      } =
        req.body;

      if (!language) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Show language is required.",
          });
      }

      const validation =
        await validateShowData({
          movie,
          theatre,
          screen,
          startTime,
          endTime,
          pricing,
          format,
        });

      if (
        !validation.valid
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              validation.message,
          });
      }

      // -------------------------------------------------
      // LEGACY PRICE
      //
      // Existing checkout code may still read show.price.
      // Keep cheapest seat category as fallback.
      // -------------------------------------------------

      const legacyPrice =
        Math.min(
          ...pricing.map(
            (item) =>
              item.price
          )
        );

      const show =
        await Show.create({
          movie,

          theatre,

          screen,

          startTime,

          endTime,

          language,

          format,

          pricing,

          price:
            legacyPrice,

          bookingOpensAt:
            bookingOpensAt ||
            null,

          bookingClosesAt:
            bookingClosesAt ||
            null,

          status:
            "SCHEDULED",

          isActive:
            true,
        });

      const populatedShow =
        await Show.findById(
          show._id
        )
          .populate(
            "movie",
            "title poster duration language listingStatus"
          )
          .populate(
            "theatre",
            "name city address coverImage"
          )
          .populate(
            "screen",
            "name screenNumber format audio totalSeats"
          );

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "Show created successfully.",

          show:
            populatedShow,
        });
    } catch (error) {
      console.error(
        "Create show error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Failed to create show.",
        });
    }
  }
);

// =====================================================
// UPDATE SHOW
// ADMIN ONLY
// =====================================================

router.put(
  "/:id",

  adminAuth,

  async (
    req,
    res
  ) => {
    try {
      if (
        !isValidId(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid show ID.",
          });
      }

      const show =
        await Show.findById(
          req.params.id
        );

      if (!show) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Show not found.",
          });
      }

      const updatedData = {
        movie:
          req.body.movie ??
          show.movie,

        theatre:
          req.body.theatre ??
          show.theatre,

        screen:
          req.body.screen ??
          show.screen,

        startTime:
          req.body.startTime ??
          show.startTime,

        endTime:
          req.body.endTime ??
          show.endTime,

        pricing:
          req.body.pricing ??
          show.pricing,

        format:
          req.body.format ??
          show.format,
      };

      // -------------------------------------------------
      // Validation also ensures movie is ACTIVE.
      // -------------------------------------------------

      const validation =
        await validateShowData({
          ...updatedData,

          excludeShowId:
            show._id,
        });

      if (
        !validation.valid
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              validation.message,
          });
      }

      const allowedFields = [
        "movie",
        "theatre",
        "screen",
        "startTime",
        "endTime",
        "language",
        "format",
        "pricing",
        "status",
        "bookingOpensAt",
        "bookingClosesAt",
        "isActive",
      ];

      allowedFields.forEach(
        (field) => {
          if (
            req.body[
              field
            ] !==
            undefined
          ) {
            show[field] =
              req.body[
                field
              ];
          }
        }
      );

      // -------------------------------------------------
      // LEGACY PRICE FALLBACK
      // -------------------------------------------------

      if (
        Array.isArray(
          show.pricing
        ) &&
        show.pricing.length >
          0
      ) {
        show.price =
          Math.min(
            ...show.pricing.map(
              (item) =>
                item.price
            )
          );
      }

      await show.save();

      const populatedShow =
        await Show.findById(
          show._id
        )
          .populate(
            "movie",
            "title poster duration language listingStatus"
          )
          .populate(
            "theatre",
            "name city address coverImage"
          )
          .populate(
            "screen",
            "name screenNumber format audio totalSeats"
          );

      return res.json({
        success:
          true,

        message:
          "Show updated successfully.",

        show:
          populatedShow,
      });
    } catch (error) {
      console.error(
        "Update show error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Failed to update show.",
        });
    }
  }
);

// =====================================================
// CANCEL SHOW
// ADMIN ONLY
//
// Never physically delete Show records because bookings,
// refunds and audit history may reference them.
// =====================================================

router.delete(
  "/:id",

  adminAuth,

  async (
    req,
    res
  ) => {
    try {
      if (
        !isValidId(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid show ID.",
          });
      }

      const show =
        await Show.findById(
          req.params.id
        );

      if (!show) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Show not found.",
          });
      }

      show.status =
        "CANCELLED";

      show.isActive =
        false;

      await show.save();

      return res.json({
        success:
          true,

        message:
          "Show cancelled successfully.",
      });
    } catch (error) {
      console.error(
        "Cancel show error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to cancel show.",
        });
    }
  }
);

module.exports =
  router;