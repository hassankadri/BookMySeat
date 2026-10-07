const express =
  require("express");

const mongoose =
  require("mongoose");

const User =
  require("../models/User");

const Movie =
  require("../models/Movie");

const Theatre =
  require("../models/Theatre");

const Screen =
  require("../models/Screen");

const Show =
  require("../models/Show");

const Booking =
  require("../models/Booking");

const BookedSeat =
  require("../models/BookedSeat");

const Refund =
  require("../models/Refund");

const {
  auth,
  adminAuth,
} =
  require("../middleware/auth");

const {
  getStripe,
} =
  require("../utils/stripe");

const router =
  express.Router();

// Every route below requires admin authentication.
router.use(
  auth,
  adminAuth
);

// =====================================================
// HELPERS
// =====================================================

const escapeRegex = (
  value = ""
) =>
  String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

const getPagination =
  (req) => {
    const page =
      Math.max(
        Number(
          req.query.page
        ) || 1,
        1
      );

    const limit =
      Math.min(
        Math.max(
          Number(
            req.query.limit
          ) || 20,
          1
        ),
        100
      );

    return {
      page,
      limit,

      skip:
        (page - 1) *
        limit,
    };
  };

const isValidId =
  (id) =>
    mongoose.Types.ObjectId.isValid(
      id
    );

/**
 * Release permanently-booked seats after
 * a cancellation/refund.
 *
 * We also update the old Show.bookedSeats array
 * because the project still keeps it for legacy UI.
 */
const releaseBookingSeats =
  async (
    booking
  ) => {
    await BookedSeat.deleteMany({
      booking:
        booking._id,
    });

    if (
      booking.show &&
      Array.isArray(
        booking.seats
      ) &&
      booking.seats.length >
        0
    ) {
      const showId =
        booking.show._id ||
        booking.show;

      await Show.updateOne(
        {
          _id: showId,
        },
        {
          $pull: {
            bookedSeats: {
              $in:
                booking.seats,
            },
          },
        }
      );
    }
  };

/**
 * Finalize our database state only after Stripe
 * confirms the refund succeeded.
 */
const finalizeRefund =
  async ({
    booking,
    refund,
    reason,
  }) => {
    booking.status =
      "REFUNDED";

    booking.paymentStatus =
      "refunded";

    if (
      !booking.payment
    ) {
      booking.payment = {};
    }

    booking.payment.status =
      "REFUNDED";

    booking.payment.refundedAt =
      new Date();

    booking.cancelledAt =
      new Date();

    booking.cancellationReason =
      reason ||
      "Refunded by admin";

    await booking.save();

    await releaseBookingSeats(
      booking
    );

    return refund;
  };

// =====================================================
// DASHBOARD STATS
// GET /api/admin/stats
// =====================================================

router.get(
  "/stats",

  async (
    req,
    res
  ) => {
    try {
      const now =
        new Date();

      const [
        totalUsers,
        totalMovies,
        totalTheatres,
        totalScreens,
        totalBookings,
        confirmedBookings,
        pendingBookings,
        refundedBookings,
        activeShows,
        revenueResult,
      ] =
        await Promise.all([
          User.countDocuments(),

          Movie.countDocuments(),

          Theatre.countDocuments(
            {
              isActive: {
                $ne: false,
              },
            }
          ),

          Screen.countDocuments(
            {
              isActive: {
                $ne: false,
              },
            }
          ),

          Booking.countDocuments(),

          Booking.countDocuments(
            {
              status:
                "CONFIRMED",
            }
          ),

          Booking.countDocuments(
            {
              status:
                "PENDING_PAYMENT",
            }
          ),

          Booking.countDocuments(
            {
              status:
                "REFUNDED",
            }
          ),

          Show.countDocuments(
            {
              startTime: {
                $gte: now,
              },

              status:
                "SCHEDULED",

              isActive: {
                $ne: false,
              },
            }
          ),

          Booking.aggregate([
            {
              $match: {
                status:
                  "CONFIRMED",
              },
            },

            {
              $group: {
                _id: null,

                total: {
                  $sum:
                    "$totalAmount",
                },
              },
            },
          ]),
        ]);

      const totalRevenue =
        revenueResult[0]
          ?.total || 0;

      return res.json({
        success: true,

        stats: {
          totalRevenue,
          totalBookings,

          confirmedBookings,
          pendingBookings,
          refundedBookings,

          activeShows,

          totalUsers,
          totalMovies,
          totalTheatres,
          totalScreens,
        },
      });
    } catch (error) {
      console.error(
        "Admin stats error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to load admin statistics.",
        });
    }
  }
);

