
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import PageShell from "../components/ui/PageShell";

const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const TIME_ZONE = "Asia/Kolkata";
const EASE = [0.22, 1, 0.36, 1];
const surface = "rounded-[22px] border border-white/10 bg-[#101013]/90";
const inset = "rounded-2xl border border-white/[0.07] bg-white/[0.025]";

const money = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const statusLabel = (value) => String(value || "UNKNOWN").replaceAll("_", " ");
const statusTone = (status) => {
  const colors = {
    CONFIRMED: ["text-emerald-300", "border-emerald-400/20", "bg-emerald-400/[0.07]", "bg-emerald-400"],
    PENDING_PAYMENT: ["text-amber-300", "border-amber-400/20", "bg-amber-400/[0.07]", "bg-amber-400"],
    REFUND_PENDING: ["text-violet-300", "border-violet-400/20", "bg-violet-400/[0.07]", "bg-violet-400"],
    REFUNDED: ["text-sky-300", "border-sky-400/20", "bg-sky-400/[0.07]", "bg-sky-400"],
    CANCELLED: ["text-rose-300", "border-rose-400/20", "bg-rose-400/[0.07]", "bg-rose-400"],
    EXPIRED: ["text-rose-300", "border-rose-400/20", "bg-rose-400/[0.07]", "bg-rose-400"],
    PAYMENT_FAILED: ["text-rose-300", "border-rose-400/20", "bg-rose-400/[0.07]", "bg-rose-400"],
  };
  const [text, border, bg, dot] = colors[status] || [
    "text-zinc-300", "border-white/10", "bg-white/[0.04]", "bg-zinc-400",
  ];
  return { text, border, bg, dot };
};

function indianDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", year: "numeric",
  }).format(date);
}
function indianTime(value, fallback) {
  if (!value) return fallback || "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback || "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit",
  }).format(date);
}
function bookingCode(booking) {
  return booking.bookingCode || booking.bookingReference || String(booking._id || "").slice(-8);
}
function posterUrl(movie) {
  return [movie?.poster, movie?.banner].find(
    (value) => typeof value === "string" && /^(https?:\/\/|\/)/i.test(value.trim())
  ) || "";
}
function statusText(booking) {
  switch (booking.status) {
    case "CONFIRMED": return "Your ticket is confirmed. Show the QR at the cinema entrance.";
    case "REFUND_PENDING": return "This ticket is no longer valid. Your refund is awaiting review or processing.";
    case "REFUNDED": return "Your refund was processed. This booking is closed and the ticket is no longer valid.";
    case "CANCELLED": return "This booking has been cancelled and its ticket is no longer valid.";
    case "PENDING_PAYMENT": return "Payment has not yet been confirmed for this booking. Check its status before attempting another payment.";
    case "EXPIRED": return "The seat reservation expired. If you were charged, contact support before paying again.";
    case "PAYMENT_FAILED": return "This payment was not completed. Please check with your payment provider.";
    default: return "Your latest booking status is shown above.";
  }
}

