import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  Clock,
  MapPin,
  RefreshCw,
  Ticket,
  X,
} from "lucide-react";

import {
  QRCodeSVG,
} from "qrcode.react";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

// =====================================================
// HELPERS
// =====================================================

const statusLabel = (
  status
) =>
  String(
    status ||
      "UNKNOWN"
  ).replaceAll(
    "_",
    " "
  );

const statusClass = (
  status
) => {
  switch (
    status
  ) {
    case "CONFIRMED":
      return "text-green-400";

    case "PENDING_PAYMENT":
      return "text-yellow-400";

    case "REFUND_PENDING":
      return "text-purple-400";

    case "REFUNDED":
      return "text-blue-400";

    case "CANCELLED":
    case "PAYMENT_FAILED":
    case "EXPIRED":
      return "text-red-400";

    default:
      return "text-zinc-400";
  }
};

const formatDate = (
  value
) => {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      weekday:
        "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(value)
  );
};

const formatTime = (
  value
) => {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      hour:
        "numeric",
      minute:
        "2-digit",
    }
  ).format(
    new Date(value)
  );
};

const bookingCode = (
  booking
) =>
  booking.bookingCode ||
  booking.bookingReference ||
  String(
    booking._id ||
      ""
  ).slice(-8);

// =====================================================
// PAGE
// =====================================================