// =====================================================
// USERS
// GET /api/admin/users
// =====================================================

router.get(
  "/users",

  async (
    req,
    res
  ) => {
    try {
      const {
        page,
        limit,
        skip,
      } =
        getPagination(req);

      const search =
        String(
          req.query.search ||
            ""
        ).trim();

      const role =
        String(
          req.query.role ||
            ""
        ).trim();

      const filter = {};

      if (search) {
        const regex =
          new RegExp(
            escapeRegex(
              search
            ),
            "i"
          );

        filter.$or = [
          {
            name: regex,
          },

          {
            email: regex,
          },
        ];
      }

      if (
        role === "user" ||
        role === "admin"
      ) {
        filter.role =
          role;
      }

      const [
        users,
        total,
      ] =
        await Promise.all([
          User.find(filter)
            .select(
              "-password -emailVerification -passwordReset"
            )
            .sort({
              createdAt: -1,
            })
            .skip(skip)
            .limit(limit)
            .lean(),

          User.countDocuments(
            filter
          ),
        ]);

      return res.json({
        success: true,

        users,

        pagination: {
          page,
          limit,
          total,

          pages:
            Math.ceil(
              total /
                limit
            ),
        },
      });
    } catch (error) {
      console.error(
        "Admin users error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to load users.",
        });
    }
  }
);

// =====================================================
// CHANGE USER ROLE
// PATCH /api/admin/users/:id/role
// =====================================================

router.patch(
  "/users/:id/role",

  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      const {
        role,
      } =
        req.body;

      if (
        !isValidId(id)
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid user ID.",
          });
      }

      if (
        ![
          "user",
          "admin",
        ].includes(role)
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid role.",
          });
      }

      if (
        String(
          req.userId
        ) ===
          String(id) &&
        role !== "admin"
      ) {
        return res
          .status(400)
          .json({
            error:
              "You cannot remove your own admin role.",
          });
      }

      const user =
        await User.findByIdAndUpdate(
          id,

          {
            role,
          },

          {
            new: true,

            runValidators:
              true,
          }
        ).select(
          "-password -emailVerification -passwordReset"
        );

      if (!user) {
        return res
          .status(404)
          .json({
            error:
              "User not found.",
          });
      }

      return res.json({
        success: true,

        message:
          "User role updated.",

        user,
      });
    } catch (error) {
      console.error(
        "Role update error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to update user.",
        });
    }
  }
);

// =====================================================
// BOOKINGS
// GET /api/admin/bookings
// =====================================================

router.get(
  "/bookings",

  async (
    req,
    res
  ) => {
    try {
      const {
        page,
        limit,
        skip,
      } =
        getPagination(req);

      const status =
        String(
          req.query.status ||
            ""
        ).trim();

      const filter = {};

      const validStatuses = [
        "PENDING_PAYMENT",
        "CONFIRMED",
        "PAYMENT_FAILED",
        "EXPIRED",
        "CANCELLED",
        "REFUND_PENDING",
        "REFUNDED",
      ];

      if (
        validStatuses.includes(
          status
        )
      ) {
        filter.status =
          status;
      }

      const [
        bookings,
        total,
      ] =
        await Promise.all([
          Booking.find(
            filter
          )

            .populate(
              "user",
              "name email"
            )

            .populate(
              "movie",
              "title poster"
            )

            .populate({
              path:
                "show",

              select:
                "startTime endTime language format theatre screen status",

              populate: [
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

            .sort({
              createdAt: -1,
            })

            .skip(skip)
            .limit(limit)
            .lean(),

          Booking.countDocuments(
            filter
          ),
        ]);

      return res.json({
        success: true,

        bookings,

        pagination: {
          page,
          limit,
          total,

          pages:
            Math.ceil(
              total /
                limit
            ),
        },
      });
    } catch (error) {
      console.error(
        "Admin bookings error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to load bookings.",
        });
    }
  }
);

// =====================================================
// CANCEL UNPAID BOOKING
// POST /api/admin/bookings/:id/cancel
// =====================================================

router.post(
  "/bookings/:id/cancel",

  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      if (
        !isValidId(id)
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid booking ID.",
          });
      }

      const booking =
        await Booking.findById(
          id
        );

      if (!booking) {
        return res
          .status(404)
          .json({
            error:
              "Booking not found.",
          });
      }

      if (
        booking.status ===
        "REFUNDED"
      ) {
        return res.json({
          success: true,

          message:
            "Booking has already been refunded.",
        });
      }

      if (
        booking.status ===
        "CANCELLED"
      ) {
        return res.json({
          success: true,

          message:
            "Booking is already cancelled.",
        });
      }

      const hasBeenPaid =
        booking.status ===
          "CONFIRMED" ||
        booking.paymentStatus ===
          "completed" ||
        booking.payment
          ?.status ===
          "PAID";

      if (hasBeenPaid) {
        return res
          .status(400)
          .json({
            error:
              "This booking has been paid. Use Refund instead.",
          });
      }

      booking.status =
        "CANCELLED";

      booking.cancelledAt =
        new Date();

      booking.cancellationReason =
        String(
          req.body.reason ||
            "Cancelled by admin"
        )
          .trim()
          .slice(
            0,
            500
          );

      await booking.save();

      // Defensive cleanup in case old data created
      // permanent seats before confirmation.
      await releaseBookingSeats(
        booking
      );

      return res.json({
        success: true,

        message:
          "Booking cancelled.",

        booking,
      });
    } catch (error) {
      console.error(
        "Admin cancellation error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Could not cancel booking.",
        });
    }
  }
);

