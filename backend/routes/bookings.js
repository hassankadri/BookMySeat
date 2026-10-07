const express = require("express");

const Booking = require("../models/Booking");
const BookedSeat = require("../models/BookedSeat");
const Show = require("../models/Show");

const {
  auth,
} = require("../middleware/auth");

const {
  sendBookingConfirmation,
} = require("../utils/email");

const {
  createCheckoutSession,
  verifyPayment,
} = require("../utils/stripe");

const router =
  express.Router();

/**
 * IMPORTANT
 * ---------
 *
 * This file keeps your CURRENT frontend working while V2 is built.
 *
 * Final production flow:
 *
 * seatLocks.js
 *      ↓
 * payments.js
 *      ↓
 * Stripe webhook
 *
 * Eventually the old browser-based payment confirmation
 * logic below will be removed.
 */

// =====================================================
// HELPERS
// =====================================================

const normalizeSeats = (seatIds = []) => [
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

/**
 * Calculate price on the SERVER.
 *
 * New shows:
 *
 * Screen seat type
 *      +
 * Show.pricing
 *
 * Old shows:
 *
 * show.price * seats.length
 *
 * The legacy fallback keeps the old project functional
 * until all existing data is migrated.
 */
const calculateLegacyCheckoutPrice = ({
  show,
  seats,
}) => {
  if (
    show.screen &&
    Array.isArray(
      show.screen.seats
    ) &&
    show.screen.seats
      .length > 0 &&
    Array.isArray(
      show.pricing
    ) &&
    show.pricing.length >
      0
  ) {
    const physicalSeatMap =
      new Map(
        show.screen.seats
          .filter(
            (seat) =>
              seat.isActive
          )
          .map((seat) => [
            String(
              seat.seatId
            ).toUpperCase(),

            seat,
          ])
      );

    const pricingMap =
      new Map(
        show.pricing.map(
          (item) => [
            item.seatType,

            Number(
              item.price
            ),
          ]
        )
      );

    const seatDetails = [];

    let totalAmount = 0;

    for (
      const seatId of
      seats
    ) {
      const physicalSeat =
        physicalSeatMap.get(
          seatId
        );

      if (!physicalSeat) {
        throw new Error(
          `Seat ${seatId} does not exist in this screen.`
        );
      }

      const price =
        pricingMap.get(
          physicalSeat.type
        );

      if (
        typeof price !==
          "number" ||
        !Number.isFinite(
          price
        ) ||
        price < 0
      ) {
        throw new Error(
          `Pricing is missing for ${physicalSeat.type} seats.`
        );
      }

      seatDetails.push({
        seatId,

        type:
          physicalSeat.type,

        price,
      });

      totalAmount +=
        price;
    }

    return {
      totalAmount,
      seatDetails,
    };
  }

  /**
   * Legacy pricing fallback.
   *
   * Remove after all shows use V2 screen/pricing data.
   */
  const legacyPrice =
    Number(show.price);

  if (
    !Number.isFinite(
      legacyPrice
    ) ||
    legacyPrice <= 0
  ) {
    throw new Error(
      "This show does not have valid ticket pricing."
    );
  }

  return {
    totalAmount:
      legacyPrice *
      seats.length,

    seatDetails: [],
  };
};

// =====================================================
// LEGACY CHECKOUT
// POST /api/bookings/checkout
// =====================================================

router.post(
  "/checkout",
  auth,
  async (req, res) => {
    try {
      const {
        showId,
        seats:
          rawSeats,
        originUrl,
      } = req.body;

      const seats =
        normalizeSeats(
          rawSeats || []
        );

      if (
        !showId ||
        seats.length === 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Show ID and at least one seat are required.",
          });
      }

      const show =
        await Show.findById(
          showId
        )
          .populate(
            "movie"
          )
          .populate(
            "screen"
          )
          .populate(
            "theatre"
          );

      if (!show) {
        return res
          .status(404)
          .json({
            error:
              "Show not found",
          });
      }

      // -----------------------------------------------
      // Check legacy booked seats
      // -----------------------------------------------

      const legacyBooked =
        new Set(
          (
            show.bookedSeats ||
            []
          ).map(
            (seat) =>
              String(
                seat
              ).toUpperCase()
          )
        );

      const legacyConflict =
        seats.filter(
          (seat) =>
            legacyBooked.has(
              seat
            )
        );

      if (
        legacyConflict.length >
        0
      ) {
        return res
          .status(409)
          .json({
            error:
              `Already booked: ${legacyConflict.join(
                ", "
              )}`,
          });
      }

      // -----------------------------------------------
      // Check V2 BookedSeat collection
      // -----------------------------------------------

      const confirmedSeats =
        await BookedSeat.find(
          {
            show:
              showId,

            seatId: {
              $in:
                seats,
            },
          }
        )
          .select(
            "seatId"
          )
          .lean();

      if (
        confirmedSeats.length >
        0
      ) {
        return res
          .status(409)
          .json({
            error:
              `Already booked: ${confirmedSeats
                .map(
                  (seat) =>
                    seat.seatId
                )
                .join(", ")}`,
          });
      }

      // -----------------------------------------------
      // Calculate trusted price
      // -----------------------------------------------

      const {
        totalAmount,
        seatDetails,
      } =
        calculateLegacyCheckoutPrice(
          {
            show,
            seats,
          }
        );

      /**
       * Never trust a price sent from the frontend.
       *
       * The frontend only chooses seats.
       * Backend decides how much they cost.
       */
      const booking =
        await Booking.create(
          {
            user:
              req.userId,

            show:
              showId,

            movie:
              show.movie?._id ||
              null,

            seats,

            seatDetails,

            totalAmount,

            currency:
              "INR",

            status:
              "PENDING_PAYMENT",

            paymentStatus:
              "pending",

            payment: {
              provider:
                "STRIPE",

              status:
                "PENDING",

              amount:
                totalAmount,

              currency:
                "INR",
            },
          }
        );

      // -----------------------------------------------
      // Create old Stripe Checkout session
      // -----------------------------------------------

      const session =
        await createCheckoutSession(
          {
            bookingId:
              booking._id.toString(),

            amount:
              totalAmount,

            movieTitle:
              show.movie
                ?.title ||
              "Movie Tickets",

            seats:
              seats.join(
                ", "
              ),

            originUrl,
          }
        );

      booking.sessionId =
        session.id;

      booking.payment.stripeCheckoutSessionId =
        session.id;

      await booking.save();

      /**
       * Keep the response shape expected by your
       * existing frontend.
       */
      res.json({
        sessionUrl:
          session.url,

        bookingReference:
          booking.bookingReference,
      });
    } catch (error) {
      console.error(
        "Legacy checkout error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            error.message ||
            "Failed to create checkout session",
        });
    }
  }
);