const MyBookings =
  () => {
    const {
      token,
      isAuthenticated,
      loading:
        authLoading,
    } =
      useAuth();

    const navigate =
      useNavigate();

    const [
      bookings,
      setBookings,
    ] =
      useState([]);

    const [
      loading,
      setLoading,
    ] =
      useState(true);

    const [
      statusFilter,
      setStatusFilter,
    ] =
      useState("ALL");

    const [
      selectedBooking,
      setSelectedBooking,
    ] =
      useState(null);

    const [
      reason,
      setReason,
    ] =
      useState("");

    const [
      cancelling,
      setCancelling,
    ] =
      useState(false);

    // =================================================
    // AUTH
    // =================================================

    useEffect(() => {
      if (
        authLoading
      ) {
        return;
      }

      if (
        !isAuthenticated
      ) {
        navigate(
          "/auth"
        );
      }
    }, [
      authLoading,
      isAuthenticated,
      navigate,
    ]);

    // =================================================
    // LOAD
    // =================================================

    const fetchBookings =
      async () => {
        if (!token) {
          return;
        }

        setLoading(
          true
        );

        try {
          const response =
            await axios.get(
              `${API_URL}/api/customer-bookings`,

              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          setBookings(
            response.data
              ?.bookings ||
              []
          );
        } catch (error) {
          console.error(
            "My bookings:",
            error
          );

          toast.error(
            error.response
              ?.data
              ?.message ||
              "Could not load bookings."
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    useEffect(() => {
      fetchBookings();
    }, [token]);

    // =================================================
    // FILTER
    // =================================================

    const visibleBookings =
      useMemo(() => {
        if (
          statusFilter ===
          "ALL"
        ) {
          return bookings;
        }

        return bookings.filter(
          (booking) =>
            booking.status ===
            statusFilter
        );
      }, [
        bookings,
        statusFilter,
      ]);

    const statuses =
      useMemo(() => {
        return [
          "ALL",

          ...new Set(
            bookings
              .map(
                (booking) =>
                  booking.status
              )
              .filter(
                Boolean
              )
          ),
        ];
      }, [bookings]);

    // =================================================
    // OPEN CANCELLATION
    // =================================================

    const openCancel =
      (booking) => {
        setSelectedBooking(
          booking
        );

        setReason("");
      };

    const closeCancel =
      () => {
        if (
          cancelling
        ) {
          return;
        }

        setSelectedBooking(
          null
        );

        setReason("");
      };

    // =================================================
    // CANCEL / REFUND
    // =================================================

    const confirmCancel =
      async () => {
        if (
          !selectedBooking
        ) {
          return;
        }

        setCancelling(
          true
        );

        try {
          const response =
            await axios.post(
              `${API_URL}/api/customer-bookings/${selectedBooking._id}/cancel`,

              {
                reason:
                  reason.trim() ||
                  "Cancelled by customer",
              },

              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          toast.success(
            response.data
              ?.message ||
              "Booking updated."
          );

          setSelectedBooking(
            null
          );

          setReason("");

          await fetchBookings();
        } catch (error) {
          console.error(
            "Cancel booking:",
            error
          );

          toast.error(
            error.response
              ?.data
              ?.message ||
              "Could not cancel booking."
          );
        } finally {
          setCancelling(
            false
          );
        }
      };

    // =================================================
    // LOADING
    // =================================================

    if (
      authLoading ||
      loading
    ) {
      return (
        <div className="flex min-h-screen items-center justify-center pt-20">
          <p className="text-zinc-500">
            Loading bookings...
          </p>
        </div>
      );
    }

    // =================================================
    // PAGE
    // =================================================

    return (
      <div className="min-h-screen pb-20 pt-24">

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

          {/* HEADER */}

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

            <div>

              <h1 className="text-4xl font-bold">
                My Bookings
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                Tickets, payments, cancellations and refunds.
              </p>

            </div>

            <button
              onClick={
                fetchBookings
              }
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" />

              Refresh
            </button>

          </div>

          {/* FILTERS */}

          <div className="mt-8 flex flex-wrap gap-2">

            {statuses.map(
              (status) => (
                <button
                  key={
                    status
                  }
                  onClick={() =>
                    setStatusFilter(
                      status
                    )
                  }
                  className={`rounded-lg border px-4 py-2 text-xs ${
                    statusFilter ===
                    status
                      ? "border-red-500 bg-red-600 text-white"
                      : "border-white/10 text-zinc-400"
                  }`}
                >
                  {status ===
                  "ALL"
                    ? "All"
                    : statusLabel(
                        status
                      )}
                </button>
              )
            )}

          </div>

          {/* EMPTY */}

          {visibleBookings.length ===
          0 ? (
            <div className="mt-10 rounded-xl border border-white/10 py-20 text-center">

              <Ticket className="mx-auto h-10 w-10 text-zinc-700" />

              <p className="mt-4 text-zinc-500">
                No bookings found.
              </p>

            </div>
          ) : (
            <div className="mt-8 space-y-5">

              {visibleBookings.map(
                (booking) => {
                  const show =
                    booking.show;

                  const movie =
                    booking.movie ||
                    show?.movie;

                  const theatre =
                    show?.theatre;

                  const screen =
                    show?.screen;

                  const showActive =
                    booking.status ===
                    "CONFIRMED";

                  return (
                    <div
                      key={
                        booking._id
                      }
                      className="rounded-xl border border-white/10 bg-zinc-900 p-5"
                    >

                      <div className="flex flex-col gap-6 lg:flex-row">

                        {/* POSTER */}

                        {movie?.poster && (
                          <img
                            src={
                              movie.poster
                            }
                            alt={
                              movie.title
                            }
                            className="h-40 w-28 rounded-lg object-cover"
                          />
                        )}

                        {/* INFO */}

                        <div className="min-w-0 flex-1">

                          <div className="flex flex-wrap items-center gap-3">

                            <h2 className="text-xl font-semibold">
                              {movie?.title ||
                                "Movie"}
                            </h2>

                            <span
                              className={`text-xs font-semibold ${statusClass(
                                booking.status
                              )}`}
                            >
                              {statusLabel(
                                booking.status
                              )}
                            </span>

                            {booking.ticketUsed && (
                              <span className="text-xs font-semibold text-purple-400">
                                USED
                              </span>
                            )}

                          </div>

                          <p className="mt-2 font-mono text-xs text-zinc-600">
                            #
                            {bookingCode(
                              booking
                            )}
                          </p>

                          <div className="mt-5 grid gap-4 sm:grid-cols-2">

                            <Info
                              icon={
                                MapPin
                              }
                              label="Cinema"
                              value={`${theatre?.name || "—"}${
                                screen?.name
                                  ? ` • ${screen.name}`
                                  : ""
                              }`}
                            />

                            <Info
                              icon={
                                CalendarDays
                              }
                              label="Date"
                              value={formatDate(
                                show?.startTime
                              )}
                            />

                            <Info
                              icon={
                                Clock
                              }
                              label="Time"
                              value={formatTime(
                                show?.startTime
                              )}
                            />

                            <Info
                              icon={
                                Ticket
                              }
                              label="Seats"
                              value={
                                booking.seats
                                  ?.join(
                                    ", "
                                  ) ||
                                "—"
                              }
                            />

                          </div>

                          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">

                            <span className="text-sm text-zinc-500">
                              Total
                            </span>

                            <span className="text-xl font-bold">
                              ₹
                              {Number(
                                booking.totalAmount ||
                                  0
                              ).toLocaleString(
                                "en-IN"
                              )}
                            </span>

                          </div>

                          {/* CANCELLATION */}

                          {booking
                            .cancellation
                            ?.canCancel ? (
                            <button
                              onClick={() =>
                                openCancel(
                                  booking
                                )
                              }
                              className="mt-5 rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400"
                            >
                              {booking
                                .cancellation
                                .action ===
                              "REFUND"
                                ? "Cancel & Refund"
                                : "Cancel Booking"}
                            </button>
                          ) : booking
                              .cancellation
                              ?.reason ? (
                            <p className="mt-4 text-xs text-zinc-600">
                              {
                                booking
                                  .cancellation
                                  .reason
                              }
                            </p>
                          ) : null}

                        </div>

                        {/* QR */}

                        {showActive &&
                          booking.qrToken && (
                            <div className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-white p-4">

                              <QRCodeSVG
                                value={`BMS1:${booking.qrToken}`}
                                size={130}
                              />

                              <p className="mt-2 text-xs font-semibold text-black">
                                Entry Ticket
                              </p>

                            </div>
                          )}

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>

        {/* ===========================================
            CANCEL MODAL
        ============================================ */}

        {selectedBooking && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">

            <div className="w-full max-w-lg rounded-xl border border-white/10 bg-zinc-950 p-6">

              <div className="flex items-start justify-between">

                <div>

                  <h2 className="text-xl font-semibold">
                    {selectedBooking
                      .cancellation
                      ?.action ===
                    "REFUND"
                      ? "Cancel & Refund"
                      : "Cancel Booking"}
                  </h2>

                  <p className="mt-2 text-sm text-zinc-500">
                    #
                    {bookingCode(
                      selectedBooking
                    )}
                  </p>

                </div>

                <button
                  onClick={
                    closeCancel
                  }
                  className="text-zinc-500"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              {selectedBooking
                .cancellation
                ?.action ===
              "REFUND" ? (
                <div className="mt-5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">

                  <p className="text-sm text-zinc-400">
                    The full amount of{" "}
                    <strong className="text-white">
                      ₹
                      {Number(
                        selectedBooking.totalAmount ||
                          0
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </strong>{" "}
                    will be refunded through Stripe.
                  </p>

                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">

                  <p className="text-sm text-zinc-400">
                    This unpaid booking and its seat reservation will be cancelled.
                  </p>

                </div>
              )}

              <label className="mt-6 block text-sm text-zinc-400">
                Reason
              </label>

              <textarea
                value={reason}
                onChange={(
                  event
                ) =>
                  setReason(
                    event.target.value
                  )
                }
                rows={4}
                maxLength={500}
                placeholder="Why are you cancelling?"
                className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 outline-none focus:border-red-500"
              />

              <div className="mt-6 grid grid-cols-2 gap-3">

                <button
                  disabled={
                    cancelling
                  }
                  onClick={
                    closeCancel
                  }
                  className="rounded-lg border border-white/10 py-3 text-sm"
                >
                  Go Back
                </button>

                <button
                  disabled={
                    cancelling
                  }
                  onClick={
                    confirmCancel
                  }
                  className="rounded-lg bg-red-600 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {cancelling
                    ? "Processing..."
                    : "Confirm"}
                </button>

              </div>

            </div>

          </div>
        )}

      </div>
    );
  };

// =====================================================
// INFO COMPONENT
// =====================================================

const Info = ({
  icon: Icon,
  label,
  value,
}) => (
  <div>

    <div className="flex items-center gap-2 text-xs text-zinc-600">

      <Icon className="h-4 w-4" />

      {label}

    </div>

    <p className="mt-1 text-sm text-zinc-300">
      {value}
    </p>

  </div>
);

export default MyBookings;