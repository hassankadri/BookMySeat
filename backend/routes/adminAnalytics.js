const express = require("express");

const Booking = require("../models/Booking");
const Show = require("../models/Show");

const {
  auth,
  adminAuth,
} = require("../middleware/auth");

const router = express.Router();

const CINEMA_TIMEZONE =
  "Asia/Kolkata";

const MAX_AI_QUESTION_LENGTH =
  500;

router.use(
  auth,
  adminAuth
);

// =====================================================
// HELPERS
// =====================================================

const round = (
  value,
  digits = 0
) => {
  const number =
    Number(value || 0);

  const multiplier =
    10 ** digits;

  return (
    Math.round(
      number *
        multiplier
    ) /
    multiplier
  );
};

const getTicketCountExpression =
  () => ({
    $size: {
      $ifNull: [
        "$seats",
        [],
      ],
    },
  });

// =====================================================
// TOP MOVIES PIPELINE
//
// Supports newer bookings containing booking.movie,
// while also falling back to show.movie for older data.
// =====================================================

const getTopMovies =
  async ({
    fromDate = null,
    limit = 8,
  } = {}) => {
    const match = {
      status:
        "CONFIRMED",
    };

    if (
      fromDate
    ) {
      match.createdAt = {
        $gte:
          fromDate,
      };
    }

    return Booking.aggregate([
      {
        $match:
          match,
      },

      {
        $lookup: {
          from:
            "shows",

          localField:
            "show",

          foreignField:
            "_id",

          as:
            "showDoc",
        },
      },

      {
        $addFields: {
          effectiveMovie: {
            $ifNull: [
              "$movie",

              {
                $arrayElemAt: [
                  "$showDoc.movie",
                  0,
                ],
              },
            ],
          },
        },
      },

      {
        $match: {
          effectiveMovie: {
            $ne:
              null,
          },
        },
      },

      {
        $group: {
          _id:
            "$effectiveMovie",

          bookings: {
            $sum: 1,
          },

          tickets: {
            $sum:
              getTicketCountExpression(),
          },

          revenue: {
            $sum: {
              $ifNull: [
                "$totalAmount",
                0,
              ],
            },
          },
        },
      },

      {
        $sort: {
          revenue: -1,
          tickets: -1,
        },
      },

      {
        $limit:
          limit,
      },

      {
        $lookup: {
          from:
            "movies",

          localField:
            "_id",

          foreignField:
            "_id",

          as:
            "movie",
        },
      },

      {
        $unwind: {
          path:
            "$movie",

          preserveNullAndEmptyArrays:
            true,
        },
      },

      {
        $project: {
          _id: 1,

          title: {
            $ifNull: [
              "$movie.title",
              "Unknown Movie",
            ],
          },

          poster:
            "$movie.poster",

          genre:
            "$movie.genre",

          language:
            "$movie.language",

          avgRating:
            "$movie.avgRating",

          bookings: 1,
          tickets: 1,
          revenue: 1,
        },
      },
    ]);
  };

// =====================================================
// REVENUE TREND
// =====================================================

const getRevenueTrend =
  async (
    now
  ) => {
    const sixMonthsAgo =
      new Date(
        now.getFullYear(),
        now.getMonth() -
          5,
        1
      );

    const monthlyRevenue =
      await Booking.aggregate([
        {
          $match: {
            status:
              "CONFIRMED",

            createdAt: {
              $gte:
                sixMonthsAgo,
            },
          },
        },

        {
          $group: {
            _id: {
              year: {
                $year: {
                  date:
                    "$createdAt",

                  timezone:
                    CINEMA_TIMEZONE,
                },
              },

              month: {
                $month: {
                  date:
                    "$createdAt",

                  timezone:
                    CINEMA_TIMEZONE,
                },
              },
            },

            revenue: {
              $sum: {
                $ifNull: [
                  "$totalAmount",
                  0,
                ],
              },
            },

            bookings: {
              $sum: 1,
            },

            tickets: {
              $sum:
                getTicketCountExpression(),
            },
          },
        },

        {
          $sort: {
            "_id.year":
              1,

            "_id.month":
              1,
          },
        },
      ]);

    const revenueMap =
      new Map();

    monthlyRevenue.forEach(
      (item) => {
        const key =
          `${item._id.year}-${item._id.month}`;

        revenueMap.set(
          key,
          item
        );
      }
    );

    const trend = [];

    for (
      let offset = 5;
      offset >= 0;
      offset--
    ) {
      const date =
        new Date(
          now.getFullYear(),
          now.getMonth() -
            offset,
          1
        );

      const year =
        date.getFullYear();

      const month =
        date.getMonth() +
        1;

      const item =
        revenueMap.get(
          `${year}-${month}`
        );

      trend.push({
        year,

        month,

        label:
          date.toLocaleString(
            "en-IN",
            {
              month:
                "short",
            }
          ),

        revenue:
          item?.revenue ||
          0,

        bookings:
          item?.bookings ||
          0,

        tickets:
          item?.tickets ||
          0,
      });
    }

    return trend;
  };

