
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Armchair,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Film,
  Info,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Ticket,
  Timer,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useAuth } from "../context/AuthContext";
import "./CheckoutCinema.css";

// Preserve the existing API, Stripe and checkout storage contracts.
const API_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
const CHECKOUT_KEY = "bookmyseat_checkout";
const PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71935] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const clock = (seconds) => {
  const n = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};

const validImage = (value) =>
  typeof value === "string" && /^(https?:\/\/|\/\/)/i.test(value.trim())
    ? value.trim()
    : "";

const showDate = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return "Date unavailable";
  }
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
};

const showTime = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return "Time unavailable";
  }
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
};

const elementStyle = {
  style: {
    base: {
      color: "#f7f7f9",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "15px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#a1a1aa" },
    },
    invalid: { color: "#ff637a" },
  },
};

const cardFieldName = {
  number: "Card number",
  expiry: "Expiry date",
  cvc: "Security code",
};

// Card numbers, expiry and CVC stay exclusively inside Stripe Elements.
function PaymentForm({
  clientSecret,
  amount,
  bookingId,
  showId,
  seatIds,
  show,
  remainingSeconds,
  onProcessingChange,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const nameInputRef = useRef(null);
  const submittingRef = useRef(false);
  const paidRef = useRef(false);
  const noticeThresholdRef = useRef(0);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [focused, setFocused] = useState("");
  const [processing, setProcessing] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [timeNotice, setTimeNotice] = useState("");
  const [completed, setCompleted] = useState({
    number: false,
    expiry: false,
    cvc: false,
  });
  const [fieldErrors, setFieldErrors] = useState({
    number: "",
    expiry: "",
    cvc: "",
  });

  const cardLabel =
    brand && !["unknown", "card"].includes(brand)
      ? brand.replace(/\b\w/g, (letter) => letter.toUpperCase())
      : "SECURE CARD";

  // Announce meaningful countdown thresholds, not every second.
  useEffect(() => {
    if (processing || remainingSeconds <= 0) return;

    const threshold =
      remainingSeconds <= 10
        ? 10
        : remainingSeconds <= 30
          ? 30
          : remainingSeconds <= 60
            ? 60
            : 0;

    if (threshold && noticeThresholdRef.current !== threshold) {
      noticeThresholdRef.current = threshold;
      setTimeNotice(
        threshold === 10
          ? "Ten seconds remain on your seat reservation."
          : threshold === 30
            ? "Thirty seconds remain on your seat reservation."
            : "One minute remains on your seat reservation."
      );
    }
  }, [remainingSeconds, processing]);

  const onFieldChange = (field, event) => {
    setCompleted((previous) => ({
      ...previous,
      [field]: Boolean(event.complete),
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [field]: event.error?.message || "",
    }));

    if (field === "number") setBrand(event.brand || "");
    if (submitError) setSubmitError("");
  };

  const reportError = (message) => {
    setSubmitError(message);
    toast.error(message);
  };

  const focusStripeField = (field) => {
    const fieldTypes = {
      number: CardNumberElement,
      expiry: CardExpiryElement,
      cvc: CardCvcElement,
    };

    elements?.getElement(fieldTypes[field])?.focus();
  };

  const finish = useCallback(
    (processingAtWebhook = false) => {
      sessionStorage.removeItem(CHECKOUT_KEY);

      navigate(`/booking-success?bookingId=${encodeURIComponent(bookingId)}`, {
        replace: true,
        state: {
          bookingId,
          showId,
          seatIds,
          ...(processingAtWebhook ? { processing: true } : {}),
        },
      });
    },
    [bookingId, showId, seatIds, navigate]
  );

  const handlePayment = async (event) => {
    event.preventDefault();

    // Ref prevents a second synchronous submit before React re-renders.
    if (!stripe || !elements || submittingRef.current || paidRef.current) {
      return;
    }

    if (remainingSeconds <= 0) {
      reportError("Seat hold expired. Return to your seats to start again.");
      return;
    }

    if (!name.trim()) {
      reportError("Enter the cardholder name.");
      nameInputRef.current?.focus();
      return;
    }

    for (const field of ["number", "expiry", "cvc"]) {
      if (!completed[field]) {
        reportError(
          fieldErrors[field] ||
            `Complete the ${cardFieldName[field].toLowerCase()} field.`
        );
        focusStripeField(field);
        return;
      }
    }

    const card = elements.getElement(CardNumberElement);

    if (!card) {
      reportError("Card details are not ready.");
      return;
    }

    setSubmitError("");
    submittingRef.current = true;
    setProcessing(true);
    onProcessingChange(true);

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card,
            billing_details: { name: name.trim() },
          },
        }
      );

      if (error) {
        reportError(error.message || "Payment failed.");
        submittingRef.current = false;
        setProcessing(false);
        onProcessingChange(false);
        return;
      }

      if (paymentIntent?.status !== "succeeded") {
        const message =
          "Payment is still processing. Please check its status before trying again.";

        setSubmitError(message);
        toast(message);
        submittingRef.current = false;
        setProcessing(false);
        onProcessingChange(false);
        return;
      }

      // Never request a second charge after a successful payment.
      paidRef.current = true;

      // Keep the existing webhook confirmation polling behavior.
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 700));

        try {
          const response = await axios.get(`${API_URL}/api/shows/${showId}`);

          const booked = new Set(
            (response.data?.show?.bookedSeats || []).map((seat) =>
              String(seat).toUpperCase()
            )
          );

          if (
            seatIds.every((seat) =>
              booked.has(String(seat).toUpperCase())
            )
          ) {
            finish(false);
            return;
          }
        } catch (pollError) {
          console.warn("Booking confirmation is pending:", pollError);
        }
      }

      finish(true);
    } catch (error) {
      console.error("Checkout payment error:", error);

      if (paidRef.current) {
        finish(true);
      } else {
        reportError(
          "Unable to complete payment. No new payment has been requested."
        );
        submittingRef.current = false;
        setProcessing(false);
        onProcessingChange(false);
      }
    }
  };

  return (
    <>
      <form
        className="bmsc-main-grid"
        onSubmit={handlePayment}
        aria-busy={processing}
        noValidate
      >
        {/* LEFT — TICKET AND ORDER SUMMARY */}

        <div className="bmsc-left-stack">
          <div className="bmsc-section-kicker">
            <span aria-hidden="true" /> YOUR CINEMA PASS{" "}
            <span aria-hidden="true" />
          </div>

          <motion.div
            className="bmsc-ticket"
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.65 }}
          >
            <div className="bmsc-ticket-top">
              <div className="bmsc-ticket-poster">
                {validImage(show?.movie?.poster) ? (
                  <img
                    src={validImage(show.movie.poster)}
                    alt={`${show.movie.title || "Film"} poster`}
                  />
                ) : (
                  <Film size={31} aria-hidden="true" />
                )}
              </div>

              <div className="bmsc-ticket-film">
                <span>ADMIT ONE · BOOKMYSEAT</span>
                <h2>{show?.movie?.title || "Your screening"}</h2>
                <p>
                  <MapPin size={14} aria-hidden="true" />{" "}
                  {show?.theatre?.name || "Selected cinema"}
                </p>
                <p>
                  <Film size={14} aria-hidden="true" />{" "}
                  {show?.screen?.name || "Auditorium"}
                </p>
              </div>
            </div>

            <div className="bmsc-ticket-perf" aria-hidden="true">
              <div className="bmsc-ticket-cut bmsc-ticket-cut--left" />
              <div className="bmsc-ticket-cut bmsc-ticket-cut--right" />
            </div>

            <div className="bmsc-ticket-bottom">
              <div>
                <span>DATE</span>
                <strong>{showDate(show?.startTime)}</strong>
              </div>

              <div>
                <span>TIME</span>
                <strong>{showTime(show?.startTime)}</strong>
              </div>

              <div>
                <span>SEATS</span>
                <strong>{seatIds.join(", ")}</strong>
              </div>
            </div>

            <div className="bmsc-ticket-end">
              <span>BOOKMYSEAT / CINEMA EXPERIENCE</span>
              <span>
                01 — {String(seatIds.length).padStart(2, "0")}
              </span>
            </div>
          </motion.div>

          <div className="bmsc-receipt">
            <div className="bmsc-receipt-heading">
              <Ticket size={18} aria-hidden="true" />
              <h3>Order overview</h3>
              <span>
                {seatIds.length}{" "}
                {seatIds.length === 1 ? "ticket" : "tickets"}
              </span>
            </div>

            <div className="bmsc-receipt-row">
              <span>Tickets & applicable charges</span>
              <strong>{money(amount)}</strong>
            </div>

            <p className="bmsc-receipt-note">
              <Info size={14} aria-hidden="true" />
              Final payable amount is provided by the payment server.
            </p>

            <div
              className="bmsc-receipt-divider"
              aria-hidden="true"
            />

            <div className="bmsc-receipt-total">
              <span>PAYABLE NOW</span>
              <strong>{money(amount)}</strong>
            </div>

            <div
              className={`bmsc-receipt-timer ${
                remainingSeconds < 60
                  ? "bmsc-receipt-timer--urgent"
                  : ""
              }`}
            >
              <span>
                <Timer size={16} aria-hidden="true" /> Seats reserved for
              </span>

              <strong
                aria-live="off"
                aria-label={`${clock(remainingSeconds)} remaining`}
              >
                {clock(remainingSeconds)}
              </strong>
            </div>

            <span
              className="sr-only"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {timeNotice}
            </span>
          </div>
        </div>

        {/* RIGHT — STRIPE PAYMENT FORM */}

        <motion.section
          className="bmsc-payment-panel"
          aria-labelledby="bmsc-payment-heading"
          initial={reducedMotion ? false : { opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.65,
            delay: reducedMotion ? 0 : 0.1,
          }}
        >
          <div className="bmsc-panel-topline">
            <span className="bmsc-live-dot" aria-hidden="true" />
            ENCRYPTED CHECKOUT
            <span className="bmsc-panel-topline-right">
              02 / 02
            </span>
          </div>

          <div className="bmsc-panel-title">
            <div>
              <p>ONE LAST STEP</p>
              <h2 id="bmsc-payment-heading">
                Complete your booking.
              </h2>
              <span>
                Enter your card details securely to confirm these seats.
              </span>
            </div>

            <ShieldCheck size={29} aria-hidden="true" />
          </div>

          {/* Decorative preview — never contains real card data. */}

          <div className="bmsc-card-stage" aria-hidden="true">
            <motion.div
              className="bmsc-card-rotator"
              animate={{
                rotateY:
                  !reducedMotion && focused === "cvc" ? 180 : 0,
              }}
              transition={{
                duration: reducedMotion ? 0 : 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="bmsc-card-face bmsc-card-front">
                <div className="bmsc-card-glow" />

                <div className="bmsc-card-head">
                  <span className="bmsc-card-chip">
                    <i />
                    <i />
                  </span>
                  <span>{cardLabel}</span>
                </div>

                <div className="bmsc-card-dots">
                  ••••&nbsp; ••••&nbsp; ••••&nbsp; ••••
                </div>

                <div className="bmsc-card-foot">
                  <span>
                    <small>CARDHOLDER</small>
                    <strong>{name.trim() || "YOUR NAME"}</strong>
                  </span>

                  <span>
                    <small>EXPIRY</small>
                    <strong>MM/YY</strong>
                  </span>
                </div>
              </div>

              <div className="bmsc-card-face bmsc-card-back">
                <div className="bmsc-card-stripe" />

                <div className="bmsc-card-back-cvc">
                  <small>SECURITY CODE</small>
                  <strong>•••</strong>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="bmsc-form-title">
            <span>
              <CreditCard size={17} aria-hidden="true" /> Card details
            </span>
            <span>POWERED BY STRIPE</span>
          </div>

          <div className="bmsc-fields">
            {/* CARDHOLDER NAME */}

            <label
              className="bmsc-field"
              htmlFor="bmsc-cardholder-name"
            >
              <span>Cardholder name</span>

              <input
                ref={nameInputRef}
                id="bmsc-cardholder-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (submitError) setSubmitError("");
                }}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused("")}
                autoComplete="cc-name"
                placeholder="Name on card"
                maxLength={100}
                required
                disabled={processing}
                aria-required="true"
                aria-invalid={Boolean(submitError && !name.trim())}
                className={focusRing}
              />
            </label>

            {/* CARD NUMBER */}

            <div
              className="bmsc-field"
              role="group"
              aria-labelledby="bmsc-card-number-label"
            >
              <span id="bmsc-card-number-label">
                Card number{" "}
                {completed.number && (
                  <CheckCircle2
                    size={14}
                    aria-label="Complete"
                  />
                )}
              </span>

              <div
                className={`bmsc-stripe-field focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#D71935] ${
                  fieldErrors.number ? "border-red-400" : ""
                }`}
              >
                <CardNumberElement
                  options={elementStyle}
                  onFocus={() => setFocused("number")}
                  onBlur={() => setFocused("")}
                  onChange={(event) =>
                    onFieldChange("number", event)
                  }
                />
              </div>

              {fieldErrors.number && (
                <p className="mt-1 text-xs text-[#ff899d]">
                  {fieldErrors.number}
                </p>
              )}
            </div>

            {/* EXPIRY AND SECURITY CODE */}

            <div className="bmsc-field-grid">
              <div
                className="bmsc-field"
                role="group"
                aria-labelledby="bmsc-card-expiry-label"
              >
                <span id="bmsc-card-expiry-label">
                  Expiry date{" "}
                  {completed.expiry && (
                    <CheckCircle2
                      size={14}
                      aria-label="Complete"
                    />
                  )}
                </span>

                <div
                  className={`bmsc-stripe-field focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#D71935] ${
                    fieldErrors.expiry ? "border-red-400" : ""
                  }`}
                >
                  <CardExpiryElement
                    options={elementStyle}
                    onFocus={() => setFocused("expiry")}
                    onBlur={() => setFocused("")}
                    onChange={(event) =>
                      onFieldChange("expiry", event)
                    }
                  />
                </div>

                {fieldErrors.expiry && (
                  <p className="mt-1 text-xs text-[#ff899d]">
                    {fieldErrors.expiry}
                  </p>
                )}
              </div>

              <div
                className="bmsc-field"
                role="group"
                aria-labelledby="bmsc-card-cvc-label"
              >
                <span id="bmsc-card-cvc-label">
                  Security code{" "}
                  {completed.cvc && (
                    <CheckCircle2
                      size={14}
                      aria-label="Complete"
                    />
                  )}
                </span>

                <div
                  className={`bmsc-stripe-field focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#D71935] ${
                    fieldErrors.cvc ? "border-red-400" : ""
                  }`}
                >
                  <CardCvcElement
                    options={elementStyle}
                    onFocus={() => setFocused("cvc")}
                    onBlur={() => setFocused("")}
                    onChange={(event) =>
                      onFieldChange("cvc", event)
                    }
                  />
                </div>

                {fieldErrors.cvc && (
                  <p className="mt-1 text-xs text-[#ff899d]">
                    {fieldErrors.cvc}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ACCESSIBLE PAYMENT ERRORS */}

          {submitError && (
            <p
              className="mt-4 rounded-xl border border-red-400/35 bg-red-400/10 p-3 text-sm text-[#ffacb9]"
              role="alert"
            >
              {submitError}
            </p>
          )}

          {/* SUBMIT PAYMENT */}

          <button
            type="submit"
            className={`bmsc-pay-button ${focusRing}`}
            disabled={
              !stripe ||
              processing ||
              remainingSeconds <= 0 ||
              paidRef.current
            }
            aria-busy={processing}
          >
            <LockKeyhole size={17} aria-hidden="true" />
            <span>
              {processing
                ? "Confirming secure payment…"
                : `Pay ${money(amount)} securely`}
            </span>
            <ArrowRight size={19} aria-hidden="true" />
          </button>

          <div className="bmsc-security-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              Card details are processed by Stripe. BookMySeat does
              not store your card number or CVC.
            </span>
          </div>
        </motion.section>
      </form>

      {/* PAYMENT PROCESSING ANNOUNCEMENT */}

      <AnimatePresence>
        {processing && (
          <motion.div
            className="bmsc-processing"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="bmsc-processing-inner">
              <div className="bmsc-processing-ring">
                <ShieldCheck size={33} aria-hidden="true" />
              </div>

              <p>SECURE PAYMENT</p>
              <h2>Confirming your booking</h2>
              <span>
                Please keep this page open while we check your
                payment and reservation.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================
// PAGE CONTROLLER — PRESERVE PAYMENTINTENT AND HOLD CONTRACT
// ============================================================

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    token,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const headingRef = useRef(null);

  const [processing, setProcessing] = useState(false);
  const [returning, setReturning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState(null);
  const [payment, setPayment] = useState(null);
  const [show, setShow] = useState(null);
  const [seconds, setSeconds] = useState(0);

  const checkout = useMemo(() => {
    if (location.state?.showId) {
      return location.state;
    }

    try {
      return JSON.parse(
        sessionStorage.getItem(CHECKOUT_KEY) || "null"
      );
    } catch {
      return null;
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.showId) {
      sessionStorage.setItem(
        CHECKOUT_KEY,
        JSON.stringify(location.state)
      );
    }
  }, [location.state]);

  // Focus the heading when entering checkout.
  useEffect(() => {
    if (!authLoading) {
      headingRef.current?.focus({
        preventScroll: true,
      });
    }
  }, [authLoading]);

  // ==========================================================
  // CREATE PAYMENT INTENT — EXISTING FLOW
  // ==========================================================

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !token) {
      navigate("/auth", {
        replace: true,
      });
      return;
    }

    if (
      !checkout?.showId ||
      !checkout?.lockId ||
      !checkout?.seatIds?.length
    ) {
      setLoading(false);
      return;
    }

    // Preserve deferred initialization and backend idempotency.
    let active = true;

    const start = async () => {
      try {
        const [paymentResponse, showResponse] =
          await Promise.all([
            axios.post(
              `${API_URL}/api/payments/create-intent`,
              {
                showId: checkout.showId,
                seatIds: checkout.seatIds,
                lockId: checkout.lockId,
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            ),

            axios.get(
              `${API_URL}/api/shows/${checkout.showId}`
            ),
          ]);

        if (!active) return;

        setPayment(paymentResponse.data);
        setSecret(paymentResponse.data.clientSecret);
        setShow(showResponse.data?.show);
      } catch (problem) {
        if (!active) return;

        console.error(
          "Checkout initialization:",
          problem
        );

        const message =
          problem.response?.data?.message ||
          "Unable to start checkout.";

        setError(message);
        toast.error(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const requestTimer = setTimeout(start, 0);

    return () => {
      active = false;
      clearTimeout(requestTimer);
    };
  }, [
    authLoading,
    isAuthenticated,
    token,
    checkout,
    navigate,
  ]);

  // ==========================================================
  // RESERVATION COUNTDOWN — EXISTING FLOW
  // ==========================================================

  useEffect(() => {
    const expiresAt =
      payment?.lockExpiresAt ||
      checkout?.expiresAt;

    if (!expiresAt) return;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (
            new Date(expiresAt).getTime() -
            Date.now()
          ) / 1000
        )
      );

      setSeconds(remaining);

      if (remaining === 0 && !processing) {
        sessionStorage.removeItem(CHECKOUT_KEY);
      }
    };

    tick();

    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [payment, checkout, processing]);

  // ==========================================================
  // BACK TO SEATS — EXISTING HOLD RELEASE
  // ==========================================================

  const backToSeats = async () => {
    if (returning || processing || !checkout) {
      return;
    }

    setReturning(true);

    try {
      await axios.delete(
        `${API_URL}/api/seat-locks/release`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: {
            showId: checkout.showId,
            seatIds: checkout.seatIds,
            lockId: checkout.lockId,
          },
        }
      );
    } catch (problem) {
      console.warn(
        "Hold release during navigation:",
        problem
      );
    }

    sessionStorage.removeItem(CHECKOUT_KEY);

    navigate(
      checkout.movieId
        ? `/booking/${checkout.movieId}?show=${encodeURIComponent(
            checkout.showId
          )}${
            show?.theatre?._id
              ? `&theatre=${encodeURIComponent(
                  show.theatre._id
                )}`
              : ""
          }`
        : "/cinemas",
      {
        replace: true,
      }
    );
  };

  // ==========================================================
  // CHECKOUT PAGE
  // ==========================================================

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bmsc-page"
      data-design-version="BMS_CHECKOUT_CINEMATIC_V3"
    >
      <div
        className="bmsc-ambient"
        aria-hidden="true"
      />

      <div className="bmsc-container">
        {/* PROGRESS INDICATOR */}

        <nav
          className="bmsc-breadcrumb"
          aria-label="Booking progress"
        >
          <span>01 &nbsp; SELECT SEATS</span>
          <ChevronRight
            size={14}
            aria-hidden="true"
          />
          <strong aria-current="step">
            02 &nbsp; SECURE CHECKOUT
          </strong>
          <ChevronRight
            size={14}
            aria-hidden="true"
          />
          <span>03 &nbsp; CONFIRMATION</span>
        </nav>

        {/* PAGE HEADING */}

        <div className="bmsc-page-heading">
          <div>
            <p>THE FINAL SCENE</p>

            <h1
              ref={headingRef}
              tabIndex={-1}
            >
              Make it <em>official.</em>
            </h1>

            <span>
              Your seats are almost yours.
              One secure payment to go.
            </span>
          </div>

          <div className="bmsc-heading-assurance">
            <ShieldCheck
              size={18}
              aria-hidden="true"
            />
            <span>
              ENCRYPTED
              <br />
              PAYMENT
            </span>
          </div>
        </div>

        {/* BACK ACTIONS AND HOLD TIMER */}

        <div className="bmsc-top-actions">
          <button
            type="button"
            onClick={backToSeats}
            disabled={
              returning ||
              processing ||
              !checkout
            }
            className={focusRing}
          >
            <ArrowLeft
              size={16}
              aria-hidden="true"
            />

            {returning
              ? "Releasing seats…"
              : "Back to seats"}
          </button>

          {!!checkout && (
            <div>
              <span
                className="bmsc-live-dot"
                aria-hidden="true"
              />
              {" "}SEATS HELD{" "}

              <span className="bmsc-time-badge">
                <Clock3
                  size={14}
                  aria-hidden="true"
                />

                <span
                  aria-label={`${clock(seconds)} remaining`}
                  aria-live="off"
                >
                  {clock(seconds)}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* LOADING STATE */}

        {loading || authLoading ? (
          <div
            className="bmsc-state"
            role="status"
            aria-live="polite"
          >
            <span
              className="bmsc-spinner"
              aria-hidden="true"
            />

            <h2>Preparing your secure checkout</h2>

            <p>
              Confirming your reservation and
              payment session.
            </p>
          </div>
        ) : !checkout ? (
          /* NO ACTIVE CHECKOUT */

          <div className="bmsc-state">
            <Armchair
              size={36}
              aria-hidden="true"
            />

            <h2>No active checkout</h2>

            <p>
              Select a showtime and seats before
              checking out.
            </p>

            <button
              type="button"
              className={focusRing}
              onClick={() =>
                navigate("/cinemas")
              }
            >
              Browse cinemas
              <ArrowRight
                size={16}
                aria-hidden="true"
              />
            </button>
          </div>
        ) : error ? (
          /* PAYMENT INITIALIZATION ERROR */

          <div
            className="bmsc-state"
            role="alert"
          >
            <Info
              size={36}
              aria-hidden="true"
            />

            <h2>Checkout unavailable</h2>

            <p>{error}</p>

            <button
              type="button"
              className={focusRing}
              onClick={backToSeats}
            >
              Return to seats
              <ArrowRight
                size={16}
                aria-hidden="true"
              />
            </button>
          </div>
        ) : seconds <= 0 && !processing ? (
          /* EXPIRED SEAT HOLD */

          <div
            className="bmsc-state"
            role="alert"
          >
            <Timer
              size={36}
              aria-hidden="true"
            />

            <h2>Reservation expired</h2>

            <p>
              Your seat hold has ended. Choose
              your seats again to continue.
            </p>

            <button
              type="button"
              className={focusRing}
              onClick={backToSeats}
            >
              Select seats again
              <ArrowRight
                size={16}
                aria-hidden="true"
              />
            </button>
          </div>
        ) : !secret || !payment || !stripePromise ? (
          /* STRIPE UNAVAILABLE */

          <div
            className="bmsc-state"
            role="alert"
          >
            <Info
              size={36}
              aria-hidden="true"
            />

            <h2>Secure payment unavailable</h2>

            <p>
              Stripe has not initialized. Check the
              frontend's Stripe publishable key configuration.
            </p>
          </div>
        ) : (
          /* EXISTING STRIPE ELEMENTS INTEGRATION */

          <Elements stripe={stripePromise}>
            <PaymentForm
              clientSecret={secret}
              amount={payment.amount}
              bookingId={payment.bookingId}
              showId={checkout.showId}
              seatIds={checkout.seatIds}
              show={show}
              remainingSeconds={seconds}
              onProcessingChange={setProcessing}
            />
          </Elements>
        )}

        {/* FOOTER */}

        <footer className="bmsc-footer">
          <span>
            © BookMySeat · Cinema, uninterrupted.
          </span>

          <span>
            <LockKeyhole
              size={13}
              aria-hidden="true"
            />
            Secure checkout by Stripe
          </span>
        </footer>
      </div>
    </main>
  );
}
