const express = require("express");

const Booking = require("../models/Booking");
const { adminAuth } = require("../middleware/auth");

const router = express.Router();

// =====================================================
// HELPERS
// =====================================================

const extractQrToken = (value = "") => {
  const raw = String(value).trim();

  if (!raw) {
    return "";
  }

  // Current BookMySeat QR format:
  // BMS1:<random-token>
  if (raw.startsWith("BMS1:")) {
    return raw.slice(5).trim();
  }

  // Also accept the raw token for testing/admin use.
  return raw;
};

const loadTicket = async (qrToken) => {
  return Booking.findOne({
    qrToken,
  })
    .populate(
      "movie",
      "title poster rating"
    )
    .populate({
      path: "show",
      populate: [
        {
          path: "movie",
          select:
            "title poster rating",
        },
        {
          path: "theatre",
          select:
            "name city address",
        },
        {
          path: "screen",
          select:
            "name screenNumber format",
        },
      ],
    })
    .lean();
};

const ticketResponse = (
  booking
) => {
  const movie =
    booking.movie ||
    booking.show?.movie;

  return {
    bookingId:
      booking._id,

    bookingCode:
      booking.bookingCode ||
      booking.bookingReference,

    movie: {
      title:
        movie?.title ||
        "Movie",

      poster:
        movie?.poster ||
        "",
    },

    theatre: {
      name:
        booking.show
          ?.theatre
          ?.name ||
        "Cinema",

      city:
        booking.show
          ?.theatre
          ?.city ||
        booking.show
          ?.theatre
          ?.address
          ?.city ||
        "",
    },

    screen: {
      name:
        booking.show
          ?.screen
          ?.name ||
        "Screen",
    },

    show: {
      startTime:
        booking.show
          ?.startTime ||
        null,

      format:
        booking.show
          ?.format ||
        "",
    },

    seats:
      booking.seats || [],

    totalAmount:
      booking.totalAmount,

    currency:
      booking.currency ||
      "INR",

    status:
      booking.status,

    ticketUsed:
      Boolean(
        booking.ticketUsed
      ),

    ticketUsedAt:
      booking.ticketUsedAt ||
      null,
  };
};

// =====================================================
// VERIFY TICKET
//
// Does NOT consume the ticket.
// ADMIN ONLY
// =====================================================

router.post(
  "/verify",
  adminAuth,
  async (req, res) => {
    try {
      const qrToken =
        extractQrToken(
          req.body.qrData ||
            req.body.qrToken
        );

      if (!qrToken) {
        return res
          .status(400)
          .json({
            success: false,
            status:
              "INVALID",

            message:
              "Invalid QR code.",
          });
      }

      const booking =
        await loadTicket(
          qrToken
        );

      if (!booking) {
        return res
          .status(404)
          .json({
            success: false,
            status:
              "INVALID",

            message:
              "Ticket not found.",
          });
      }

      if (
        booking.status !==
        "CONFIRMED"
      ) {
        return res
          .status(409)
          .json({
            success: false,
            status:
              booking.status,

            message:
              `Ticket is ${booking.status
                .toLowerCase()
                .replaceAll(
                  "_",
                  " "
                )}.`,

            ticket:
              ticketResponse(
                booking
              ),
          });
      }

      if (
        booking.ticketUsed
      ) {
        return res
          .status(409)
          .json({
            success: false,
            status:
              "ALREADY_USED",

            message:
              "This ticket has already been used.",

            ticket:
              ticketResponse(
                booking
              ),
          });
      }

      return res.json({
        success: true,
        status: "VALID",

        message:
          "Ticket is valid.",

        ticket:
          ticketResponse(
            booking
          ),
      });
    } catch (error) {
      console.error(
        "Ticket verification error:",
        error
      );

      res.status(500).json({
        success: false,

        message:
          "Failed to verify ticket.",
      });
    }
  }
);

// =====================================================
// CHECK IN
//
// Atomic update prevents two scanners admitting
// the same ticket simultaneously.
// ADMIN ONLY
// =====================================================

router.post(
  "/check-in",
  adminAuth,
  async (req, res) => {
    try {
      const qrToken =
        extractQrToken(
          req.body.qrData ||
            req.body.qrToken
        );

      if (!qrToken) {
        return res
          .status(400)
          .json({
            success: false,
            status:
              "INVALID",

            message:
              "Invalid QR code.",
          });
      }

      const now =
        new Date();

      const booking =
        await Booking.findOneAndUpdate(
          {
            qrToken,

            status:
              "CONFIRMED",

            ticketUsed:
              false,
          },

          {
            $set: {
              ticketUsed:
                true,

              ticketUsedAt:
                now,
            },
          },

          {
            new: true,
          }
        )
          .populate(
            "movie",
            "title poster rating"
          )
          .populate({
            path: "show",

            populate: [
              {
                path:
                  "movie",

                select:
                  "title poster rating",
              },

              {
                path:
                  "theatre",

                select:
                  "name city address",
              },

              {
                path:
                  "screen",

                select:
                  "name screenNumber format",
              },
            ],
          })
          .lean();

      if (booking) {
        return res.json({
          success: true,

          status:
            "CHECKED_IN",

          message:
            "Guest checked in successfully.",

          ticket:
            ticketResponse(
              booking
            ),
        });
      }

      /*
       * The atomic update failed.
       *
       * Find out WHY so the scanner can display
       * the correct message.
       */
      const existing =
        await loadTicket(
          qrToken
        );

      if (!existing) {
        return res
          .status(404)
          .json({
            success: false,

            status:
              "INVALID",

            message:
              "Ticket not found.",
          });
      }

      if (
        existing.ticketUsed
      ) {
        return res
          .status(409)
          .json({
            success: false,

            status:
              "ALREADY_USED",

            message:
              "This ticket has already been used.",

            ticket:
              ticketResponse(
                existing
              ),
          });
      }

      return res
        .status(409)
        .json({
          success: false,

          status:
            existing.status,

          message:
            "This ticket cannot be checked in.",

          ticket:
            ticketResponse(
              existing
            ),
        });
    } catch (error) {
      console.error(
        "Ticket check-in error:",
        error
      );

      res.status(500).json({
        success: false,

        message:
          "Failed to check in ticket.",
      });
    }
  }
);

module.exports = router;