// =====================================================
// FULL STRIPE REFUND
// POST /api/admin/bookings/:id/refund
// =====================================================

router.post(
  "/bookings/:id/refund",

  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      if (
        !isValidId(id)
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid booking ID.",
          });
      }

      const booking =
        await Booking.findById(
          id
        );

      if (!booking) {
        return res
          .status(404)
          .json({
            error:
              "Booking not found.",
          });
      }

      const reason =
        String(
          req.body.reason ||
            "Refunded by admin"
        )
          .trim()
          .slice(
            0,
            500
          );

      // Once a ticket has been admitted, don't accidentally
      // refund it through the normal admin flow.
      if (
        booking.ticketUsed
      ) {
        return res
          .status(400)
          .json({
            error:
              "This ticket has already been used and cannot be refunded from this screen.",
          });
      }

      // Already finalized: return safely and also
      // reconcile any seats in case an earlier request
      // stopped halfway through.
      if (
        booking.status ===
        "REFUNDED"
      ) {
        await releaseBookingSeats(
          booking
        );

        return res.json({
          success: true,

          message:
            "Booking was already refunded.",
        });
      }

      const hasBeenPaid =
        booking.status ===
          "CONFIRMED" ||
        booking.paymentStatus ===
          "completed" ||
        booking.payment
          ?.status ===
          "PAID";

      if (!hasBeenPaid) {
        return res
          .status(400)
          .json({
            error:
              "Only paid bookings can be refunded.",
          });
      }

      const paymentIntentId =
        booking.payment
          ?.stripePaymentIntentId ||
        (
          String(
            booking.paymentId ||
              ""
          ).startsWith(
            "pi_"
          )
            ? booking.paymentId
            : null
        );

      if (
        !paymentIntentId
      ) {
        return res
          .status(400)
          .json({
            error:
              "This booking does not contain a Stripe PaymentIntent ID, so it cannot be refunded automatically.",
          });
      }

      const stripe =
        getStripe();

      // -------------------------------------------------
      // IDEMPOTENCY / RECOVERY
      // -------------------------------------------------

      let refundRecord =
        await Refund.findOne({
          booking:
            booking._id,
        });

      let stripeRefund;

      // An earlier request may have created the Stripe
      // refund but stopped before BookMySeat finished.
      if (
        refundRecord
          ?.stripeRefundId
      ) {
        stripeRefund =
          await stripe.refunds.retrieve(
            refundRecord
              .stripeRefundId
          );
      } else {
        stripeRefund =
          await stripe.refunds.create(
            {
              payment_intent:
                paymentIntentId,

              reason:
                "requested_by_customer",

              metadata: {
                bookingId:
                  String(
                    booking._id
                  ),

                bookingCode:
                  String(
                    booking.bookingCode ||
                      booking.bookingReference ||
                      ""
                  ),

                adminUserId:
                  String(
                    req.userId
                  ),

                adminReason:
                  reason.slice(
                    0,
                    250
                  ),
              },
            },

            {
              idempotencyKey:
                `bookmyseat-full-refund-${booking._id}`,
            }
          );
      }

      const refundStatus =
        String(
          stripeRefund.status ||
            "pending"
        ).toUpperCase();

      refundRecord =
        await Refund.findOneAndUpdate(
          {
            booking:
              booking._id,
          },

          {
            $set: {
              stripeRefundId:
                stripeRefund.id,

              amount:
                Number(
                  stripeRefund.amount ||
                    Math.round(
                      booking.totalAmount *
                        100
                    )
                ) / 100,

              currency:
                String(
                  stripeRefund.currency ||
                    booking.currency ||
                    "INR"
                ).toUpperCase(),

              reason,

              status:
                refundStatus,

              processedBy:
                req.userId,
            },
          },

          {
            new: true,
            upsert: true,

            setDefaultsOnInsert:
              true,
          }
        );

      // Stripe can occasionally return a pending refund.
      // Do not release seats or mark money refunded until
      // Stripe says the refund actually succeeded.
      if (
        refundStatus !==
        "SUCCEEDED"
      ) {
        return res
          .status(202)
          .json({
            success: true,

            pending: true,

            message:
              `Refund created. Stripe status: ${refundStatus}.`,

            refund:
              refundRecord,
          });
      }

      await finalizeRefund({
        booking,
        refund:
          refundRecord,
        reason,
      });

      return res.json({
        success: true,

        message:
          "Refund completed successfully.",

        refund:
          refundRecord,
      });
    } catch (error) {
      console.error(
        "Admin refund error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            error.raw
              ?.message ||
            error.message ||
            "Could not refund booking.",
        });
    }
  }
);