// =====================================================
// TIME SLOT PERFORMANCE
//
// Uses the actual Show startTime attached to each
// confirmed booking.
// =====================================================

const getTimeSlotPerformance =
  async () => {
    const rows =
      await Booking.aggregate([
        {
          $match: {
            status:
              "CONFIRMED",

            show: {
              $ne:
                null,
            },
          },
        },

        {
          $lookup: {
            from:
              "shows",

            localField:
              "show",

            foreignField:
              "_id",

            as:
              "show",
          },
        },

        {
          $unwind: {
            path:
              "$show",

            preserveNullAndEmptyArrays:
              false,
          },
        },

        {
          $group: {
            _id: {
              $hour: {
                date:
                  "$show.startTime",

                timezone:
                  CINEMA_TIMEZONE,
              },
            },

            bookings: {
              $sum: 1,
            },

            tickets: {
              $sum:
                getTicketCountExpression(),
            },

            revenue: {
              $sum: {
                $ifNull: [
                  "$totalAmount",
                  0,
                ],
              },
            },
          },
        },

        {
          $sort: {
            revenue: -1,
          },
        },
      ]);

    const formatHour = (
      hour
    ) => {
      const date =
        new Date();

      date.setHours(
        Number(hour),
        0,
        0,
        0
      );

      return date.toLocaleTimeString(
        "en-IN",
        {
          hour:
            "numeric",

          minute:
            "2-digit",
        }
      );
    };

    return rows.map(
      (item) => ({
        hour:
          item._id,

        label:
          formatHour(
            item._id
          ),

        bookings:
          item.bookings,

        tickets:
          item.tickets,

        revenue:
          item.revenue,
      })
    );
  };

// =====================================================
// UPCOMING SHOW OCCUPANCY
//
// Looks at the next seven days.
//
// Occupancy is based ONLY on confirmed Booking seats.
// Refunded/cancelled/pending bookings do not count.
// =====================================================

const getUpcomingPerformance =
  async (
    now
  ) => {
    const sevenDaysLater =
      new Date(
        now.getTime() +
          7 *
            24 *
            60 *
            60 *
            1000
      );

    const shows =
      await Show.find({
        status:
          "SCHEDULED",

        isActive:
          true,

        startTime: {
          $gte:
            now,

          $lte:
            sevenDaysLater,
        },
      })
        .populate(
          "movie",
          "title poster genre"
        )
        .populate(
          "theatre",
          "name city"
        )
        .populate(
          "screen",
          "name screenNumber totalSeats"
        )
        .sort({
          startTime: 1,
        })
        .lean();

    if (
      !shows.length
    ) {
      return [];
    }

    const showIds =
      shows.map(
        (show) =>
          show._id
      );

    const bookingStats =
      await Booking.aggregate([
        {
          $match: {
            status:
              "CONFIRMED",

            show: {
              $in:
                showIds,
            },
          },
        },

        {
          $group: {
            _id:
              "$show",

            bookings: {
              $sum: 1,
            },

            tickets: {
              $sum:
                getTicketCountExpression(),
            },

            revenue: {
              $sum: {
                $ifNull: [
                  "$totalAmount",
                  0,
                ],
              },
            },
          },
        },
      ]);

    const statsMap =
      new Map(
        bookingStats.map(
          (item) => [
            String(
              item._id
            ),

            item,
          ]
        )
      );

    return shows.map(
      (show) => {
        const stats =
          statsMap.get(
            String(
              show._id
            )
          ) || {
            bookings:
              0,

            tickets:
              0,

            revenue:
              0,
          };

        const capacity =
          Number(
            show.screen
              ?.totalSeats ||
            0
          );

        const occupancy =
          capacity > 0
            ? round(
                (
                  Number(
                    stats.tickets ||
                    0
                  ) /
                  capacity
                ) *
                  100,
                1
              )
            : 0;

        return {
          showId:
            show._id,

          movie:
            show.movie
              ?.title ||
            "Unknown Movie",

          theatre:
            show.theatre
              ?.name ||
            "Unknown Cinema",

          city:
            show.theatre
              ?.city ||
            "",

          screen:
            show.screen
              ?.name ||
            (
              show.screen
                ?.screenNumber
                ? `Screen ${show.screen.screenNumber}`
                : "Screen"
            ),

          startTime:
            show.startTime,

          language:
            show.language,

          format:
            show.format,

          capacity,

          ticketsSold:
            Number(
              stats.tickets ||
              0
            ),

          bookings:
            Number(
              stats.bookings ||
              0
            ),

          revenue:
            Number(
              stats.revenue ||
              0
            ),

          occupancy,
        };
      }
    );
  };

