import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  IndianRupee,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  Ticket,
  User,
  X,
  XCircle,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useAuth,
} from "../../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const STATUSES = [
  "ALL",
  "CONFIRMED",
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
];

// =====================================================
// HELPERS
// =====================================================

const formatDate = (
  value
) => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
};

const getStatusClasses =
  (status) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-green-500/10 text-green-400 border-green-500/20";

      case "PENDING_PAYMENT":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";

      case "REFUNDED":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";

      case "REFUND_PENDING":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";

      case "CANCELLED":
      case "PAYMENT_FAILED":
      case "EXPIRED":
        return "bg-red-500/10 text-red-400 border-red-500/20";

      default:
        return "bg-zinc-800 text-zinc-400 border-white/10";
    }
  };

const friendlyStatus = (
  status
) =>
  String(status || "UNKNOWN")
    .replaceAll("_", " ");

const getBookingCode = (
  booking
) =>
  booking.bookingCode ||
  booking.bookingReference ||
  String(
    booking._id || ""
  ).slice(-8);

const isPaidBooking = (
  booking
) =>
  booking.status ===
    "CONFIRMED" ||
  booking.paymentStatus ===
    "completed" ||
  booking.payment
    ?.status === "PAID";

// =====================================================
// PAGE
// =====================================================

const AdminBookings = () => {
  const {
    token,
  } = useAuth();

  const [
    bookings,
    setBookings,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("ALL");

  const [
    selectedBooking,
    setSelectedBooking,
  ] = useState(null);

  const [
    actionType,
    setActionType,
  ] = useState(null);

  const [
    reason,
    setReason,
  ] = useState("");

  const [
    processing,
    setProcessing,
  ] = useState(false);

  // ===================================================
  // FETCH
  // ===================================================

  const fetchBookings =
    async () => {
      setLoading(true);

      try {
        const params = {
          limit: 100,
        };

        if (
          status !== "ALL"
        ) {
          params.status =
            status;
        }

        const response =
          await axios.get(
            `${API_URL}/api/admin/bookings`,
            {
              params,

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        setBookings(
          response.data
            .bookings || []
        );
      } catch (error) {
        console.error(
          "Bookings error:",
          error
        );

        toast.error(
          "Could not load bookings."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchBookings();
  }, [
    token,
    status,
  ]);

  // ===================================================
  // SEARCH
  // ===================================================

  const filteredBookings =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return bookings;
      }

      return bookings.filter(
        (booking) => {
          const values = [
            getBookingCode(
              booking
            ),

            booking.user
              ?.name,

            booking.user
              ?.email,

            booking.movie
              ?.title,

            booking.show
              ?.theatre
              ?.name,

            booking.show
              ?.screen
              ?.name,

            booking.status,

            booking.paymentStatus,

            ...(booking.seats ||
              []),
          ];

          return values
            .filter(Boolean)
            .some(
              (value) =>
                String(value)
                  .toLowerCase()
                  .includes(
                    query
                  )
            );
        }
      );
    }, [
      bookings,
      search,
    ]);

  // ===================================================
  // ACTION MODAL
  // ===================================================

  const openAction = (
    booking,
    type
  ) => {
    setSelectedBooking(
      booking
    );

    setActionType(
      type
    );

    setReason("");
  };

  const closeAction =
    () => {
      if (processing) {
        return;
      }

      setSelectedBooking(
        null
      );

      setActionType(
        null
      );

      setReason("");
    };

  // ===================================================
  // CANCEL
  // ===================================================

  const cancelBooking =
    async () => {
      if (
        !selectedBooking
      ) {
        return;
      }

      setProcessing(true);

      try {
        await axios.post(
          `${API_URL}/api/admin/bookings/${selectedBooking._id}/cancel`,

          {
            reason:
              reason.trim() ||
              "Cancelled by admin",
          },

          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        toast.success(
          "Booking cancelled."
        );

        closeAfterAction();

        await fetchBookings();
      } catch (error) {
        toast.error(
          error.response
            ?.data
            ?.error ||
            "Could not cancel booking."
        );
      } finally {
        setProcessing(false);
      }
    };

  // ===================================================
  // REFUND
  // ===================================================

  const refundBooking =
    async () => {
      if (
        !selectedBooking
      ) {
        return;
      }

      if (
        !reason.trim()
      ) {
        toast.error(
          "Enter a refund reason."
        );

        return;
      }

      setProcessing(true);

      try {
        const response =
          await axios.post(
            `${API_URL}/api/admin/bookings/${selectedBooking._id}/refund`,

            {
              reason:
                reason.trim(),
            },

            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (
          response.data
            ?.pending
        ) {
          toast.success(
            "Refund submitted to Stripe and is processing."
          );
        } else {
          toast.success(
            "Refund completed successfully."
          );
        }

        closeAfterAction();

        await fetchBookings();
      } catch (error) {
        console.error(
          "Refund error:",
          error
        );

        toast.error(
          error.response
            ?.data
            ?.error ||
            "Could not refund booking."
        );
      } finally {
        setProcessing(false);
      }
    };

  const closeAfterAction =
    () => {
      setSelectedBooking(
        null
      );

      setActionType(
        null
      );

      setReason("");
    };

  // ===================================================
  // COUNTS
  // ===================================================

  const confirmedCount =
    bookings.filter(
      (booking) =>
        booking.status ===
        "CONFIRMED"
    ).length;

  const refundedCount =
    bookings.filter(
      (booking) =>
        booking.status ===
        "REFUNDED"
    ).length;

  const visibleRevenue =
    bookings
      .filter(
        (booking) =>
          booking.status ===
          "CONFIRMED"
      )
      .reduce(
        (
          total,
          booking
        ) =>
          total +
          Number(
            booking.totalAmount ||
              0
          ),
        0
      );

  return (
    <div>

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">

        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-red-500">
            Transactions
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Bookings
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Review payments, tickets,
            cancellations and refunds.
          </p>
        </div>

        <button
          onClick={
            fetchBookings
          }
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />

          Refresh
        </button>

      </div>

      {/* MINI STATS */}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">

        <MiniStat
          label="Loaded Bookings"
          value={
            bookings.length
          }
          icon={Ticket}
        />

        <MiniStat
          label="Confirmed"
          value={
            confirmedCount
          }
          icon={
            CheckCircle2
          }
        />

        <MiniStat
          label="Visible Revenue"
          value={`₹${visibleRevenue.toLocaleString(
            "en-IN"
          )}`}
          icon={
            IndianRupee
          }
        />

      </div>

      {/* CONTROLS */}

      <div className="mt-7 flex flex-col gap-3 lg:flex-row">

        <div className="relative flex-1">

          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

          <input
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
            placeholder="Search booking, customer, movie, seat..."
            className="w-full rounded-xl border border-white/10 bg-zinc-900 py-3 pl-11 pr-4 text-sm outline-none focus:border-red-500"
          />

        </div>

        <select
          value={status}
          onChange={(
            event
          ) =>
            setStatus(
              event.target.value
            )
          }
          className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-500"
        >

          {STATUSES.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item === "ALL"
                  ? "All Statuses"
                  : friendlyStatus(
                      item
                    )}
              </option>
            )
          )}

        </select>

      </div>

      {/* LIST */}

      {loading ? (
        <div className="py-24 text-center text-zinc-500">
          Loading bookings...
        </div>
      ) : filteredBookings.length ===
        0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 py-24 text-center">

          <Ticket className="mx-auto h-10 w-10 text-zinc-700" />

          <p className="mt-4 text-zinc-500">
            No bookings found.
          </p>

        </div>
      ) : (
        <div className="mt-7 space-y-4">

          {filteredBookings.map(
            (
              booking,
              index
            ) => {
              const paid =
                isPaidBooking(
                  booking
                );

              const canRefund =
                paid &&
                booking.status !==
                  "REFUNDED" &&
                booking.status !==
                  "REFUND_PENDING";

              const canCancel =
                !paid &&
                ![
                  "CANCELLED",
                  "REFUNDED",
                  "EXPIRED",
                ].includes(
                  booking.status
                );

              return (
                <motion.div
                  key={
                    booking._id
                  }
                  initial={{
                    opacity: 0,
                    y: 15,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay:
                      Math.min(
                        index *
                          0.02,
                        0.25
                      ),
                  }}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50"
                >

                  {/* TOP */}

                  <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-start xl:justify-between">

                    {/* BOOKING */}

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-3">

                        <p className="font-mono text-sm font-semibold text-white">
                          #
                          {getBookingCode(
                            booking
                          )}
                        </p>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusClasses(
                            booking.status
                          )}`}
                        >
                          {friendlyStatus(
                            booking.status
                          )}
                        </span>

                        {booking.ticketUsed && (
                          <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[10px] font-semibold text-purple-400">
                            TICKET USED
                          </span>
                        )}

                      </div>

                      <h2 className="mt-4 text-lg font-bold">
                        {booking.movie
                          ?.title ||
                          "Unknown Movie"}
                      </h2>

                      <div className="mt-3 flex items-start gap-2 text-sm text-zinc-500">

                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />

                        <span>
                          {booking.show
                            ?.theatre
                            ?.name ||
                            "Unknown Theatre"}

                          {" • "}

                          {booking.show
                            ?.screen
                            ?.name ||
                            "Unknown Screen"}
                        </span>

                      </div>

                    </div>

                    {/* INFO */}

                    <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:max-w-[720px]">

                      <Info
                        icon={User}
                        label="Customer"
                        value={
                          booking.user
                            ?.name ||
                          "Unknown"
                        }
                        secondary={
                          booking.user
                            ?.email
                        }
                      />

                      <Info
                        icon={
                          CalendarDays
                        }
                        label="Show"
                        value={formatDate(
                          booking.show
                            ?.startTime
                        )}
                      />

                      <Info
                        icon={Ticket}
                        label="Seats"
                        value={
                          booking.seats
                            ?.join(
                              ", "
                            ) ||
                          "—"
                        }
                      />

                      <Info
                        icon={
                          IndianRupee
                        }
                        label="Amount"
                        value={`₹${Number(
                          booking.totalAmount ||
                            0
                        ).toLocaleString(
                          "en-IN"
                        )}`}
                      />

                    </div>

                  </div>

                  {/* PAYMENT ROW */}

                  <div className="grid gap-4 border-t border-white/5 bg-black/10 px-5 py-4 md:grid-cols-3">

                    <div className="flex items-center gap-3">

                      <CreditCard className="h-4 w-4 text-zinc-600" />

                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-700">
                          Payment
                        </p>

                        <p className="mt-1 text-xs font-medium text-zinc-400">
                          {booking.paymentStatus ||
                            booking.payment
                              ?.status ||
                            "Unknown"}
                        </p>
                      </div>

                    </div>

                    <div className="flex items-center gap-3">

                      <Clock className="h-4 w-4 text-zinc-600" />

                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-700">
                          Booked
                        </p>

                        <p className="mt-1 text-xs font-medium text-zinc-400">
                          {formatDate(
                            booking.createdAt
                          )}
                        </p>
                      </div>

                    </div>

                    <div className="flex flex-wrap justify-start gap-2 md:justify-end">

                      {canCancel && (
                        <button
                          onClick={() =>
                            openAction(
                              booking,
                              "cancel"
                            )
                          }
                          className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
                        >
                          <XCircle className="h-4 w-4" />

                          Cancel
                        </button>
                      )}

                      {canRefund && (
                        <button
                          disabled={
                            booking.ticketUsed
                          }
                          onClick={() =>
                            openAction(
                              booking,
                              "refund"
                            )
                          }
                          className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-2 text-xs font-medium text-blue-400 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <RotateCcw className="h-4 w-4" />

                          Full Refund
                        </button>
                      )}

                    </div>

                  </div>

                </motion.div>
              );
            }
          )}

        </div>
      )}

      {/* ACTION MODAL */}

      <AnimatePresence>

        {selectedBooking &&
          actionType && (
            <motion.div
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            >

              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.95,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                }}
                className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111113] p-6"
              >

                <div className="flex items-start justify-between">

                  <div className="flex gap-4">

                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                        actionType ===
                        "refund"
                          ? "bg-blue-500/10"
                          : "bg-red-500/10"
                      }`}
                    >

                      {actionType ===
                      "refund" ? (
                        <RotateCcw className="h-6 w-6 text-blue-400" />
                      ) : (
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                      )}

                    </div>

                    <div>

                      <h2 className="text-xl font-bold">
                        {actionType ===
                        "refund"
                          ? "Refund Booking"
                          : "Cancel Booking"}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        #
                        {getBookingCode(
                          selectedBooking
                        )}
                      </p>

                    </div>

                  </div>

                  <button
                    onClick={
                      closeAction
                    }
                    className="rounded-lg p-2 text-zinc-600 hover:bg-white/5 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>

                </div>

                {actionType ===
                "refund" ? (
                  <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">

                    <p className="text-sm font-medium text-blue-300">
                      Full Stripe Refund
                    </p>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      ₹
                      {Number(
                        selectedBooking.totalAmount ||
                          0
                      ).toLocaleString(
                        "en-IN"
                      )}{" "}
                      will be refunded through the original Stripe payment.
                      The booked seats will only be released after Stripe confirms the refund.
                    </p>

                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">

                    <p className="text-sm leading-6 text-zinc-400">
                      This unpaid booking will be cancelled and its reserved seats released.
                    </p>

                  </div>
                )}

                {selectedBooking.ticketUsed &&
                  actionType ===
                    "refund" && (
                    <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-400">
                      This ticket has already been used. Refund is blocked.
                    </div>
                  )}

                <div className="mt-6">

                  <label className="mb-2 block text-sm text-zinc-400">
                    {actionType ===
                    "refund"
                      ? "Refund Reason"
                      : "Cancellation Reason"}
                  </label>

                  <textarea
                    value={reason}
                    onChange={(
                      event
                    ) =>
                      setReason(
                        event.target
                          .value
                      )
                    }
                    maxLength={500}
                    rows={4}
                    placeholder={
                      actionType ===
                      "refund"
                        ? "Example: Customer requested cancellation..."
                        : "Reason for cancellation..."
                    }
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-red-500"
                  />

                  <p className="mt-2 text-right text-xs text-zinc-700">
                    {reason.length}
                    /500
                  </p>

                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">

                  <button
                    disabled={
                      processing
                    }
                    onClick={
                      closeAction
                    }
                    className="rounded-xl border border-white/10 py-3 text-sm font-medium text-zinc-400 hover:bg-white/5"
                  >
                    Go Back
                  </button>

                  <button
                    disabled={
                      processing ||
                      (
                        actionType ===
                          "refund" &&
                        selectedBooking.ticketUsed
                      )
                    }
                    onClick={
                      actionType ===
                      "refund"
                        ? refundBooking
                        : cancelBooking
                    }
                    className={`rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40 ${
                      actionType ===
                      "refund"
                        ? "bg-blue-600 hover:bg-blue-500"
                        : "bg-red-600 hover:bg-red-500"
                    }`}
                  >
                    {processing
                      ? "Processing..."
                      : actionType ===
                        "refund"
                      ? "Confirm Refund"
                      : "Confirm Cancel"}
                  </button>

                </div>

              </motion.div>

            </motion.div>
          )}

      </AnimatePresence>

    </div>
  );
};

// =====================================================
// SMALL COMPONENTS
// =====================================================

const MiniStat = ({
  icon: Icon,
  label,
  value,
}) => (
  <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">

    <div className="flex items-center justify-between">

      <div>
        <p className="text-xs text-zinc-600">
          {label}
        </p>

        <p className="mt-2 text-2xl font-bold">
          {value}
        </p>
      </div>

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
        <Icon className="h-5 w-5 text-red-500" />
      </div>

    </div>

  </div>
);

const Info = ({
  icon: Icon,
  label,
  value,
  secondary,
}) => (
  <div className="rounded-xl bg-black/20 p-3">

    <div className="flex items-center gap-2">

      <Icon className="h-3.5 w-3.5 text-zinc-600" />

      <p className="text-[10px] uppercase tracking-wider text-zinc-700">
        {label}
      </p>

    </div>

    <p className="mt-2 truncate text-xs font-medium text-zinc-300">
      {value || "—"}
    </p>

    {secondary && (
      <p className="mt-1 truncate text-[10px] text-zinc-600">
        {secondary}
      </p>
    )}

  </div>
);

export default AdminBookings;