// =====================================================
// SHOWS
// GET /api/admin/shows
// =====================================================

router.get(
  "/shows",

  async (
    req,
    res
  ) => {
    try {
      const {
        page,
        limit,
        skip,
      } =
        getPagination(req);

      const status =
        String(
          req.query.status ||
            ""
        ).trim();

      const filter = {};

      if (status) {
        filter.status =
          status;
      }

      const [
        shows,
        total,
      ] =
        await Promise.all([
          Show.find(filter)

            .populate(
              "movie",
              "title poster duration"
            )

            .populate(
              "theatre",
              "name city address"
            )

            .populate(
              "screen",
              "name screenNumber format"
            )

            .sort({
              startTime: 1,
            })

            .skip(skip)
            .limit(limit)
            .lean(),

          Show.countDocuments(
            filter
          ),
        ]);

      return res.json({
        success: true,

        shows,

        pagination: {
          page,
          limit,
          total,

          pages:
            Math.ceil(
              total /
                limit
            ),
        },
      });
    } catch (error) {
      console.error(
        "Admin shows error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to load shows.",
        });
    }
  }
);

// =====================================================
// MOVIES
// GET /api/admin/movies
// =====================================================

router.get(
  "/movies",

  async (
    req,
    res
  ) => {
    try {
      const movies =
        await Movie.find()
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.json({
        success: true,
        movies,
      });
    } catch (error) {
      console.error(
        "Admin movies error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to load movies.",
        });
    }
  }
);

// =====================================================
// THEATRES
// GET /api/admin/theatres
// =====================================================

router.get(
  "/theatres",

  async (
    req,
    res
  ) => {
    try {
      const theatres =
        await Theatre.find()
          .sort({
            city: 1,
            name: 1,
          })
          .lean();

      return res.json({
        success: true,

        theatres,
      });
    } catch (error) {
      console.error(
        "Admin theatres error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to load theatres.",
        });
    }
  }
);

// =====================================================
// SCREENS
// GET /api/admin/screens
// =====================================================

router.get(
  "/screens",

  async (
    req,
    res
  ) => {
    try {
      const filter = {};

      if (
        req.query.theatre
      ) {
        if (
          !isValidId(
            req.query
              .theatre
          )
        ) {
          return res
            .status(400)
            .json({
              error:
                "Invalid theatre ID.",
            });
        }

        filter.theatre =
          req.query.theatre;
      }

      const screens =
        await Screen.find(
          filter
        )

          .populate(
            "theatre",
            "name city"
          )

          .sort({
            screenNumber: 1,
          })

          .lean();

      return res.json({
        success: true,

        screens,
      });
    } catch (error) {
      console.error(
        "Admin screens error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to load screens.",
        });
    }
  }
);

module.exports =
  router;