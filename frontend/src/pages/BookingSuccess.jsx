import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  MapPin,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_BACKEND_URL;
const CINEMA_TIME_ZONE = "Asia/Kolkata";

// =====================================================
// HELPERS
// =====================================================

const formatDate = (booking) => {
  const value = booking?.show?.startTime || booking?.show?.date;
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: CINEMA_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const formatTime = (booking) => {
  if (booking?.show?.startTime) {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: CINEMA_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(booking.show.startTime));
  }

  return booking?.show?.time || "—";
};

const theatreLocation = (theatre) =>
  [theatre?.address?.area, theatre?.address?.city].filter(Boolean).join(", ") || "—";

// =====================================================
// SMALL UI PIECES
// =====================================================

const MetaBlock = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/45">
      <Icon className="h-4 w-4 text-[#D71935]" />
      <span>{label}</span>
    </div>
    <p className="mt-3 text-sm font-medium text-white">{value || "—"}</p>
  </div>
);

const NextStepCard = ({ index, title, text }) => (
  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-sm font-semibold text-white/80">
        {index}
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
    <p className="mt-3 text-sm leading-6 text-white/55">{text}</p>
  </div>
);

// =====================================================
// PAGE
// =====================================================

const BookingSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  const { token, isAuthenticated, loading: authLoading } = useAuth();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stillProcessing, setStillProcessing] = useState(false);

  const findBooking = useCallback(async () => {
    if (!token || !bookingId) return null;

    const response = await axios.get(`${API_URL}/api/bookings/my-bookings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return (response.data?.bookings || []).find((item) => item._id === bookingId);
  }, [token, bookingId]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!bookingId) {
      navigate("/my-bookings", { replace: true });
      return;
    }

    let cancelled = false;

    const loadBooking = async () => {
      try {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const result = await findBooking();

          if (result) {
            if (!cancelled) {
              setBooking(result);
              setLoading(false);
            }
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 700));
        }

        if (!cancelled) {
          setStillProcessing(true);
          setLoading(false);
        }
      } catch (error) {
        console.error("Booking confirmation fetch failed:", error);

        if (!cancelled) {
          setStillProcessing(true);
          setLoading(false);
        }
      }
    };

    loadBooking();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, bookingId, navigate, findBooking]);

  const movie = booking?.movie || booking?.show?.movie;
  const theatre = booking?.show?.theatre;
  const screen = booking?.show?.screen;

  const qrValue = useMemo(() => {
    if (!booking?.qrToken) return null;
    return `BMS1:${booking.qrToken}`;
  }, [booking]);

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080b] text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="mx-auto h-14 w-14 rounded-full border-2 border-white/10 border-t-[#D71935]"
            />
            <p className="mt-5 text-sm tracking-[0.18em] text-white/55">
              CONFIRMING YOUR BOOKING
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================
  // PROCESSING FALLBACK
  // ===================================================

  if (stillProcessing && !booking) {
    return (
      <div className="min-h-screen overflow-hidden bg-[#07080b] px-4 pb-16 pt-28 text-white">
        <div className="pointer-events-none absolute left-[-12%] top-24 h-[420px] w-[420px] rounded-full bg-[#D71935]/18 blur-[130px]" />
        <div className="pointer-events-none absolute bottom-0 right-[-8%] h-[320px] w-[320px] rounded-full bg-[#D71935]/10 blur-[140px]" />

        <div className="relative mx-auto max-w-3xl">
          <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.02))] p-8 text-center shadow-[0_30px_120px_rgba(0,0,0,.45)] sm:p-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-300">
              <Clock className="h-10 w-10" />
            </div>

            <p className="mt-8 text-[11px] uppercase tracking-[0.35em] text-[#ffb84d]">
              Payment received
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
              Your booking is still being confirmed
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
              Stripe payment looks successful, but the booking is still finishing on the
              backend. Do not pay again. You can safely check your bookings page.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => navigate("/my-bookings")}
                className="rounded-full bg-[#D71935] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#ef2947]"
              >
                Check My Bookings
              </button>

              <button
                onClick={() => navigate("/movies")}
                className="rounded-full border border-white/10 bg-white/[0.04] px-8 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08]"
              >
                Browse Movies
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================
  // SUCCESS UI
  // ===================================================

  return (
    <div className="min-h-screen overflow-hidden bg-[#07080b] px-4 pb-16 pt-28 text-white">
      <div className="pointer-events-none absolute left-[-12%] top-28 h-[450px] w-[450px] rounded-full bg-[#D71935]/16 blur-[145px]" />
      <div className="pointer-events-none absolute right-[-10%] top-[18%] h-[300px] w-[300px] rounded-full bg-[#D71935]/10 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 left-[18%] h-[220px] w-[220px] rounded-full bg-white/[0.03] blur-[120px]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_430px]">
          {/* LEFT SIDE */}
          <div>
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.45 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Transaction completed
              </div>

              <h1 className="mt-6 max-w-[11ch] text-[clamp(2.5rem,5vw,5.6rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
                Booking confirmed.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-white/60">
                Your payment is complete and your ticket is ready. Keep this screen or
                open <span className="text-white">My Bookings</span> anytime to access
                your QR ticket again.
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              <MetaBlock icon={Calendar} label="Show date" value={formatDate(booking)} />
              <MetaBlock icon={Clock} label="Time" value={formatTime(booking)} />
              <MetaBlock
                icon={Ticket}
                label="Seats"
                value={booking?.seats?.join(", ") || "—"}
              />
              <MetaBlock
                icon={MapPin}
                label="Screen"
                value={screen?.name || "Screen"}
              />
            </motion.div>

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.18, duration: 0.45 }}
              className="mt-10 flex flex-wrap gap-4"
            >
              <button
                onClick={() => navigate("/my-bookings")}
                className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#ef2947]"
              >
                Open My Bookings
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => navigate("/movies")}
                className="rounded-full border border-white/10 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-white/90 transition hover:bg-white/[0.08]"
              >
                Browse more films
              </button>
            </motion.div>

            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.26, duration: 0.45 }}
              className="mt-14"
            >
              <p className="mb-5 text-[11px] uppercase tracking-[0.32em] text-white/45">
                What happens next
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                <NextStepCard
                  index="01"
                  title="Reach the theatre"
                  text="Arrive a little early so you have enough time for entry and snacks."
                />
                <NextStepCard
                  index="02"
                  title="Show your QR"
                  text="Present the QR code from this page or from My Bookings at the entrance."
                />
                <NextStepCard
                  index="03"
                  title="Enjoy the show"
                  text="Your selected seats are already reserved under this booking."
                />
              </div>
            </motion.div>
          </div>

          {/* RIGHT SIDE / TICKET */}
          <motion.div
            initial={{ y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="h-fit rounded-[34px] border border-white/10 bg-[linear-gradient(155deg,rgba(255,255,255,.07),rgba(255,255,255,.025))] p-5 shadow-[0_28px_120px_rgba(0,0,0,.5)] sm:p-6"
          >
            <div className="rounded-[28px] border border-white/10 bg-[#0f1116]/95 p-5">
              <div className="flex items-start gap-4">
                {movie?.poster ? (
                  <img
                    src={movie.poster}
                    alt={movie?.title || "Movie poster"}
                    className="h-32 w-24 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-32 w-24 items-end rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(215,25,53,.35),transparent_60%),linear-gradient(180deg,#16181d,#0c0d10)] p-3">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white/55">
                      Ticket
                    </span>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">
                    BookMySeat ticket
                  </p>

                  <h2 className="mt-3 text-2xl font-semibold leading-tight">
                    {movie?.title || "Movie"}
                  </h2>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                      Confirmed
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/65">
                      {booking?.bookingCode || booking?.bookingReference || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="my-6 border-t border-dashed border-white/10" />

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-5">
                  <span className="text-sm text-white/48">Cinema</span>
                  <span className="max-w-[60%] text-right text-sm font-medium text-white">
                    {theatre?.name || "BookMySeat Cinema"}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-5">
                  <span className="text-sm text-white/48">Location</span>
                  <span className="max-w-[60%] text-right text-sm font-medium text-white">
                    {theatreLocation(theatre)}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-5">
                  <span className="text-sm text-white/48">Screen</span>
                  <span className="text-right text-sm font-medium text-white">
                    {screen?.name || "Screen"}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-5">
                  <span className="text-sm text-white/48">Seats</span>
                  <span className="text-right text-sm font-medium text-white">
                    {booking?.seats?.join(", ") || "—"}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-5">
                  <span className="text-sm text-white/48">Showtime</span>
                  <span className="text-right text-sm font-medium text-white">
                    {formatDate(booking)} • {formatTime(booking)}
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                      Amount paid
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">
                      ₹{Number(booking?.totalAmount || 0).toLocaleString("en-IN")}
                    </p>
                  </div>

                  <span className="text-xs uppercase tracking-[0.22em] text-white/40">
                    {booking?.currency || "INR"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-white/10 bg-white p-6 text-zinc-950">
              {qrValue ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Entry QR</p>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                      Scan at venue
                    </span>
                  </div>

                  <div className="mt-5 flex justify-center">
                    <QRCodeSVG value={qrValue} size={180} level="H" marginSize={1} />
                  </div>

                  <p className="mt-5 text-center text-xs leading-6 text-zinc-500">
                    Show this QR at the theatre entrance for ticket verification.
                  </p>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-semibold">QR unavailable</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    The QR ticket is not available for this booking right now.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccess;