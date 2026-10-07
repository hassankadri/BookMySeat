import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BarChart3,
  Bot,
  Clock3,
  Gauge,
  IndianRupee,
  RefreshCw,
  Send,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import {
  motion,
} from "framer-motion";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useAuth,
} from "../../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

// =====================================================
// HELPERS
// =====================================================

const formatCurrency = (
  value
) =>
  `₹${Number(
    value ||
    0
  ).toLocaleString(
    "en-IN"
  )}`;

const formatShowDate = (
  value
) => {
  if (!value) {
    return "";
  }

  return new Date(
    value
  ).toLocaleString(
    "en-IN",
    {
      day:
        "numeric",

      month:
        "short",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  );
};

const QUICK_QUESTIONS = [
  "Give me a performance summary",
  "Which movies are performing best?",
  "Which upcoming shows have weak occupancy?",
  "What time slots generate the most revenue?",
  "What should I consider scheduling more often?",
];

// =====================================================
// ADMIN ANALYTICS
// =====================================================

const AdminAnalytics =
  () => {
    const {
      token,
    } =
      useAuth();

    const [
      data,
      setData,
    ] =
      useState(
        null
      );

    const [
      loading,
      setLoading,
    ] =
      useState(
        true
      );

    const [
      question,
      setQuestion,
    ] =
      useState("");

    const [
      aiLoading,
      setAiLoading,
    ] =
      useState(
        false
      );

    const [
      aiMessages,
      setAiMessages,
    ] =
      useState([]);

    // =================================================
    // AUTH
    // =================================================

    const headers = {
      Authorization:
        `Bearer ${token}`,
    };

    // =================================================
    // LOAD ANALYTICS
    // =================================================

    const fetchAnalytics =
      async () => {
        if (
          !token
        ) {
          return;
        }

        setLoading(
          true
        );

        try {
          const response =
            await axios.get(
              `${API_URL}/api/admin/analytics`,

              {
                headers,
              }
            );

          setData(
            response.data
          );
        } catch (
          error
        ) {
          console.error(
            "Analytics error:",
            error
          );

          toast.error(
            error.response
              ?.data
              ?.error ||
              "Could not load analytics."
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    useEffect(() => {
      fetchAnalytics();
    }, [token]);

    // =================================================
    // MAX REVENUE
    // =================================================

    const maxRevenue =
      useMemo(
        () => {
          if (
            !data
              ?.revenueTrend
              ?.length
          ) {
            return 1;
          }

          return Math.max(
            ...data.revenueTrend.map(
              (
                item
              ) =>
                item.revenue
            ),

            1
          );
        },
        [data]
      );

    // =================================================
    // AI INSIGHTS
    // =================================================

    const askAI =
      async (
        rawQuestion
      ) => {
        const value =
          String(
            rawQuestion ||
            question
          ).trim();

        if (
          !value ||
          aiLoading
        ) {
          return;
        }

        setQuestion("");

        setAiMessages(
          (
            current
          ) => [
            ...current,

            {
              role:
                "user",

              text:
                value,
            },
          ]
        );

        setAiLoading(
          true
        );

        try {
          const response =
            await axios.post(
              `${API_URL}/api/admin/analytics/ai-insights`,

              {
                question:
                  value,
              },

              {
                headers,
              }
            );

          setAiMessages(
            (
              current
            ) => [
              ...current,

              {
                role:
                  "assistant",

                text:
                  response
                    .data
                    ?.answer ||
                  "No insight returned.",

                aiUsed:
                  response
                    .data
                    ?.aiUsed,

                groundedIn:
                  response
                    .data
                    ?.groundedIn,
              },
            ]
          );
        } catch (
          error
        ) {
          console.error(
            "AI analytics:",
            error
          );

          const message =
            error.response
              ?.data
              ?.error ||
            "Could not generate insight.";

          setAiMessages(
            (
              current
            ) => [
              ...current,

              {
                role:
                  "assistant",

                text:
                  message,

                error:
                  true,
              },
            ]
          );

          toast.error(
            message
          );
        } finally {
          setAiLoading(
            false
          );
        }
      };

    const submitAI =
      (
        event
      ) => {
        event.preventDefault();

        askAI(
          question
        );
      };

    // =================================================
    // LOADING
    // =================================================

    if (
      loading
    ) {
      return (
        <div className="py-24 text-center text-zinc-500">
          Loading analytics...
        </div>
      );
    }

    const summary =
      data?.summary ||
      {};

    const upcoming =
      data
        ?.upcomingShows ||
      [];

    const lowOccupancy =
      data
        ?.lowOccupancyShows ||
      [];

    // =================================================
    // UI
    // =================================================

    return (
      <div>

        {/* =============================================
            HEADER
        ============================================== */}

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

          <div>

            <p className="text-sm uppercase tracking-[0.3em] text-red-500">
              Insights
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Analytics
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Revenue, bookings, occupancy and AI-assisted cinema insights.
            </p>

          </div>

          <button
            type="button"
            onClick={
              fetchAnalytics
            }
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-400"
          >

            <RefreshCw className="h-4 w-4" />

            Refresh

          </button>

        </div>

        {/* =============================================
            SUMMARY
        ============================================== */}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <Stat
            title="Revenue"
            value={
              formatCurrency(
                summary.revenue
              )
            }
            icon={
              IndianRupee
            }
          />

          <Stat
            title="Confirmed"
            value={
              summary.confirmedBookings ||
              0
            }
            icon={
              Ticket
            }
          />

          <Stat
            title="Tickets Sold"
            value={
              summary.ticketsSold ||
              0
            }
            icon={
              Users
            }
          />

          <Stat
            title="Avg. Booking"
            value={
              formatCurrency(
                summary.averageOrderValue
              )
            }
            icon={
              TrendingUp
            }
          />

          <Stat
            title="Refund Rate"
            value={`${Number(
              summary.refundRate ||
                0
            )}%`}
            icon={
              RefreshCw
            }
          />

        </div>

        {/* SECONDARY SUMMARY */}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">

          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">

            <div className="flex items-center gap-3">

              <Gauge className="h-5 w-5 text-red-500" />

              <div>

                <p className="text-xs text-zinc-600">
                  Upcoming 7-Day Occupancy
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {Number(
                    summary.averageUpcomingOccupancy ||
                      0
                  )}
                  %
                </p>

              </div>

            </div>

          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">

            <div className="flex items-center gap-3">

              <Clock3 className="h-5 w-5 text-red-500" />

              <div>

                <p className="text-xs text-zinc-600">
                  Upcoming Shows
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {summary.upcomingShows ||
                    0}
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* =============================================
            ADMIN AI INSIGHTS
        ============================================== */}

        <div className="mt-8 overflow-hidden rounded-2xl border border-red-500/20 bg-zinc-900/50">

          {/* HEADER */}

          <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-6 sm:flex-row sm:items-center">

            <div className="flex items-start gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10">

                <Sparkles className="h-5 w-5 text-red-500" />

              </div>

              <div>

                <h2 className="text-lg font-bold">
                  AI Cinema Analyst
                </h2>

                <p className="mt-1 text-sm text-zinc-600">
                  Ask questions grounded in real BookMySeat booking and show data.
                </p>

              </div>

            </div>

            {aiMessages.length >
              0 && (
              <button
                type="button"
                onClick={() =>
                  setAiMessages(
                    []
                  )
                }
                className="flex items-center gap-2 text-xs text-zinc-500"
              >
                <X className="h-4 w-4" />

                Clear
              </button>
            )}

          </div>

          <div className="p-6">

            {/* QUICK QUESTIONS */}

            <div className="flex flex-wrap gap-2">

              {QUICK_QUESTIONS.map(
                (
                  item
                ) => (
                  <button
                    key={
                      item
                    }
                    type="button"
                    disabled={
                      aiLoading
                    }
                    onClick={() =>
                      askAI(
                        item
                      )
                    }
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs text-zinc-400 disabled:opacity-40"
                  >
                    {
                      item
                    }
                  </button>
                )
              )}

            </div>

            {/* MESSAGES */}

            {aiMessages.length >
              0 && (
              <div className="mt-6 space-y-4">

                {aiMessages.map(
                  (
                    message,
                    index
                  ) => (
                    <div
                      key={
                        index
                      }
                      className={`flex ${
                        message.role ===
                        "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >

                      <div
                        className={`max-w-3xl rounded-xl px-4 py-3 ${
                          message.role ===
                          "user"
                            ? "bg-red-600 text-white"
                            : "border border-white/10 bg-black/30"
                        }`}
                      >

                        {message.role ===
                          "assistant" && (
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-red-400">

                            <Bot className="h-4 w-4" />

                            AI Analyst

                            {message.aiUsed ===
                              false && (
                              <span className="font-normal text-zinc-600">
                                fallback mode
                              </span>
                            )}

                          </div>
                        )}

                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {
                            message.text
                          }
                        </p>

                        {message.groundedIn && (
                          <p className="mt-3 border-t border-white/5 pt-3 text-[10px] text-zinc-600">

                            Grounded in{" "}

                            {
                              message
                                .groundedIn
                                .confirmedBookings
                            }{" "}
                            confirmed bookings,{" "}

                            {
                              message
                                .groundedIn
                                .ticketsSold
                            }{" "}
                            tickets and{" "}

                            {
                              message
                                .groundedIn
                                .upcomingShows
                            }{" "}
                            upcoming shows.

                          </p>
                        )}

                      </div>

                    </div>
                  )
                )}

                {aiLoading && (
                  <div className="flex justify-start">

                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-500">

                      <Bot className="h-4 w-4 text-red-500" />

                      Analysing BookMySeat data...

                    </div>

                  </div>
                )}

              </div>
            )}

            {/* INPUT */}

            <form
              onSubmit={
                submitAI
              }
              className="mt-6 flex gap-3"
            >

              <input
                value={
                  question
                }
                onChange={(
                  event
                ) =>
                  setQuestion(
                    event.target
                      .value
                  )
                }
                maxLength={
                  500
                }
                placeholder="Ask: which shows have weak occupancy?"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-500"
              />

              <button
                type="submit"
                disabled={
                  aiLoading ||
                  !question.trim()
                }
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>

            </form>

          </div>

        </div>

        {/* =============================================
            REVENUE GRAPH
        ============================================== */}

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-900/50 p-6">

          <div>

            <h2 className="text-lg font-bold">
              Revenue Trend
            </h2>

            <p className="mt-1 text-sm text-zinc-600">
              Confirmed revenue — last six months
            </p>

          </div>

          <div className="mt-8 flex h-64 items-end gap-3">

            {data
              ?.revenueTrend
              ?.map(
                (
                  month,
                  index
                ) => {
                  const height =
                    Math.max(
                      (
                        month.revenue /
                        maxRevenue
                      ) *
                        100,

                      month.revenue >
                        0
                        ? 6
                        : 1
                    );

                  return (
                    <div
                      key={`${month.year}-${month.month}`}
                      className="flex h-full flex-1 flex-col justify-end"
                    >

                      <motion.div
                        initial={{
                          height:
                            0,
                        }}
                        animate={{
                          height:
                            `${height}%`,
                        }}
                        transition={{
                          duration:
                            0.5,

                          delay:
                            index *
                            0.05,
                        }}
                        title={`${formatCurrency(
                          month.revenue
                        )} • ${month.bookings} bookings`}
                        className="min-h-[2px] rounded-t-xl bg-red-600/80"
                      />

                      <div className="mt-3 text-center">

                        <p className="text-xs font-medium">
                          {
                            month.label
                          }
                        </p>

                        <p className="mt-1 text-[10px] text-zinc-600">
                          {formatCurrency(
                            month.revenue
                          )}
                        </p>

                      </div>

                    </div>
                  );
                }
              )}

          </div>

        </div>

        {/* =============================================
            TOP MOVIES + STATUS
        ============================================== */}

        <div className="mt-8 grid gap-6 xl:grid-cols-2">

          {/* TOP MOVIES */}

          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">

            <div className="flex items-center gap-3">

              <BarChart3 className="h-5 w-5 text-red-500" />

              <div>

                <h2 className="text-lg font-bold">
                  Top Movies
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Confirmed revenue
                </p>

              </div>

            </div>

            <div className="mt-6 space-y-3">

              {data
                ?.topMovies
                ?.length ? (
                data.topMovies
                  .slice(
                    0,
                    5
                  )
                  .map(
                    (
                      movie,
                      index
                    ) => (
                      <div
                        key={
                          movie._id ||
                          index
                        }
                        className="flex items-center gap-4 rounded-xl bg-black/20 p-4"
                      >

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-sm font-bold text-red-500">
                          {index +
                            1}
                        </div>

                        {movie.poster && (
                          <img
                            src={
                              movie.poster
                            }
                            alt={
                              movie.title
                            }
                            className="h-14 w-10 rounded object-cover"
                          />
                        )}

                        <div className="min-w-0 flex-1">

                          <p className="truncate font-medium">
                            {
                              movie.title
                            }
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">

                            {
                              movie.bookings
                            }{" "}
                            bookings •{" "}

                            {
                              movie.tickets
                            }{" "}
                            tickets

                          </p>

                        </div>

                        <p className="font-semibold">
                          {formatCurrency(
                            movie.revenue
                          )}
                        </p>

                      </div>
                    )
                  )
              ) : (
                <p className="py-12 text-center text-sm text-zinc-600">
                  No confirmed booking data yet.
                </p>
              )}

            </div>

          </div>

          {/* STATUS */}

          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">

            <h2 className="text-lg font-bold">
              Booking Status
            </h2>

            <p className="mt-1 text-sm text-zinc-600">
              Current booking distribution
            </p>

            <div className="mt-6 space-y-3">

              {data
                ?.statusBreakdown
                ?.map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item.status
                      }
                      className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-4"
                    >

                      <span className="text-sm text-zinc-400">
                        {String(
                          item.status
                        ).replaceAll(
                          "_",
                          " "
                        )}
                      </span>

                      <span className="rounded-lg bg-white/5 px-3 py-1 text-sm font-semibold">
                        {
                          item.count
                        }
                      </span>

                    </div>
                  )
                )}

            </div>

          </div>

        </div>

        {/* =============================================
            TIME SLOT PERFORMANCE
        ============================================== */}

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-900/50 p-6">

          <div className="flex items-center gap-3">

            <Clock3 className="h-5 w-5 text-red-500" />

            <div>

              <h2 className="text-lg font-bold">
                Showtime Performance
              </h2>

              <p className="mt-1 text-sm text-zinc-600">
                Ranked by confirmed revenue
              </p>

            </div>

          </div>

          {data
            ?.timeSlotPerformance
            ?.length ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">

              {data.timeSlotPerformance
                .slice(
                  0,
                  8
                )
                .map(
                  (
                    slot,
                    index
                  ) => (
                    <div
                      key={`${slot.hour}-${index}`}
                      className="rounded-xl bg-black/20 p-4"
                    >

                      <p className="text-sm font-semibold">
                        {
                          slot.label
                        }
                      </p>

                      <p className="mt-2 text-lg font-bold">
                        {formatCurrency(
                          slot.revenue
                        )}
                      </p>

                      <p className="mt-2 text-xs text-zinc-600">

                        {
                          slot.bookings
                        }{" "}
                        bookings •{" "}

                        {
                          slot.tickets
                        }{" "}
                        tickets

                      </p>

                    </div>
                  )
                )}

            </div>
          ) : (
            <p className="py-12 text-center text-sm text-zinc-600">
              No confirmed showtime data yet.
            </p>
          )}

        </div>

        {/* =============================================
            UPCOMING OCCUPANCY
        ============================================== */}

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-900/50 p-6">

          <div className="flex items-center gap-3">

            <Gauge className="h-5 w-5 text-red-500" />

            <div>

              <h2 className="text-lg font-bold">
                Upcoming Occupancy
              </h2>

              <p className="mt-1 text-sm text-zinc-600">
                Lowest-booked scheduled shows in the next seven days
              </p>

            </div>

          </div>

          {lowOccupancy.length >
            0 ? (
            <div className="mt-6 space-y-3">

              {lowOccupancy
                .slice(
                  0,
                  6
                )
                .map(
                  (
                    show
                  ) => (
                    <div
                      key={
                        show.showId
                      }
                      className="rounded-xl bg-black/20 p-4"
                    >

                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                        <div>

                          <p className="font-medium">
                            {
                              show.movie
                            }
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">

                            {
                              show.theatre
                            }

                            {" • "}

                            {formatShowDate(
                              show.startTime
                            )}

                            {" • "}

                            {
                              show.language
                            }

                            {" • "}

                            {
                              show.format
                            }

                          </p>

                        </div>

                        <div className="text-left sm:text-right">

                          <p className="text-lg font-bold">
                            {show.occupancy}
                            %
                          </p>

                          <p className="text-xs text-zinc-600">
                            {show.ticketsSold}
                            /
                            {show.capacity}{" "}
                            seats
                          </p>

                        </div>

                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">

                        <div
                          className="h-full rounded-full bg-red-600"
                          style={{
                            width:
                              `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  show.occupancy
                                )
                              )}%`,
                          }}
                        />

                      </div>

                    </div>
                  )
                )}

            </div>
          ) : (
            <p className="py-12 text-center text-sm text-zinc-600">
              No upcoming show occupancy data yet.
            </p>
          )}

        </div>

        {upcoming.length ===
          0 && (
          <p className="mt-4 text-xs text-zinc-700">
            Occupancy analytics will appear when upcoming shows are scheduled.
          </p>
        )}

      </div>
    );
  };

// =====================================================
// STAT CARD
// =====================================================

const Stat = ({
  title,
  value,
  icon: Icon,
}) => (
  <motion.div
    initial={{
      opacity:
        0,

      y:
        15,
    }}
    animate={{
      opacity:
        1,

      y:
        0,
    }}
    className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5"
  >

    <div className="flex items-start justify-between">

      <div>

        <p className="text-xs text-zinc-600">
          {title}
        </p>

        <p className="mt-3 text-2xl font-bold">
          {value}
        </p>

      </div>

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">

        <Icon className="h-5 w-5 text-red-500" />

      </div>

    </div>

  </motion.div>
);

export default AdminAnalytics;