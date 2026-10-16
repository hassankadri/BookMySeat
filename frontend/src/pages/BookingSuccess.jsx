
import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import axios from "axios";

import {
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  ArrowRight,
  CircleAlert,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Ticket,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import BookingSuccessOriginal from "./BookingSuccessOriginal";

// =====================================================
// BOOKMYSEAT — BOOKING CONFIRMATION
// =====================================================
//
// Preserves:
// - Existing ticket design
// - Payment recovery API
// - Automatic confirmation polling
// - Stripe webhook reconciliation
// - Existing booking status handling
// - Authentication and navigation
//
// Accessibility:
// - Screen-reader payment status announcements
// - Keyboard focus management
// - Visible button focus indicators
// - Accessible loading and error states
// - Reduced-motion preferences
//
// SECURITY:
// Only a booking confirmed in the database may
// render BookingSuccessOriginal.
// =====================================================

const API_URL = (
  process.env.REACT_APP_BACKEND_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

const POLL_INTERVAL_MS = 2500;

const MAX_AUTO_CHECKS = 24;

// =====================================================
// ACCESSIBILITY STYLES
// =====================================================

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71935] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

// =====================================================
// PAYMENT OUTCOMES
// =====================================================

const OUTCOMES = {
  PAYMENT_FAILED: {
    title: "Payment not completed.",
    description:
      "This payment has not been confirmed. Check your bookings before starting another payment.",
  },

  PAYMENT_RETRY_AVAILABLE: {
    title: "Payment needs attention.",
    description:
      "Stripe has not received a successful payment. Check your booking before trying again.",
  },

  CANCELLED: {
    title: "Booking cancelled.",
    description:
      "This reservation is cancelled. Do not use its ticket for entry.",
  },

  EXPIRED: {
    title: "Reservation expired.",
    description:
      "The reservation is no longer active. If you were charged, check your bookings and refund status before paying again.",
  },

  REFUND_PENDING: {
    title: "Refund being processed.",
    description:
      "This booking is not confirmed for entry. Check your bookings for refund updates.",
  },

  REFUNDED: {
    title: "Booking refunded.",
    description:
      "This booking has been refunded and its ticket is not valid for entry.",
  },

  REVIEW_REQUIRED: {
    title: "Payment needs review.",
    description:
      "The payment and booking records need reconciliation. Do not make another payment until the status is resolved.",
  },
};

// =====================================================
// PENDING PAYMENT DESCRIPTIONS
// =====================================================

function describePending(paymentState) {
  if (paymentState === "AWAITING_WEBHOOK") {
    return (
      "Stripe reports a successful payment. " +
      "We are waiting for the server to finish " +
      "confirming your exact seats. Do not pay again."
    );
  }

  if (paymentState === "PAYMENT_PENDING") {
    return (
      "The payment is still processing. " +
      "We will check again automatically. " +
      "Do not submit another payment while this is pending."
    );
  }

  return (
    "We're checking your booking with the payment server. " +
    "Please avoid starting another payment until the result is clear."
  );
}

// =====================================================
// ACCESSIBLE STATUS TEXT
// =====================================================

function getStatusAnnouncement(result) {
  if (result.phase === "CONFIRMED") {
    return (
      "Booking confirmed successfully. " +
      "Your confirmed cinema ticket is now available."
    );
  }

  if (result.phase === "CHECKING") {
    if (result.paymentState === "AWAITING_WEBHOOK") {
      return (
        "Payment received. Waiting for the server " +
        "to confirm your booking."
      );
    }

    if (result.paymentState === "PAYMENT_PENDING") {
      return (
        "Your payment is processing. " +
        "Your booking status is being checked automatically."
      );
    }

    return "Checking your booking status securely.";
  }

  if (result.phase === "DELAYED") {
    return (
      "Booking confirmation is taking longer than expected. " +
      "You can check again without making another payment."
    );
  }

  if (result.phase === "FINAL") {
    return (
      OUTCOMES[result.paymentState]?.title ||
      "Your booking requires attention."
    );
  }

  if (result.phase === "ERROR") {
    return (
      result.message ||
      "Unable to check your booking status."
    );
  }

  return "";
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function BookingSuccess() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const bookingId =
    searchParams.get("bookingId");

  const {
    token,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const reducedMotion = useReducedMotion();

  // Focus management for status changes.
  const headingRef = useRef(null);

  const previousPhaseRef = useRef(null);

  const [
    retryKey,
    setRetryKey,
  ] = useState(0);

  const [
    result,
    setResult,
  ] = useState({
    phase: "CHECKING",
    paymentState: null,
    bookingCode: null,
  });

  // ===================================================
  // AUTHENTICATION
  // ===================================================

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !token) {
      navigate("/auth", {
        replace: true,
      });

      return;
    }

    if (!bookingId) {
      navigate("/my-bookings", {
        replace: true,
      });
    }
  }, [
    authLoading,
    isAuthenticated,
    token,
    bookingId,
    navigate,
  ]);

  // ===================================================
  // PAYMENT RECOVERY AND CONFIRMATION
  // ===================================================

  useEffect(() => {
    if (
      authLoading ||
      !isAuthenticated ||
      !token ||
      !bookingId
    ) {
      return undefined;
    }

    const controller =
      new AbortController();

    let timer;

    let cancelled = false;

    setResult({
      phase: "CHECKING",
      paymentState: null,
      bookingCode: null,
    });

    const check = async (attempt) => {
      try {
        const { data } = await axios.get(
          `${API_URL}/api/payments/recovery/${encodeURIComponent(
            bookingId
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },

            signal: controller.signal,

            timeout: 12000,
          }
        );

        if (cancelled) return;

        const paymentState =
          data.paymentState ||
          "NOT_STARTED";

        const common = {
          paymentState,
          bookingCode:
            data.bookingCode ||
            null,
        };

        // =================================================
        // VERIFIED CONFIRMATION
        // =================================================
        //
        // The database decides whether the ticket
        // is valid. A successful Stripe charge alone
        // cannot issue an admission pass.
        // =================================================

        if (
          data.bookingStatus === "CONFIRMED" &&
          paymentState === "CONFIRMED"
        ) {
          setResult({
            phase: "CONFIRMED",
            ...common,
          });

          return;
        }

        // =================================================
        // FINAL PAYMENT / BOOKING OUTCOMES
        // =================================================

        if (
          Object.prototype.hasOwnProperty.call(
            OUTCOMES,
            paymentState
          )
        ) {
          setResult({
            phase: "FINAL",
            ...common,
          });

          return;
        }

        // =================================================
        // MAXIMUM AUTOMATIC CHECKS
        // =================================================

        if (
          attempt + 1 >=
          MAX_AUTO_CHECKS
        ) {
          setResult({
            phase: "DELAYED",
            ...common,
          });

          return;
        }

        // =================================================
        // CONTINUE POLLING
        // =================================================

        setResult({
          phase: "CHECKING",
          ...common,
        });

        const interval = Math.max(
          POLL_INTERVAL_MS,
          Math.min(
            10000,
            Number(
              data.retryAfterSeconds ||
              0
            ) * 1000
          )
        );

        timer = window.setTimeout(
          () => {
            void check(attempt + 1);
          },
          interval
        );
      } catch (error) {
        if (
          cancelled ||
          controller.signal.aborted ||
          axios.isCancel(error)
        ) {
          return;
        }

        const status =
          error.response?.status;

        // =================================================
        // NON-RETRYABLE ACCESS ERRORS
        // =================================================

        if (
          status === 401 ||
          status === 403 ||
          status === 404 ||
          status === 400
        ) {
          setResult({
            phase: "ERROR",

            message:
              status === 404
                ? "This booking was not found in your account."
                : error.response?.data?.message ||
                  "Unable to access this booking.",
          });

          return;
        }

        // =================================================
        // RETRYABLE SERVICE ERRORS
        // =================================================

        if (
          attempt + 1 >=
          MAX_AUTO_CHECKS
        ) {
          setResult({
            phase: "ERROR",

            message:
              "The payment service is temporarily unavailable. Check your bookings before paying again.",
          });

          return;
        }

        timer = window.setTimeout(
          () => {
            void check(attempt + 1);
          },
          POLL_INTERVAL_MS
        );
      }
    };

    void check(0);

    return () => {
      cancelled = true;

      controller.abort();

      window.clearTimeout(timer);
    };
  }, [
    authLoading,
    isAuthenticated,
    token,
    bookingId,
    retryKey,
  ]);

  // ===================================================
  // KEYBOARD FOCUS MANAGEMENT
  // ===================================================
  //
  // Focus the status heading when:
  // - The page initially opens
  // - Checking transitions to a final outcome
  // - A manual retry starts
  //
  // Do not steal keyboard focus on every poll.
  // ===================================================

  useEffect(() => {
    if (authLoading) return;

    if (
      previousPhaseRef.current ===
      result.phase
    ) {
      return;
    }

    previousPhaseRef.current =
      result.phase;

    if (
      result.phase === "CONFIRMED"
    ) {
      return;
    }

    headingRef.current?.focus({
      preventScroll: true,
    });
  }, [
    result.phase,
    authLoading,
  ]);

  // ===================================================
  // VERIFIED BOOKING — ORIGINAL TICKET UI
  // ===================================================

  if (
    result.phase === "CONFIRMED"
  ) {
    return (
      <>
        <span
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          Booking confirmed successfully.
          Your cinema ticket is ready.
        </span>

        <BookingSuccessOriginal />
      </>
    );
  }

  // ===================================================
  // DERIVED PAYMENT STATUS
  // ===================================================

  const checking =
    result.phase === "CHECKING";

  const delayed =
    result.phase === "DELAYED";

  const outcome =
    OUTCOMES[result.paymentState];

  const title = checking
    ? "Confirming your booking."
    : delayed
      ? "Confirmation is taking longer."
      : outcome?.title ||
        "Booking status unavailable.";

  const description = checking
    ? describePending(
        result.paymentState
      )
    : delayed
      ? (
          "We could not confirm the final outcome yet. " +
          "You can safely check again without starting a new charge."
        )
      : outcome?.description ||
        result.message ||
        "Check your bookings before attempting another payment.";

  const Icon =
    checking || delayed
      ? Clock3
      : outcome || result.phase === "ERROR"
        ? CircleAlert
        : Ticket;

  // ===================================================
  // MANUAL RECHECK
  // ===================================================

  const handleRetry = () => {
    setResult({
      phase: "CHECKING",
      paymentState: null,
      bookingCode:
        result.bookingCode ||
        null,
    });

    setRetryKey(
      (value) => value + 1
    );
  };

  // ===================================================
  // PAGE RENDER
  // ===================================================

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[#09090b] px-4 pb-20 pt-28 text-white"
      data-testid="booking-confirmation"
    >
      {/* SCREEN-READER STATUS ANNOUNCEMENT */}

      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {getStatusAnnouncement(result)}
      </span>

      <div className="mx-auto max-w-3xl">
        <motion.section
          initial={
            reducedMotion
              ? false
              : {
                  opacity: 0,
                  y: 16,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: reducedMotion
              ? 0
              : 0.4,
          }}
          className="overflow-hidden rounded-[28px] border border-white/10 bg-[#151518] p-7 sm:p-12"
          aria-labelledby="bms-booking-status-heading"
          aria-describedby="bms-booking-status-description"
        >
          {/* SECTION LABEL */}

          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#ed657c]">
            <span
              aria-hidden="true"
              className="h-px w-8 bg-[#D71935]"
            />

            BookMySeat / Payment recovery
          </p>

          {/* STATUS ICON */}

          <div
            className="mt-9 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D71935]/30 bg-[#D71935]/10 text-[#f0758a]"
            aria-hidden="true"
          >
            <Icon
              size={28}
              className={
                checking &&
                !reducedMotion
                  ? "animate-pulse"
                  : ""
              }
            />
          </div>

          {/* STATUS HEADING */}

          <h1
            ref={headingRef}
            id="bms-booking-status-heading"
            tabIndex={-1}
            className="mt-7 text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-tight tracking-[-0.055em] focus:outline-none"
          >
            {title}
          </h1>

          {/* STATUS DESCRIPTION */}

          <p
            id="bms-booking-status-description"
            className="mt-4 max-w-xl text-sm leading-7 text-[#acabb4]"
          >
            {description}
          </p>

          {/* BOOKING REFERENCE */}

          {result.bookingCode && (
            <p className="mt-6 font-mono text-xs tracking-wide text-white/70">
              <span className="sr-only">
                Booking reference:
              </span>

              <span aria-hidden="true">
                Reference:{" "}
              </span>

              {result.bookingCode}
            </p>
          )}

          {/* CHECKING INDICATOR */}

          {checking && (
            <p
              className="mt-8 flex items-center gap-3 text-xs text-[#a8a8b2]"
            >
              <RefreshCw
                size={15}
                aria-hidden="true"
                className={
                  reducedMotion
                    ? ""
                    : "animate-spin"
                }
              />

              Checking securely with the server...
            </p>
          )}

          {/* ACTIONS */}

          <div className="mt-9 flex flex-wrap gap-3 border-t border-white/10 pt-6">
            {!checking && (
              <button
                type="button"
                onClick={handleRetry}
                data-testid="booking-check-again"
                className={`inline-flex min-h-12 items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ef2947] motion-reduce:transition-none ${focusRing}`}
              >
                <RefreshCw
                  size={16}
                  aria-hidden="true"
                />

                Check again
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                navigate("/my-bookings")
              }
              data-testid="booking-view-bookings"
              className={`inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5 motion-reduce:transition-none ${focusRing}`}
            >
              My bookings

              <ArrowRight
                size={16}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* PAYMENT SAFETY NOTICE */}

          <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-white/65">
            <ShieldCheck
              size={15}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[#e15e76]"
            />

            <span>
              A successful card charge alone never
              issues a ticket. Only a confirmed
              booking displays the QR pass.
            </span>
          </p>
        </motion.section>
      </div>
    </main>
  );
}
