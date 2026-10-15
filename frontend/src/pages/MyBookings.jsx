
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Film,
  MapPin,
  RefreshCw,
  Ticket,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// BOOKMYSEAT — MY BOOKINGS / SOFT GLASS
// Paid cancellations use a NEW refund-request endpoint,
// not the existing immediate-refund endpoint.

const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const TIME_ZONE = "Asia/Kolkata";

const money = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const statusLabel = (value) =>
  String(value || "UNKNOWN").replaceAll("_", " ");

const statusTone = (status) => {
  const colors = {
    CONFIRMED: [
      "text-emerald-300",
      "border-emerald-400/15",
      "bg-emerald-400/[0.07]",
      "bg-emerald-400",
    ],
    PENDING_PAYMENT: [
      "text-amber-300",
      "border-amber-400/15",
      "bg-amber-400/[0.07]",
      "bg-amber-400",
    ],
    REFUND_PENDING: [
      "text-violet-300",
      "border-violet-400/15",
      "bg-violet-400/[0.07]",
      "bg-violet-400",
    ],
    REFUNDED: [
      "text-sky-300",
      "border-sky-400/15",
      "bg-sky-400/[0.07]",
      "bg-sky-400",
    ],
    CANCELLED: [
      "text-rose-300",
      "border-rose-400/15",
      "bg-rose-400/[0.07]",
      "bg-rose-400",
    ],
    EXPIRED: [
      "text-rose-300",
      "border-rose-400/15",
      "bg-rose-400/[0.07]",
      "bg-rose-400",
    ],
    PAYMENT_FAILED: [
      "text-rose-300",
      "border-rose-400/15",
      "bg-rose-400/[0.07]",
      "bg-rose-400",
    ],
  };

  const [text, border, bg, dot] = colors[status] || [
    "text-zinc-300",
    "border-white/10",
    "bg-white/[0.04]",
    "bg-zinc-400",
  ];

  return { text, border, bg, dot };
};

function indianDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function indianTime(value, fallback) {
  if (!value) return fallback || "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback || "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function bookingCode(booking) {
  return (
    booking.bookingCode ||
    booking.bookingReference ||
    String(booking._id || "").slice(-8)
  );
}

function posterUrl(movie) {
  return (
    [movie?.poster, movie?.banner].find(
      (value) =>
        typeof value === "string" &&
        /^(https?:\/\/|\/)/i.test(value.trim())
    ) || ""
  );
}

function statusText(booking) {
  switch (booking.status) {
    case "CONFIRMED":
      return "Your ticket is confirmed. Show the QR at the cinema entrance.";

    case "REFUND_PENDING":
      return "This ticket is no longer valid. Your refund is awaiting review or processing.";

    case "REFUNDED":
      return "Your refund was processed. This booking is closed and the ticket is no longer valid.";

    case "CANCELLED":
      return "This booking has been cancelled and its ticket is no longer valid.";

    case "PENDING_PAYMENT":
      return "Payment has not yet been confirmed for this booking. Check its status before attempting another payment.";

    case "EXPIRED":
      return "The seat reservation expired. If you were charged, contact support before paying again.";

    case "PAYMENT_FAILED":
      return "This payment was not completed. Please check with your payment provider.";

    default:
      return "Your latest booking status is shown above.";
  }
}

const glass = {
  card:
    "rounded-[28px] border border-white/[0.07] " +
    "bg-[linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.014)_62%,rgba(215,25,53,0.016))] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_24px_65px_rgba(0,0,0,0.18)]",

  inset:
    "rounded-[19px] border border-white/[0.055] " +
    "bg-[linear-gradient(150deg,rgba(255,255,255,0.038),rgba(255,255,255,0.013))]",
};

function StatCard({ label, value, accent }) {
  return (
    <div className={`${glass.card} p-5 sm:p-6`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.23em] text-white/40">
        {label}
      </p>

      <p className={`mt-3 text-3xl font-semibold tracking-tight ${accent || "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className={`${glass.inset} min-w-0 px-4 py-4 sm:px-5`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.21em] text-white/40">
        <Icon
          size={14}
          strokeWidth={1.7}
          className="text-[#d94861]"
        />
        <span>{label}</span>
      </div>

      <p className="mt-2.5 break-words text-[13px] font-medium leading-relaxed text-white/90">
        {value || "—"}
      </p>
    </div>
  );
}

function Poster({ movie }) {
  const image = posterUrl(movie);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [image]);

  return (
    <div className="relative h-[180px] overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#121216] xl:h-full xl:min-h-[250px]">
      {!failed && image ? (
        <img
          src={image}
          alt={movie?.title || "Movie poster"}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="relative flex h-full min-h-[180px] flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_28%_15%,rgba(215,25,53,0.18),transparent_65%),linear-gradient(145deg,#19171b,#0f1014)] p-5">
          <Film
            className="h-5 w-5 text-white/30"
            strokeWidth={1.4}
          />

          <div className="min-w-0">
            <div className="mb-3 h-[2px] w-8 bg-[#d71935]/75" />

            <p className="break-words text-xl font-semibold leading-tight tracking-[-0.03em] text-white/90 xl:text-[17px]">
              {movie?.title || "BookMySeat"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({
  booking,
  reason,
  setReason,
  stage,
  setStage,
  busy,
  onClose,
  onSubmit,
}) {
  const isPaid =
    booking.status === "CONFIRMED" ||
    booking.cancellation?.action === "REFUND";

  return (
    <motion.div
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bms-cancel-heading"
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 12, opacity: 0 }}
        className={`${glass.card} w-full max-w-lg bg-[#111116] p-6 text-white sm:p-8`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#f06b81]">
              {stage === "final"
                ? "Final confirmation"
                : "Cancellation request"}
            </p>

            <h2
              id="bms-cancel-heading"
              className="mt-3 text-2xl font-semibold tracking-tight"
            >
              {stage === "final"
                ? "Are you sure?"
                : isPaid
                ? "Request cancellation & refund"
                : "Cancel your reservation"}
            </h2>

            <p className="mt-2 text-xs text-white/45">
              {bookingCode(booking)}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/60 hover:bg-white/[0.07] disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {stage === "details" ? (
          <>
            <div className={`${glass.inset} mt-6 p-4`}>
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />

                <p className="text-sm leading-6 text-white/65">
                  {isPaid
                    ? "After you confirm, your ticket will be cancelled and the seat released. The refund request will be sent to an admin for review; no refund is issued immediately."
                    : "Cancelling will release your reserved seats. This action cannot be undone."}
                </p>
              </div>
            </div>

            <label
              htmlFor="bms-cancel-reason"
              className="mt-6 block text-xs font-medium text-white/75"
            >
              Reason for cancellation
            </label>

            <textarea
              id="bms-cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Tell us why you're cancelling..."
              className="mt-2 w-full resize-none rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 text-sm text-white outline-none transition focus:border-[#d71935]/70"
            />
          </>
        ) : (
          <div className={`${glass.inset} mt-6 p-5`}>
            <p className="text-sm leading-7 text-white/75">
              You are about to cancel{" "}
              <strong className="text-white">
                {booking.movie?.title ||
                  booking.show?.movie?.title ||
                  "this booking"}
              </strong>
              {isPaid
                ? ` and request a ${money(booking.totalAmount)} refund.`
                : "."}
            </p>

            <p className="mt-3 text-sm leading-6 text-[#f3aeb8]">
              Your existing QR ticket will become invalid and the
              seat will be available for others.
            </p>

            {isPaid && (
              <p className="mt-3 text-xs leading-5 text-white/50">
                Refund processing starts only after admin review and
                approval, subject to your cancellation policy.
              </p>
            )}
          </div>
        )}

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={
              stage === "final"
                ? () => setStage("details")
                : onClose
            }
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {stage === "final" ? "Go back" : "Keep booking"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={
              stage === "final"
                ? onSubmit
                : () => setStage("final")
            }
            className="rounded-full bg-[#D71935] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ea304b] disabled:opacity-50"
          >
            {busy
              ? "Processing..."
              : stage === "final"
              ? "Yes, cancel ticket"
              : "Continue"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function MyBookings() {
  const navigate = useNavigate();

  const {
    token,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState("details");
  const [busy, setBusy] = useState(false);

  // =====================================================
  // AUTHENTICATION
  // =====================================================

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // =====================================================
  // LOAD BOOKINGS
  // =====================================================

  const loadBookings = useCallback(
    async (showSpinner = false) => {
      if (!token) {
        setLoading(false);
        return;
      }

      if (showSpinner) setRefreshing(true);

      try {
        const response = await axios.get(
          `${API_URL}/api/customer-bookings`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setBookings(
          Array.isArray(response.data?.bookings)
            ? response.data.bookings
            : []
        );
      } catch (error) {
        console.error("MyBookings load:", error);

        toast.error(
          error.response?.data?.message ||
            "Could not load your bookings."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    loadBookings();
  }, [authLoading, isAuthenticated, loadBookings]);

  // =====================================================
  // FILTERS AND COUNTS
  // =====================================================

  const statuses = useMemo(
    () => [
      "ALL",
      ...new Set(
        bookings.map((booking) => booking.status).filter(Boolean)
      ),
    ],
    [bookings]
  );

  const visible = useMemo(
    () =>
      filter === "ALL"
        ? bookings
        : bookings.filter((booking) => booking.status === filter),
    [bookings, filter]
  );

  const counts = useMemo(
    () => ({
      all: bookings.length,

      confirmed: bookings.filter(
        (booking) => booking.status === "CONFIRMED"
      ).length,

      pending: bookings.filter((booking) =>
        ["PENDING_PAYMENT", "REFUND_PENDING"].includes(
          booking.status
        )
      ).length,

      refunded: bookings.filter(
        (booking) => booking.status === "REFUNDED"
      ).length,
    }),
    [bookings]
  );

  // =====================================================
  // TWO-STEP CANCELLATION
  // =====================================================

  function openCancellation(booking) {
    setSelected(booking);
    setStage("details");
    setReason("");
  }

  function closeCancellation() {
    if (busy) return;

    setSelected(null);
    setReason("");
    setStage("details");
  }

  async function confirmCancellation() {
    if (!selected || busy || !token) return;

    setBusy(true);

    try {
      const needsRefund =
        selected.status === "CONFIRMED" ||
        selected.cancellation?.action === "REFUND";

      // CRITICAL:
      // Confirmed bookings must NOT call the old /cancel
      // endpoint because it immediately refunds via Stripe.
      //
      // The new /refund-request route requires the backend
      // implementation discussed below.

      const url = needsRefund
        ? `${API_URL}/api/customer-bookings/${selected._id}/refund-request`
        : `${API_URL}/api/customer-bookings/${selected._id}/cancel`;

      const response = await axios.post(
        url,
        {
          reason:
            reason.trim() || "Cancelled by customer",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success(
        response.data?.message ||
          (needsRefund
            ? "Cancellation requested. Refund awaiting admin review."
            : "Booking cancelled.")
      );

      setSelected(null);
      setStage("details");
      setReason("");

      await loadBookings();
    } catch (error) {
      console.error("Booking cancellation:", error);

      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Cancellation request could not be submitted. Your booking is unchanged."
      );
    } finally {
      setBusy(false);
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090b] text-white">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear",
            }}
            className="mx-auto h-10 w-10 rounded-full border-2 border-white/10 border-t-[#D71935]"
          />

          <p className="mt-6 text-xs uppercase tracking-[0.24em] text-white/40">
            Loading your tickets
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // MAIN PAGE
  // =====================================================

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090b] px-4 pb-24 pt-28 text-white sm:px-6">
      <div className="pointer-events-none absolute -left-40 top-20 h-[450px] w-[450px] rounded-full bg-[#D71935]/[0.075] blur-[140px]" />
      <div className="pointer-events-none absolute -right-48 top-96 h-[400px] w-[400px] rounded-full bg-white/[0.025] blur-[150px]" />

      <div className="relative mx-auto max-w-7xl">
        {/* HEADER */}

        <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.34em] text-[#d76577]">
              Your movie archive
            </p>

            <h1 className="mt-4 text-[clamp(2.8rem,5.5vw,5rem)] font-semibold leading-none tracking-[-0.045em]">
              My bookings.
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-white/50">
              Your tickets, upcoming shows and refund updates,
              all in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadBookings(true)}
            disabled={refreshing}
            className="flex items-center gap-2 self-start rounded-full border border-white/[0.085] bg-white/[0.035] px-5 py-3 text-sm text-white/80 transition hover:bg-white/[0.075] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh bookings
          </button>
        </header>

        {/* SUMMARY */}

        <section
          aria-label="Booking overview"
          className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
        >
          <StatCard
            label="Total bookings"
            value={counts.all}
          />

          <StatCard
            label="Confirmed"
            value={counts.confirmed}
            accent="text-emerald-200"
          />

          <StatCard
            label="Awaiting action"
            value={counts.pending}
            accent="text-amber-200"
          />

          <StatCard
            label="Refunded"
            value={counts.refunded}
            accent="text-sky-200"
          />
        </section>

        {/* FILTERS */}

        <div className="mt-10 flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-full border px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] transition ${
                filter === status
                  ? "border-[#D71935]/50 bg-[#D71935] text-white"
                  : "border-white/[0.075] bg-white/[0.025] text-white/50 hover:border-white/15 hover:text-white"
              }`}
            >
              {status === "ALL"
                ? "All tickets"
                : statusLabel(status)}
            </button>
          ))}
        </div>

        {/* EMPTY STATE */}

        {visible.length === 0 ? (
          <div className={`${glass.card} mt-9 px-6 py-20 text-center`}>
            <Ticket className="mx-auto h-10 w-10 text-white/25" />

            <p className="mt-5 text-lg font-semibold">
              No bookings found
            </p>

            <p className="mt-2 text-sm text-white/45">
              Try another filter or explore the films now showing.
            </p>

            <button
              type="button"
              onClick={() => navigate("/movies")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold"
            >
              Browse movies
              <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <section
            aria-label="Tickets"
            className="mt-9 space-y-5"
          >
            {visible.map((booking, index) => {
              const show = booking.show;
              const movie = booking.movie || show?.movie;
              const status = booking.status;
              const tone = statusTone(status);

              const canEnter =
                status === "CONFIRMED" &&
                Boolean(booking.qrToken) &&
                !booking.ticketUsed;

              const paidCancellation =
                booking.status === "CONFIRMED" ||
                booking.cancellation?.action === "REFUND";

              const canCancel =
                status === "CONFIRMED" &&
                Boolean(booking.cancellation?.canCancel);

              const canCancelUnpaid =
                status === "PENDING_PAYMENT" &&
                Boolean(booking.cancellation?.canCancel);

              return (
                <motion.article
                  key={booking._id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(index, 6) * 0.045,
                  }}
                  className={`${glass.card} overflow-hidden p-3 sm:p-4`}
                >
                  <div className="grid gap-3 xl:grid-cols-[160px_minmax(0,1fr)_280px] xl:gap-4">
                    {/* POSTER */}

                    <Poster movie={movie} />

                    {/* DETAILS */}

                    <div className={`${glass.card} min-w-0 p-5 sm:p-6`}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="min-w-0 break-words text-[clamp(1.3rem,2vw,1.65rem)] font-semibold tracking-[-0.03em]">
                              {movie?.title || "Movie"}
                            </h2>

                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] ${tone.border} ${tone.bg} ${tone.text}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${tone.dot}`}
                              />

                              {statusLabel(status)}
                            </span>

                            {booking.ticketUsed && (
                              <span className="rounded-full border border-violet-400/15 bg-violet-400/[0.07] px-3 py-1 text-[10px] font-semibold text-violet-200">
                                USED
                              </span>
                            )}
                          </div>

                          <p className="mt-2.5 font-mono text-[11px] tracking-wide text-white/30">
                            BMS · {bookingCode(booking)}
                          </p>
                        </div>

                        <div className="shrink-0 sm:text-right">
                          <p className="text-[10px] uppercase tracking-[0.23em] text-white/35">
                            {status === "REFUNDED"
                              ? "Booking value"
                              : "Total"}
                          </p>

                          <p className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
                            {money(booking.totalAmount)}
                          </p>
                        </div>
                      </div>

                      {/* DETAIL GRID */}

                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <Detail
                          icon={MapPin}
                          label="Cinema"
                          value={`${show?.theatre?.name || "—"}${
                            show?.screen?.name
                              ? ` · ${show.screen.name}`
                              : ""
                          }`}
                        />

                        <Detail
                          icon={CalendarDays}
                          label="Date"
                          value={indianDate(
                            show?.startTime || show?.date
                          )}
                        />

                        <Detail
                          icon={Clock3}
                          label="Time"
                          value={indianTime(
                            show?.startTime,
                            show?.time
                          )}
                        />

                        <Detail
                          icon={Ticket}
                          label="Seats"
                          value={
                            booking.seats?.join(", ") || "—"
                          }
                        />
                      </div>

                      {/* STATUS MESSAGE */}

                      <div className="mt-5 flex items-start gap-3 rounded-[17px] border border-white/[0.055] bg-white/[0.025] px-4 py-3.5">
                        {status === "CONFIRMED" ? (
                          <CheckCircle2
                            className="mt-0.5 shrink-0 text-emerald-300"
                            size={17}
                          />
                        ) : (
                          <AlertCircle
                            className="mt-0.5 shrink-0 text-white/40"
                            size={17}
                          />
                        )}

                        <p className="text-[13px] leading-6 text-white/60">
                          {statusText(booking)}
                        </p>
                      </div>

                      {booking.cancellation?.reason &&
                        !booking.cancellation?.canCancel && (
                          <p className="mt-3 text-xs leading-5 text-white/40">
                            {booking.cancellation.reason}
                          </p>
                        )}
                    </div>

                    {/* RIGHT COLUMN */}

                    <aside className="flex flex-col gap-3">
                      {/* QR TICKET */}

                      {canEnter ? (
                        <div className="rounded-[24px] bg-[#fafafa] p-5 text-[#151515] shadow-[0_15px_35px_rgba(0,0,0,0.13)]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">
                              Entry QR
                            </span>

                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-zinc-500">
                              Scan at venue
                            </span>
                          </div>

                          <div className="mt-4 flex justify-center">
                            <QRCodeSVG
                              value={`BMS1:${booking.qrToken}`}
                              size={170}
                              level="H"
                              marginSize={1}
                            />
                          </div>

                          <p className="mt-4 text-center text-[11px] leading-5 text-zinc-500">
                            Present this QR at the cinema entrance.
                          </p>
                        </div>
                      ) : (
                        <div className={`${glass.card} p-5`}>
                          <p className="text-[10px] uppercase tracking-[0.23em] text-white/40">
                            Ticket status
                          </p>

                          <p
                            className={`mt-3 text-lg font-semibold ${tone.text}`}
                          >
                            {statusLabel(status)}
                          </p>

                          <p className="mt-3 text-xs leading-6 text-white/50">
                            {status === "REFUNDED" ||
                            status === "REFUND_PENDING" ||
                            status === "CANCELLED"
                              ? "QR entry has been disabled for this booking."
                              : booking.ticketUsed
                              ? "This ticket has already been scanned."
                              : "A valid QR becomes available only after confirmation."}
                          </p>
                        </div>
                      )}

                      {/* ACTIONS */}

                      <div className={`${glass.card} mt-auto p-5`}>
                        <p className="text-[10px] uppercase tracking-[0.23em] text-white/40">
                          Actions
                        </p>

                        <button
                          type="button"
                          onClick={() => navigate("/movies")}
                          className="mt-4 w-full rounded-full border border-white/[0.075] bg-white/[0.055] px-4 py-3 text-xs font-semibold text-white/90 transition hover:bg-white/[0.10]"
                        >
                          Book another movie
                        </button>

                        {(canCancel || canCancelUnpaid) &&
                          !booking.ticketUsed && (
                            <button
                              type="button"
                              onClick={() =>
                                openCancellation(booking)
                              }
                              className="mt-2.5 w-full rounded-full border border-[#D71935]/30 bg-[#D71935]/[0.10] px-4 py-3 text-xs font-semibold text-[#ff8ea0] transition hover:bg-[#D71935]/[0.16]"
                            >
                              {paidCancellation
                                ? "Request cancellation & refund"
                                : "Cancel reservation"}
                            </button>
                          )}

                        {(status === "REFUNDED" ||
                          status === "REFUND_PENDING") && (
                          <p className="mt-3 text-center text-[11px] leading-5 text-white/35">
                            {status === "REFUND_PENDING"
                              ? "Refund review in progress"
                              : "Refund completed"}
                          </p>
                        )}
                      </div>
                    </aside>
                  </div>
                </motion.article>
              );
            })}
          </section>
        )}
      </div>

      {/* CANCELLATION MODAL */}

      <AnimatePresence>
        {selected && (
          <Modal
            booking={selected}
            reason={reason}
            setReason={setReason}
            stage={stage}
            setStage={setStage}
            busy={busy}
            onClose={closeCancellation}
            onSubmit={confirmCancellation}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