// =====================================================
// BUILD COMPLETE ANALYTICS SNAPSHOT
//
// Shared by:
// GET /api/admin/analytics
// POST /api/admin/analytics/ai-insights
// =====================================================

const buildAnalyticsSnapshot =
  async () => {
    const now =
      new Date();

    const thirtyDaysAgo =
      new Date(
        now.getTime() -
          30 *
            24 *
            60 *
            60 *
            1000
      );

    const [
      statusBreakdown,
      confirmedStats,
      refundedCount,
      revenueTrend,
      topMovies,
      recentTopMovies,
      timeSlotPerformance,
      upcomingShows,
    ] =
      await Promise.all([
        Booking.aggregate([
          {
            $group: {
              _id:
                "$status",

              count: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },
        ]),

        Booking.aggregate([
          {
            $match: {
              status:
                "CONFIRMED",
            },
          },

          {
            $group: {
              _id:
                null,

              revenue: {
                $sum: {
                  $ifNull: [
                    "$totalAmount",
                    0,
                  ],
                },
              },

              bookings: {
                $sum: 1,
              },

              averageOrderValue: {
                $avg: {
                  $ifNull: [
                    "$totalAmount",
                    0,
                  ],
                },
              },

              tickets: {
                $sum:
                  getTicketCountExpression(),
              },
            },
          },
        ]),

        Booking.countDocuments({
          status:
            "REFUNDED",
        }),

        getRevenueTrend(
          now
        ),

        getTopMovies({
          limit: 8,
        }),

        getTopMovies({
          fromDate:
            thirtyDaysAgo,

          limit: 8,
        }),

        getTimeSlotPerformance(),

        getUpcomingPerformance(
          now
        ),
      ]);

    const summary =
      confirmedStats[0] || {
        revenue:
          0,

        bookings:
          0,

        averageOrderValue:
          0,

        tickets:
          0,
      };

    const completedBookings =
      Number(
        summary.bookings ||
        0
      ) +
      Number(
        refundedCount ||
        0
      );

    const refundRate =
      completedBookings > 0
        ? round(
            (
              refundedCount /
              completedBookings
            ) *
              100,
            1
          )
        : 0;

    const occupancyValues =
      upcomingShows
        .filter(
          (show) =>
            show.capacity >
            0
        )
        .map(
          (show) =>
            show.occupancy
        );

    const averageUpcomingOccupancy =
      occupancyValues.length
        ? round(
            occupancyValues.reduce(
              (
                total,
                value
              ) =>
                total +
                value,
              0
            ) /
              occupancyValues.length,
            1
          )
        : 0;

    const lowOccupancyShows =
      [...upcomingShows]
        .filter(
          (show) =>
            show.capacity >
            0
        )
        .sort(
          (
            first,
            second
          ) =>
            first.occupancy -
            second.occupancy
        )
        .slice(
          0,
          8
        );

    const highOccupancyShows =
      [...upcomingShows]
        .filter(
          (show) =>
            show.capacity >
            0
        )
        .sort(
          (
            first,
            second
          ) =>
            second.occupancy -
            first.occupancy
        )
        .slice(
          0,
          8
        );

    return {
      generatedAt:
        now,

      summary: {
        revenue:
          Number(
            summary.revenue ||
            0
          ),

        confirmedBookings:
          Number(
            summary.bookings ||
            0
          ),

        ticketsSold:
          Number(
            summary.tickets ||
            0
          ),

        averageOrderValue:
          Math.round(
            summary.averageOrderValue ||
            0
          ),

        refundedBookings:
          refundedCount,

        refundRate,

        upcomingShows:
          upcomingShows.length,

        averageUpcomingOccupancy,
      },

      statusBreakdown:
        statusBreakdown.map(
          (item) => ({
            status:
              item._id ||
              "UNKNOWN",

            count:
              item.count,
          })
        ),

      revenueTrend,

      topMovies,

      recentTopMovies,

      timeSlotPerformance,

      upcomingShows,

      lowOccupancyShows,

      highOccupancyShows,
    };
  };

// =====================================================
// FALLBACK ADMIN INSIGHT
//
// Allows the page to remain useful if Groq is
// temporarily unavailable.
// =====================================================

const buildFallbackInsight =
  (
    question,
    analytics
  ) => {
    const q =
      String(
        question ||
        ""
      ).toLowerCase();

    const topMovie =
      analytics
        .recentTopMovies?.[0] ||
      analytics
        .topMovies?.[0];

    const bestSlot =
      analytics
        .timeSlotPerformance?.[0];

    const weakest =
      analytics
        .lowOccupancyShows?.[0];

    if (
      q.includes(
        "movie"
      ) &&
      (
        q.includes(
          "best"
        ) ||
        q.includes(
          "perform"
        ) ||
        q.includes(
          "schedule"
        )
      )
    ) {
      if (
        !topMovie
      ) {
        return "There is not enough confirmed booking data yet to identify a best-performing movie.";
      }

      return `${topMovie.title} currently leads the available booking data with ${topMovie.tickets} tickets and ₹${Number(
        topMovie.revenue ||
          0
      ).toLocaleString(
        "en-IN"
      )} in confirmed revenue. Treat this as an observed performance signal, not a guarantee of future demand.`;
    }

    if (
      q.includes(
        "occupancy"
      ) ||
      q.includes(
        "weak"
      )
    ) {
      if (
        !weakest
      ) {
        return "There are no upcoming scheduled shows with usable capacity data in the next seven days.";
      }

      return `${weakest.movie} at ${new Date(
        weakest.startTime
      ).toLocaleString(
        "en-IN"
      )} currently has the lowest upcoming occupancy in the available data at ${weakest.occupancy}%.`;
    }

    if (
      q.includes(
        "time"
      ) ||
      q.includes(
        "slot"
      )
    ) {
      if (
        !bestSlot
      ) {
        return "There is not enough confirmed booking data yet to compare showtime performance.";
      }

      return `${bestSlot.label} is currently the strongest recorded time slot by confirmed revenue: ₹${Number(
        bestSlot.revenue ||
          0
      ).toLocaleString(
        "en-IN"
      )} from ${bestSlot.bookings} bookings.`;
    }

    return `BookMySeat currently has ₹${Number(
      analytics.summary
        .revenue ||
        0
    ).toLocaleString(
      "en-IN"
    )} in confirmed revenue, ${analytics.summary.confirmedBookings} confirmed bookings and ${analytics.summary.ticketsSold} tickets sold. Upcoming seven-day average occupancy is ${analytics.summary.averageUpcomingOccupancy}%.`;
  };

// =====================================================
// GROQ ADMIN INSIGHT
//
// AI receives compact server-generated analytics.
// It does NOT receive trusted metrics from frontend.
// =====================================================

const generateAdminInsight =
  async ({
    question,
    analytics,
  }) => {
    const fallback =
      buildFallbackInsight(
        question,
        analytics
      );

    if (
      !process.env
        .GROQ_API_KEY
    ) {
      return {
        answer:
          fallback,

        aiUsed:
          false,
      };
    }

    // -------------------------------------------------
    // Keep prompt compact and relevant.
    // -------------------------------------------------

    const snapshot = {
      generatedAt:
        analytics.generatedAt,

      summary:
        analytics.summary,

      revenueTrend:
        analytics.revenueTrend,

      topMovies:
        analytics.topMovies
          .slice(
            0,
            8
          ),

      recentTopMovies:
        analytics.recentTopMovies
          .slice(
            0,
            8
          ),

      timeSlotPerformance:
        analytics.timeSlotPerformance
          .slice(
            0,
            8
          ),

      lowOccupancyShows:
        analytics.lowOccupancyShows
          .slice(
            0,
            8
          ),

      highOccupancyShows:
        analytics.highOccupancyShows
          .slice(
            0,
            8
          ),
    };

    try {
      const response =
        await fetch(
          "https://api.groq.com/openai/v1/chat/completions",

          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${process.env.GROQ_API_KEY}`,
            },

            body:
              JSON.stringify({
                model:
                  process.env
                    .GROQ_MODEL ||
                  "openai/gpt-oss-20b",

                temperature:
                  0.2,

                messages: [
                  {
                    role:
                      "system",

                    content: `
You are the internal analytics assistant for BookMySeat cinema administrators.

Your job is to answer operational questions using ONLY the supplied BookMySeat analytics snapshot.

STRICT RULES:
- Never invent bookings, revenue, occupancy, movies, showtimes or trends.
- Never use outside industry statistics.
- Never pretend a correlation proves causation.
- If data is insufficient, explicitly say so.
- Distinguish historical confirmed-booking performance from upcoming occupancy.
- "Revenue" means confirmed booking revenue in the supplied data.
- Refunded/cancelled/pending bookings are not counted as confirmed revenue.
- Upcoming occupancy is confirmed tickets divided by screen capacity.
- Recommendations should be phrased as evidence-based suggestions, not guarantees.
- If asked what to schedule more, use recent movie performance, revenue, tickets, occupancy and time slots when available.
- If there is little or no real booking data, say that clearly rather than producing a recommendation.
- Keep the response concise and practical.
- Usually use 2-5 short paragraphs or bullets.
- Do not output markdown tables.

BookMySeat analytics snapshot:

${JSON.stringify(
  snapshot
)}
`,
                  },

                  {
                    role:
                      "user",

                    content:
                      question,
                  },
                ],
              }),
          }
        );

      const body =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          body?.error
            ?.message ||
            "Groq analytics request failed."
        );
      }

      const answer =
        body?.choices?.[0]
          ?.message
          ?.content
          ?.trim();

      if (
        !answer
      ) {
        throw new Error(
          "Groq returned an empty analytics response."
        );
      }

      return {
        answer:
          answer.slice(
            0,
            2500
          ),

        aiUsed:
          true,
      };
    } catch (
      error
    ) {
      console.error(
        "Admin AI insight error:",
        error.message
      );

      return {
        answer:
          fallback,

        aiUsed:
          false,
      };
    }
  };

// =====================================================
// GET /api/admin/analytics
// =====================================================

router.get(
  "/",

  async (
    req,
    res
  ) => {
    try {
      const analytics =
        await buildAnalyticsSnapshot();

      return res.json({
        success:
          true,

        ...analytics,
      });
    } catch (
      error
    ) {
      console.error(
        "Admin analytics error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to load analytics.",
        });
    }
  }
);

// =====================================================
// POST /api/admin/analytics/ai-insights
//
// Admin asks:
// "Which movies perform best?"
// "What shows have weak occupancy?"
// "What should we schedule more?"
// etc.
// =====================================================

router.post(
  "/ai-insights",

  async (
    req,
    res
  ) => {
    try {
      const question =
        String(
          req.body
            ?.question ||
          ""
        ).trim();

      if (
        !question
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Question is required.",
          });
      }

      if (
        question.length >
        MAX_AI_QUESTION_LENGTH
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Question is too long.",
          });
      }

      // IMPORTANT:
      // All analytics are regenerated server-side.
      // Frontend cannot supply fake metrics to Groq.
      const analytics =
        await buildAnalyticsSnapshot();

      const insight =
        await generateAdminInsight({
          question,
          analytics,
        });

      return res.json({
        success:
          true,

        answer:
          insight.answer,

        aiUsed:
          insight.aiUsed,

        generatedAt:
          analytics.generatedAt,

        groundedIn: {
          confirmedBookings:
            analytics.summary
              .confirmedBookings,

          ticketsSold:
            analytics.summary
              .ticketsSold,

          upcomingShows:
            analytics.summary
              .upcomingShows,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "Admin AI insights:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to generate AI insight.",
        });
    }
  }
);

module.exports =
  router;