// =====================================================
// LEGACY VERIFY PAYMENT
// POST /api/bookings/verify-payment
// =====================================================

router.post(
  "/verify-payment",
  auth,
  async (req, res) => {
    try {
      const {
        sessionId,
      } = req.body;

      if (!sessionId) {
        return res
          .status(400)
          .json({
            error:
              "Session ID is required",
          });
      }

      const booking =
        await Booking.findOne(
          {
            $or: [
              {
                sessionId,
              },

              {
                "payment.stripeCheckoutSessionId":
                  sessionId,
              },
            ],
          }
        )
          .populate(
            "movie"
          )
          .populate({
            path:
              "show",

            populate: [
              {
                path:
                  "movie",
              },

              {
                path:
                  "theatre",
              },

              {
                path:
                  "screen",
              },
            ],
          })
          .populate(
            "user"
          );

      if (!booking) {
        return res
          .status(404)
          .json({
            error:
              "Booking not found",
          });
      }

      /**
       * SECURITY FIX
       *
       * Previously any authenticated user who knew
       * another Stripe session ID could potentially try
       * to verify that booking.
       *
       * The booking must belong to the logged-in user.
       */
      if (
        String(
          booking.user?._id
        ) !==
        String(
          req.userId
        )
      ) {
        return res
          .status(403)
          .json({
            error:
              "You do not have access to this booking.",
          });
      }

      if (
        booking.status ===
          "CONFIRMED" ||
        booking.paymentStatus ===
          "completed"
      ) {
        return res.json({
          message:
            "Payment already verified",

          booking,
        });
      }

      // -----------------------------------------------
      // Ask Stripe for actual payment status
      // -----------------------------------------------

      const paymentResult =
        await verifyPayment(
          sessionId
        );

      if (
        paymentResult.status !==
        "complete"
      ) {
        booking.status =
          "PAYMENT_FAILED";

        booking.paymentStatus =
          "failed";

        booking.payment.status =
          "FAILED";

        await booking.save();

        return res
          .status(400)
          .json({
            error:
              "Payment verification failed",
          });
      }

      /**
       * Verify that Stripe charged the SAME amount
       * our server expected.
       */
      if (
        Math.abs(
          Number(
            paymentResult.amount
          ) -
            Number(
              booking.totalAmount
            )
        ) > 0.001
      ) {
        console.error(
          "Stripe amount mismatch",
          {
            bookingId:
              booking._id,

            expected:
              booking.totalAmount,

            received:
              paymentResult.amount,
          }
        );

        return res
          .status(409)
          .json({
            error:
              "Payment amount does not match the booking.",
          });
      }

      // -----------------------------------------------
      // Permanently reserve seats
      // -----------------------------------------------

      try {
        await BookedSeat.bulkWrite(
          booking.seats.map(
            (seatId) => ({
              updateOne: {
                filter: {
                  show:
                    booking
                      .show
                      ._id,

                  seatId,

                  booking:
                    booking
                      ._id,
                },

                update: {
                  $setOnInsert:
                    {
                      show:
                        booking
                          .show
                          ._id,

                      seatId,

                      booking:
                        booking
                          ._id,

                      user:
                        booking
                          .user
                          ._id,
                    },
                },

                upsert: true,
              },
            })
          ),
          {
            ordered: true,
          }
        );
      } catch (
        seatError
      ) {
        /**
         * Payment already succeeded.
         *
         * We must NEVER mark the booking confirmed
         * if MongoDB tells us the seat belongs to
         * somebody else.
         *
         * Step 6E will add the production webhook
         * conflict/refund flow.
         */
        if (
          seatError?.code ===
          11000
        ) {
          console.error(
            "Paid booking hit permanent seat conflict:",
            seatError
          );

          return res
            .status(409)
            .json({
              error:
                "Payment was received, but a seat conflict occurred. The booking was not confirmed.",
            });
        }

        throw seatError;
      }

      // -----------------------------------------------
      // Update V2 + old booking state
      // -----------------------------------------------

      booking.status =
        "CONFIRMED";

      booking.paymentStatus =
        "completed";

      booking.paymentId =
        paymentResult.paymentIntentId ||
        sessionId;

      booking.payment.status =
        "PAID";

      booking.payment.stripeCheckoutSessionId =
        sessionId;

      booking.payment.stripePaymentIntentId =
        paymentResult.paymentIntentId ||
        booking.payment
          .stripePaymentIntentId;

      booking.payment.paidAt =
        new Date();

      await booking.save();

      /**
       * Keep old show.bookedSeats synchronized temporarily.
       *
       * The current frontend may still read this array.
       */
      await Show.updateOne(
        {
          _id:
            booking.show
              ._id,
        },

        {
          $addToSet: {
            bookedSeats: {
              $each:
                booking.seats,
            },
          },
        }
      );

      // -----------------------------------------------
      // Booking confirmation email
      // -----------------------------------------------

      try {
        const show =
          booking.show;

        const movie =
          booking.movie ||
          show.movie;

        const startTime =
          show.startTime
            ? new Date(
                show.startTime
              )
            : null;

        await sendBookingConfirmation(
          {
            email:
              booking.user
                .email,

            name:
              booking.user
                .name,

            bookingReference:
              booking.bookingReference,

            movieTitle:
              movie?.title ||
              "Movie",

            movieRating:
              movie?.rating ||
              "",

            showDate:
              startTime
                ? startTime.toLocaleDateString(
                    "en-IN",
                    {
                      weekday:
                        "long",

                      year:
                        "numeric",

                      month:
                        "long",

                      day:
                        "numeric",
                    }
                  )
                : "",

            showTime:
              startTime
                ? startTime.toLocaleTimeString(
                    "en-IN",
                    {
                      hour:
                        "2-digit",

                      minute:
                        "2-digit",
                    }
                  )
                : "",

            seats:
              booking.seats,

            totalAmount:
              booking.totalAmount,

            theaterName:
              show.theatre
                ?.name ||
              "BookMySeat Cinema",

            theaterAddress:
              show.theatre
                ?.address
                ? [
                    show
                      .theatre
                      .address
                      .street,

                    show
                      .theatre
                      .address
                      .area,

                    show
                      .theatre
                      .address
                      .city,
                  ]
                    .filter(
                      Boolean
                    )
                    .join(
                      ", "
                    )
                : "",
          }
        );
      } catch (
        emailError
      ) {
        /**
         * Email failure should NEVER cancel
         * a successful paid booking.
         */
        console.error(
          "Booking confirmation email failed:",
          emailError
        );
      }

      return res.json({
        message:
          "Payment verified successfully",

        booking,
      });
    } catch (error) {
      console.error(
        "Legacy payment verification error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Failed to verify payment",
        });
    }
  }
);

// =====================================================
// GET CURRENT USER BOOKINGS
// GET /api/bookings/my-bookings
// =====================================================

router.get(
  "/my-bookings",
  auth,
  async (req, res) => {
    try {
      /**
       * Include:
       *
       * V2 confirmed bookings
       *
       * OR
       *
       * old bookings saved with
       * paymentStatus = completed.
       */
      const bookings =
        await Booking.find(
          {
            user:
              req.userId,

            $or: [
              {
                status:
                  "CONFIRMED",
              },

              {
                paymentStatus:
                  "completed",
              },
            ],
          }
        )
          .populate(
            "movie"
          )
          .populate({
            path:
              "show",

            populate: [
              {
                path:
                  "movie",
              },

              {
                path:
                  "theatre",
              },

              {
                path:
                  "screen",
              },
            ],
          })
          .sort({
            createdAt: -1,
          });

      res.json({
        bookings,
      });
    } catch (error) {
      console.error(
        "Fetch bookings error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Failed to fetch bookings",
        });
    }
  }
);

module.exports = router;