function Eyebrow({ children, suffix }) {
  return (
    <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.23em] text-[#ff526e] sm:text-[11px]">
      <span className="h-px w-7 bg-[#D71935]" />
      <span>{children}</span>
      {suffix && <span className="text-zinc-600">/ {suffix}</span>}
    </div>
  );
}
function StatCard({ label, value, accent }) {
  return (
    <div className={`${surface} p-5 transition-colors duration-300 hover:border-white/20 sm:p-6`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-zinc-500">{label}</p>
      <p className={`cine-head mt-3 text-3xl ${accent || "text-white"}`}>{value}</p>
    </div>
  );
}
function Detail({ icon: Icon, label, value }) {
  return (
    <div className={`${inset} min-w-0 px-4 py-3.5`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
        <Icon size={14} strokeWidth={1.7} className="text-[#ff526e]" />
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-[13px] leading-6 text-zinc-200">{value || "—"}</p>
    </div>
  );
}
function Poster({ movie }) {
  const image = posterUrl(movie);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  return (
    <div className="relative h-[185px] overflow-hidden rounded-2xl border border-white/10 bg-[#141317] xl:h-full xl:min-h-[250px]">
      {image && !failed ? (
        <img src={image} alt={`${movie?.title || "Film"} poster`} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="flex h-full min-h-[185px] flex-col justify-between bg-[radial-gradient(ellipse_at_top_left,rgba(215,25,53,.2),transparent_70%)] p-5">
          <Film size={22} strokeWidth={1.4} className="text-zinc-500" />
          <p className="cine-head text-xl leading-tight text-white">{movie?.title || "BookMySeat"}</p>
        </div>
      )}
    </div>
  );
}

function CancellationModal({ booking, reason, setReason, stage, setStage, busy, onClose, onSubmit, reducedMotion }) {
  const isPaid = booking.status === "CONFIRMED" || booking.cancellation?.action === "REFUND";
  return (
    <motion.div
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-lg"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bms-cancel-heading"
        initial={reducedMotion ? false : { scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { scale: 0.96, y: 12, opacity: 0 }}
        className={`${surface} w-full max-w-lg bg-[#111115] p-6 text-white sm:p-8`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>{stage === "final" ? "Final confirmation" : "Cancellation request"}</Eyebrow>
            <h2 id="bms-cancel-heading" className="cine-head mt-4 text-2xl sm:text-3xl">
              {stage === "final" ? "Are you sure?" : isPaid ? "Request cancellation & refund" : "Cancel your reservation"}
            </h2>
            <p className="mt-2 text-xs text-zinc-500">{bookingCode(booking)}</p>
          </div>
          <button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose} className="rounded-full border border-white/10 p-2 text-zinc-400 hover:bg-white/10 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>
        {stage === "details" ? (
          <>
            <div className={`${inset} mt-6 flex items-start gap-3 p-4`}>
              <AlertCircle size={19} className="mt-1 shrink-0 text-amber-300" />
              <p className="text-sm leading-6 text-zinc-300">
                {isPaid
                  ? "After confirmation, your ticket is cancelled and the seat released. The refund request goes to an admin for review; no refund is issued immediately."
                  : "Cancelling releases your reserved seats. This action cannot be undone."}
              </p>
            </div>
            <label htmlFor="bms-cancel-reason" className="mt-6 block text-xs font-medium text-zinc-300">Reason for cancellation</label>
            <textarea
              id="bms-cancel-reason" rows={3} maxLength={500}
              value={reason} onChange={(event) => setReason(event.target.value)}
              placeholder="Tell us why you're cancelling..."
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#1b1a1f] p-4 text-sm text-white outline-none focus:border-[#D71935]/70"
            />
          </>
        ) : (
          <div className={`${inset} mt-6 p-5`}>
            <p className="text-sm leading-7 text-zinc-300">
              You are about to cancel <strong className="text-white">{booking.movie?.title || booking.show?.movie?.title || "this booking"}</strong>
              {isPaid ? ` and request a ${money(booking.totalAmount)} refund.` : "."}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#ff97a7]">Your QR ticket will become invalid and the seat will be available for others.</p>
            {isPaid && <p className="mt-3 text-xs leading-5 text-zinc-500">Refund processing begins only after admin approval and is subject to the cancellation policy.</p>}
          </div>
        )}
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={stage === "final" ? () => setStage("details") : onClose} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50">
            {stage === "final" ? "Go back" : "Keep booking"}
          </button>
          <button type="button" disabled={busy} onClick={stage === "final" ? onSubmit : () => setStage("final")} className="rounded-full bg-[#D71935] px-4 py-3 text-sm font-semibold text-white hover:bg-[#ed2a49] disabled:opacity-50">
            {busy ? "Processing..." : stage === "final" ? "Yes, cancel ticket" : "Continue"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function MyBookings() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState("details");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth", { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  // One API path for initial loading, refreshes and post-cancellation updates.
  const loadBookings = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return false;
    }
    try {
      const response = await axios.get(`${API_URL}/api/customer-bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(Array.isArray(response.data?.bookings) ? response.data.bookings : []);
      return true;
    } catch (error) {
      console.error("MyBookings load:", error);
      toast.error(error.response?.data?.message || "Could not load your bookings.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void loadBookings();
  }, [authLoading, isAuthenticated, loadBookings]);

  // The message disappears five seconds after a *successful* refresh.
  useEffect(() => {
    if (!refreshNotice) return undefined;
    const timeout = window.setTimeout(() => setRefreshNotice(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [refreshNotice]);

  async function handleRefresh() {
    if (refreshing || !token) return;
    setRefreshNotice(false);
    setRefreshing(true);
    try {
      // A short minimum duration makes the spin perceptible on fast connections.
      const [succeeded] = await Promise.all([
        loadBookings(),
        new Promise((resolve) => window.setTimeout(resolve, 650)),
      ]);
      if (succeeded) setRefreshNotice(true);
    } finally {
      setRefreshing(false);
    }
  }

  const statuses = useMemo(() => ["ALL", ...new Set(bookings.map((booking) => booking.status).filter(Boolean))], [bookings]);
  const visible = useMemo(() => filter === "ALL" ? bookings : bookings.filter((booking) => booking.status === filter), [bookings, filter]);
  const counts = useMemo(() => ({
    all: bookings.length,
    confirmed: bookings.filter((booking) => booking.status === "CONFIRMED").length,
    pending: bookings.filter((booking) => ["PENDING_PAYMENT", "REFUND_PENDING"].includes(booking.status)).length,
    refunded: bookings.filter((booking) => booking.status === "REFUNDED").length,
  }), [bookings]);

  function openCancellation(booking) {
    setSelected(booking);
    setReason("");
    setStage("details");
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
      const needsRefund = selected.status === "CONFIRMED" || selected.cancellation?.action === "REFUND";
      // Do not change refund-request to the legacy immediate-refund route.
      const url = needsRefund
        ? `${API_URL}/api/customer-bookings/${selected._id}/refund-request`
        : `${API_URL}/api/customer-bookings/${selected._id}/cancel`;
      const response = await axios.post(url, {
        reason: reason.trim() || "Cancelled by customer",
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(response.data?.message || (needsRefund
        ? "Cancellation requested. Refund awaiting admin review."
        : "Booking cancelled."));
      setSelected(null);
      setStage("details");
      setReason("");
      await loadBookings();
    } catch (error) {
      console.error("Booking cancellation:", error);
      toast.error(error.response?.data?.message || error.response?.data?.error || "Cancellation request could not be submitted. Your booking is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) {
    return (
      <PageShell glow="left">
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 text-white" role="status">
          <motion.div
            animate={reducedMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 1.15, repeat: Infinity, ease: "linear" }}
            className="h-9 w-9 rounded-full border-2 border-white/10 border-t-[#D71935]"
          />
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Loading your tickets</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell glow="left">
      <main className="relative mx-auto max-w-[1480px] px-5 pb-24 pt-10 text-white md:px-10 md:pt-14">
        <motion.header
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE }}
          className="mb-9 flex flex-col justify-between gap-6 border-b border-white/10 pb-8 lg:mb-10 lg:flex-row lg:items-end"
        >
          <div className="min-w-0">
            <Eyebrow suffix="04">Your movie archive</Eyebrow>
            <h1 className="cine-display mt-5 text-[clamp(2.8rem,5.4vw,5.4rem)] leading-[.94] tracking-tight">
              My <span className="text-[#ff4562]">bookings.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
              Your tickets, upcoming shows and refund updates, all in one place.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end lg:pb-1">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-busy={refreshing}
              className="group inline-flex min-h-[44px] items-center gap-3 rounded-full border border-white/20 bg-white/[0.035] px-5 py-3 text-xs font-semibold text-zinc-200 transition-all duration-300 hover:border-[#D71935]/60 hover:bg-[#D71935]/10 hover:text-white disabled:cursor-wait disabled:opacity-70 sm:text-sm"
            >
              <motion.span
                className="inline-flex text-[#ff526e]"
                animate={refreshing && !reducedMotion ? { rotate: 360 } : { rotate: 0 }}
                transition={refreshing && !reducedMotion ? { duration: 1.1, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
              >
                <RefreshCw size={17} strokeWidth={1.7} />
              </motion.span>
              {refreshing ? "Updating bookings..." : "Refresh bookings"}
            </button>
            <div className="min-h-[24px]" aria-live="polite" aria-atomic="true">
              <AnimatePresence mode="wait">
                {refreshNotice && (
                  <motion.div
                    key="refreshed"
                    role="status"
                    initial={reducedMotion ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-2 text-xs font-medium text-emerald-300"
                  >
                    <CheckCircle2 size={16} />
                    Bookings updated
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.header>

        <section aria-label="Booking overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard label="Total bookings" value={counts.all} />
          <StatCard label="Confirmed" value={counts.confirmed} accent="text-emerald-200" />
          <StatCard label="Awaiting action" value={counts.pending} accent="text-amber-200" />
          <StatCard label="Refunded" value={counts.refunded} accent="text-sky-200" />
        </section>

        <div className="mt-9 flex flex-wrap gap-2" aria-label="Filter bookings by status">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              aria-pressed={filter === status}
              className={`rounded-full border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 ${
                filter === status
                  ? "border-[#D71935] bg-[#D71935] text-white"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:text-white"
              }`}
            >
              {status === "ALL" ? "All tickets" : statusLabel(status)}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className={`${surface} mt-8 px-6 py-20 text-center`}>
            <Ticket size={40} strokeWidth={1.5} className="mx-auto text-zinc-600" />
            <h2 className="cine-head mt-5 text-2xl">No bookings found.</h2>
            <p className="mt-3 text-sm text-zinc-400">Try another filter or explore the films now showing.</p>
            <button type="button" onClick={() => navigate("/movies")} className="group mt-6 inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold transition-colors hover:bg-[#ed2a49]">
              Browse movies <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        ) : (
          <section aria-label="Tickets" className="mt-8 space-y-5">
            {visible.map((booking, index) => {
              const show = booking.show;
              const movie = booking.movie || show?.movie;
              const status = booking.status;
              const tone = statusTone(status);
              const canEnter = status === "CONFIRMED" && Boolean(booking.qrToken) && !booking.ticketUsed;
              const paidCancellation = status === "CONFIRMED" || booking.cancellation?.action === "REFUND";
              const canCancel = status === "CONFIRMED" && Boolean(booking.cancellation?.canCancel);
              const canCancelUnpaid = status === "PENDING_PAYMENT" && Boolean(booking.cancellation?.canCancel);
              return (
                <motion.article
                  key={booking._id}
                  initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: reducedMotion ? 0 : Math.min(index, 6) * 0.05, ease: EASE }}
                  className={`${surface} overflow-hidden p-3 sm:p-4`}
                >
                  <div className="grid gap-3 xl:grid-cols-[160px_minmax(0,1fr)_280px] xl:gap-4">
                    <Poster movie={movie} />
                    <div className="min-w-0 rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="cine-head min-w-0 break-words text-[clamp(1.3rem,2vw,1.8rem)]">{movie?.title || "Film"}</h2>
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] ${tone.border} ${tone.bg} ${tone.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                              {statusLabel(status)}
                            </span>
                            {booking.ticketUsed && <span className="rounded-full border border-violet-400/15 bg-violet-400/[0.07] px-3 py-1 text-[10px] font-semibold text-violet-200">USED</span>}
                          </div>
                          <p className="mt-3 text-[11px] tracking-wide text-zinc-500">BMS · {bookingCode(booking)}</p>
                        </div>
                        <div className="shrink-0 sm:text-right">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{status === "REFUNDED" ? "Booking value" : "Total"}</p>
                          <p className="cine-head mt-2 text-3xl">{money(booking.totalAmount)}</p>
                        </div>
                      </div>
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <Detail icon={MapPin} label="Cinema" value={`${show?.theatre?.name || "—"}${show?.screen?.name ? ` · ${show.screen.name}` : ""}`} />
                        <Detail icon={CalendarDays} label="Date" value={indianDate(show?.startTime || show?.date)} />
                        <Detail icon={Clock3} label="Time" value={indianTime(show?.startTime, show?.time)} />
                        <Detail icon={Ticket} label="Seats" value={Array.isArray(booking.seats) ? booking.seats.join(", ") : "—"} />
                      </div>
                      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5">
                        {status === "CONFIRMED" ? <CheckCircle2 size={17} className="mt-1 shrink-0 text-emerald-300" /> : <AlertCircle size={17} className="mt-1 shrink-0 text-zinc-500" />}
                        <p className="text-[13px] leading-6 text-zinc-400">{statusText(booking)}</p>
                      </div>
                      {booking.cancellation?.reason && !booking.cancellation?.canCancel && (
                        <p className="mt-3 text-xs leading-5 text-zinc-500">{booking.cancellation.reason}</p>
                      )}
                    </div>
                    <aside className="flex flex-col gap-3">
                      {canEnter ? (
                        <div className="rounded-[18px] bg-[#fafafa] p-5 text-[#151515]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">Entry QR</span>
                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[9px] uppercase tracking-wider text-zinc-500">Scan at venue</span>
                          </div>
                          <div className="mt-4 flex justify-center">
                            <QRCodeSVG value={`BMS1:${booking.qrToken}`} size={170} level="H" marginSize={1} />
                          </div>
                          <p className="mt-4 text-center text-xs leading-5 text-zinc-500">Present this QR at the cinema entrance.</p>
                        </div>
                      ) : (
                        <div className={`${inset} p-5`}>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Ticket status</p>
                          <p className={`cine-head mt-3 text-lg ${tone.text}`}>{statusLabel(status)}</p>
                          <p className="mt-3 text-xs leading-6 text-zinc-400">
                            {["REFUNDED", "REFUND_PENDING", "CANCELLED"].includes(status)
                              ? "QR entry has been disabled for this booking."
                              : booking.ticketUsed
                              ? "This ticket has already been scanned."
                              : "A valid QR becomes available only after confirmation."}
                          </p>
                        </div>
                      )}
                      <div className={`${inset} mt-auto p-5`}>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Actions</p>
                        <button type="button" onClick={() => navigate("/movies")} className="mt-4 w-full rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-white/10">Book another movie</button>
                        {(canCancel || canCancelUnpaid) && !booking.ticketUsed && (
                          <button type="button" onClick={() => openCancellation(booking)} className="mt-2.5 w-full rounded-full border border-[#D71935]/40 bg-[#D71935]/10 px-4 py-3 text-xs font-semibold text-[#ff98a8] transition-colors hover:bg-[#D71935]/20">
                            {paidCancellation ? "Request cancellation & refund" : "Cancel reservation"}
                          </button>
                        )}
                        {["REFUNDED", "REFUND_PENDING"].includes(status) && (
                          <p className="mt-3 text-center text-xs leading-5 text-zinc-500">{status === "REFUND_PENDING" ? "Refund review in progress" : "Refund completed"}</p>
                        )}
                      </div>
                    </aside>
                  </div>
                </motion.article>
              );
            })}
          </section>
        )}
      </main>
      <AnimatePresence>
        {selected && (
          <CancellationModal
            booking={selected}
            reason={reason}
            setReason={setReason}
            stage={stage}
            setStage={setStage}
            busy={busy}
            onClose={closeCancellation}
            onSubmit={confirmCancellation}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
