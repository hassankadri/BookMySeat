const express =
  require("express");

const mongoose =
  require("mongoose");

const Show =
  require("../models/Show");

const BookedSeat =
  require("../models/BookedSeat");

const {
  lockSeats,
  releaseSeats,
  getLockedSeats,
} = require("../services/seatLockService");

const {
  emitToShow,
} = require("../config/socket");

const {
  auth,
} = require("../middleware/auth");

const router =
  express.Router();

const MAX_SEATS_PER_BOOKING =
  10;

// =====================================================
// HELPERS
// =====================================================

const normalizeSeats = (
  seatIds = []
) => [
  ...new Set(
    seatIds
      .map((seatId) =>
        String(seatId)
          .trim()
          .toUpperCase()
      )
      .filter(Boolean)
  ),
];

const getBookableShow =
  async (showId) =>
    Show.findOne({
      _id: showId,
      isActive: true,
      status: "SCHEDULED",
    }).populate("screen");

// =====================================================
// HOLD SEATS
// POST /api/seat-locks/hold
// =====================================================

router.post(
  "/hold",
  auth,
  async (req, res) => {
    try {
      const {
        showId,
        seatIds,
      } = req.body;

      const userId =
        req.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Authentication required.",
          });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          showId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid show ID.",
          });
      }

      if (
        !Array.isArray(
          seatIds
        ) ||
        seatIds.length === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Please select at least one seat.",
          });
      }

      const seats =
        normalizeSeats(
          seatIds
        );

      if (
        seats.length >
        MAX_SEATS_PER_BOOKING
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              `You can select a maximum of ${MAX_SEATS_PER_BOOKING} seats.`,
          });
      }

      const show =
        await getBookableShow(
          showId
        );

      if (!show) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Show not found or unavailable.",
          });
      }

      if (!show.screen) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "This show does not have a valid screen.",
          });
      }

      const now =
        new Date();

      if (
        show.startTime <= now
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "This show has already started.",
          });
      }

      if (
        show.bookingOpensAt &&
        now <
          show.bookingOpensAt
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Booking has not opened for this show yet.",
          });
      }

      if (
        show.bookingClosesAt &&
        now >
          show.bookingClosesAt
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Booking has closed for this show.",
          });
      }

      // =================================================
      // VALIDATE PHYSICAL SEATS
      // =================================================

      const activeScreenSeats =
        show.screen.seats.filter(
          (seat) =>
            seat.isActive
        );

      const validSeatIds =
        new Set(
          activeScreenSeats.map(
            (seat) =>
              String(
                seat.seatId
              ).toUpperCase()
          )
        );

      const invalidSeats =
        seats.filter(
          (seatId) =>
            !validSeatIds.has(
              seatId
            )
        );

      if (
        invalidSeats.length >
        0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              `Invalid seat(s): ${invalidSeats.join(
                ", "
              )}`,
          });
      }

      // =================================================
      // PERMANENT BOOKING CHECK
      // =================================================

      const confirmedSeats =
        await BookedSeat.find(
          {
            show: showId,

            seatId: {
              $in: seats,
            },
          }
        )
          .select("seatId")
          .lean();

      if (
        confirmedSeats.length >
        0
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              `Already booked: ${confirmedSeats
                .map(
                  (seat) =>
                    seat.seatId
                )
                .join(", ")}`,
          });
      }

      // =================================================
      // LEGACY BOOKED SEAT CHECK
      // =================================================

      const legacyBooked =
        new Set(
          (
            show.bookedSeats ||
            []
          ).map(
            (seat) =>
              String(seat)
                .toUpperCase()
          )
        );

      const legacyConflict =
        seats.filter(
          (seatId) =>
            legacyBooked.has(
              seatId
            )
        );

      if (
        legacyConflict.length >
        0
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              `Already booked: ${legacyConflict.join(
                ", "
              )}`,
          });
      }

      // =================================================
      // ATOMIC REDIS HOLD
      // =================================================

      const result =
        await lockSeats({
          showId,
          seatIds:
            seats,
          userId,
        });

      if (
        !result.success
      ) {
        return res
          .status(409)
          .json(result);
      }

      // =================================================
      // SOCKET.IO — BROADCAST HELD SEATS
      // =================================================

      emitToShow(
        showId,
        "seats:held",
        {
          seatIds:
            result.seats,

          expiresAt:
            result.expiresAt,
        }
      );

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Seats held successfully. Complete payment before the timer expires.",

          lockId:
            result.lockId,

          seats:
            result.seats,

          expiresIn:
            result.expiresIn,

          expiresAt:
            result.expiresAt,
        });
    } catch (error) {
      console.error(
        "Hold seats error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Failed to hold seats.",
        });
    }
  }
);

// =====================================================
// RELEASE SEATS
// DELETE /api/seat-locks/release
// =====================================================

router.delete(
  "/release",
  auth,
  async (req, res) => {
    try {
      const {
        showId,
        seatIds,
        lockId,
      } = req.body;

      const userId =
        req.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Authentication required.",
          });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          showId
        ) ||
        !Array.isArray(
          seatIds
        ) ||
        seatIds.length ===
          0 ||
        !lockId
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "showId, seatIds and lockId are required.",
          });
      }

      const seats =
        normalizeSeats(
          seatIds
        );

      const result =
        await releaseSeats({
          showId,
          seatIds:
            seats,
          userId,
          lockId,
        });

      // =================================================
      // SOCKET.IO — BROADCAST RELEASED SEATS
      // =================================================

      /**
       * IMPORTANT:
       *
       * Only broadcast seats that Redis actually deleted.
       *
       * This prevents us from accidentally telling users
       * that a seat is available when another customer
       * currently owns the lock.
       */
      if (
        result.releasedSeats &&
        result.releasedSeats
          .length > 0
      ) {
        emitToShow(
          showId,
          "seats:released",
          {
            seatIds:
              result.releasedSeats,
          }
        );
      }

      return res.json({
        success: true,

        message:
          `${result.released} seat lock(s) released.`,

        released:
          result.released,

        releasedSeats:
          result.releasedSeats ||
          [],
      });
    } catch (error) {
      console.error(
        "Release seats error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Failed to release seats.",
        });
    }
  }
);

// =====================================================
// GET CURRENTLY HELD SEATS
// GET /api/seat-locks/:showId
// =====================================================

router.get(
  "/:showId",
  async (req, res) => {
    try {
      const {
        showId,
      } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          showId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid show ID.",
          });
      }

      const show =
        await Show.findOne({
          _id: showId,
          isActive: true,
        }).populate(
          "screen"
        );

      if (
        !show ||
        !show.screen
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Show not found.",
          });
      }

      const physicalSeats =
        show.screen.seats
          .filter(
            (seat) =>
              seat.isActive
          )
          .map(
            (seat) =>
              seat.seatId
          );

      const lockedSeats =
        await getLockedSeats({
          showId,

          seatIds:
            physicalSeats,
        });

      return res.json({
        success: true,
        lockedSeats,
      });
    } catch (error) {
      console.error(
        "Get seat locks error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Failed to fetch seat locks.",
        });
    }
  }
);

module.exports = router;