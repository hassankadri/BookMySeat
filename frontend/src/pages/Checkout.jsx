
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Same API and storage contract as the existing checkout.
const API_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
const CHECKOUT_KEY = "bookmyseat_checkout";
const PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const clock = (seconds) => {
  const n = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};
const validImage = (value) =>
  typeof value === "string" && /^(https?:\/\/|\/)/i.test(value.trim())
    ? value.trim()
    : "";
const showDate = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
};
const showTime = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
  }).format(new Date(value));
};

const elementStyle = {
  style: {
    base: {
      color: "#f7f7f9",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "15px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#696b78" },
    },
    invalid: { color: "#ff637a" },
  },
};

// ============================================================
// STRIPE PAYMENT FORM. Card numbers, CVC, and expiry are handled
// only by Stripe Elements, never by our own inputs or state.
// ============================================================
function PaymentForm({
  clientSecret, amount, bookingId, showId, seatIds, show, remainingSeconds,
  onProcessingChange,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [focused, setFocused] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState({ number: false, expiry: false, cvc: false });
  const paidRef = useRef(false);

  const cardLabel = brand && !["unknown", "card"].includes(brand)
    ? brand.replace(/\b\w/g, (x) => x.toUpperCase()) : "SECURE CARD";

  const onFieldChange = (field, event) => {
    setCompleted((prev) => ({ ...prev, [field]: Boolean(event.complete) }));
    if (field === "number") setBrand(event.brand || "");
    if (event.error?.message) {
      // The field already shows its invalid state within Stripe Elements.
    }
  };

  const finish = useCallback((processingAtWebhook = false) => {
    sessionStorage.removeItem(CHECKOUT_KEY);
    navigate(`/booking-success?bookingId=${encodeURIComponent(bookingId)}`, {
      replace: true,
      state: { bookingId, showId, seatIds, ...(processingAtWebhook ? { processing: true } : {}) },
    });
  }, [bookingId, showId, seatIds, navigate]);

  const handlePayment = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || processing || paidRef.current) return;
    if (remainingSeconds <= 0) {
      toast.error("Seat hold expired. Return to your seats to start again.");
      return;
    }
    if (!name.trim()) {
      toast.error("Enter the cardholder name.");
      return;
    }
    const card = elements.getElement(CardNumberElement);
    if (!card) {
      toast.error("Card details are not ready.");
      return;
    }

    setProcessing(true);
    onProcessingChange(true);
    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: { name: name.trim() },
        },
      });
      if (error) {
        toast.error(error.message || "Payment failed.");
        setProcessing(false);
        onProcessingChange(false);
        return;
      }
      if (paymentIntent?.status !== "succeeded") {
        toast("Payment is still processing. Please check its status before trying again.");
        setProcessing(false);
        onProcessingChange(false);
        return;
      }

      // A successful charge is never retried because confirmation is slow.
      paidRef.current = true;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        try {
          const response = await axios.get(`${API_URL}/api/shows/${showId}`);
          const booked = new Set(
            (response.data?.show?.bookedSeats || []).map((seat) =>
              String(seat).toUpperCase()
            )
          );
          if (seatIds.every((seat) => booked.has(String(seat).toUpperCase()))) {
            finish(false);
            return;
          }
        } catch (pollError) {
          console.warn("Booking confirmation is pending:", pollError);
        }
      }
      // Preserve the existing success page's pending-webhook state.
      finish(true);
    } catch (error) {
      console.error("Checkout payment error:", error);
      if (paidRef.current) {
        // The charge succeeded, even if checking the booking later failed.
        finish(true);
      } else {
        toast.error("Unable to complete payment. No new payment has been requested.");
        setProcessing(false);
        onProcessingChange(false);
      }
    }
  };

  return (
    <>
      <form className="bmsc-main-grid" onSubmit={handlePayment}>
        {/* LEFT — TICKET / CARD / ORDER SUMMARY */}
        <div className="bmsc-left-stack">
          <div className="bmsc-section-kicker"><span /> YOUR CINEMA PASS <span /></div>
          <motion.div
            className="bmsc-ticket"
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            <div className="bmsc-ticket-top">
              <div className="bmsc-ticket-poster">
                {validImage(show?.movie?.poster) ? (
                  <img src={validImage(show.movie.poster)} alt={`${show.movie.title} poster`} />
                ) : <Film size={31} />}
              </div>
              <div className="bmsc-ticket-film">
                <span>ADMIT ONE · BOOKMYSEAT</span>
                <h2>{show?.movie?.title || "Your screening"}</h2>
                <p><MapPin size={14} /> {show?.theatre?.name || "Selected cinema"}</p>
                <p><Film size={14} /> {show?.screen?.name || "Auditorium"}</p>
              </div>
            </div>
            <div className="bmsc-ticket-perf">
              <div className="bmsc-ticket-cut bmsc-ticket-cut--left" />
              <div className="bmsc-ticket-cut bmsc-ticket-cut--right" />
            </div>
            <div className="bmsc-ticket-bottom">
              <div><span>DATE</span><strong>{showDate(show?.startTime)}</strong></div>
              <div><span>TIME</span><strong>{showTime(show?.startTime)}</strong></div>
              <div><span>SEATS</span><strong>{seatIds.join(", ")}</strong></div>
            </div>
            <div className="bmsc-ticket-end"><span>BOOKMYSEAT / CINEMA EXPERIENCE</span><span>01 — {String(seatIds.length).padStart(2,"0")}</span></div>
          </motion.div>

          <div className="bmsc-receipt">
            <div className="bmsc-receipt-heading"><Ticket size={18} /><h3>Order overview</h3><span>{seatIds.length} {seatIds.length === 1 ? "ticket" : "tickets"}</span></div>
            <div className="bmsc-receipt-row"><span>Tickets & applicable charges</span><strong>{money(amount)}</strong></div>
            <p className="bmsc-receipt-note"><Info size={14} /> Final payable amount is provided by the payment server.</p>
            <div className="bmsc-receipt-divider" />
            <div className="bmsc-receipt-total"><span>PAYABLE NOW</span><strong>{money(amount)}</strong></div>
            <div className={`bmsc-receipt-timer ${remainingSeconds < 60 ? "bmsc-receipt-timer--urgent" : ""}`}>
              <span><Timer size={16} /> Seats reserved for</span>
              <strong>{clock(remainingSeconds)}</strong>
            </div>
          </div>
        </div>

        {/* RIGHT — SECURE STRIPE FORM */}
        <motion.section
          className="bmsc-payment-panel"
          initial={reducedMotion ? false : { opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.1 }}
        >
          <div className="bmsc-panel-topline"><span className="bmsc-live-dot" /> ENCRYPTED CHECKOUT <span className="bmsc-panel-topline-right">02 / 02</span></div>
          <div className="bmsc-panel-title"><div><p>ONE LAST STEP</p><h2>Complete your booking.</h2><span>Enter your card details securely to confirm these seats.</span></div><ShieldCheck size={29} /></div>

          {/* This card is a visual preview only. No sensitive number is stored. */}
          <div className="bmsc-card-stage">
            <motion.div
              className="bmsc-card-rotator"
              animate={{ rotateY: focused === "cvc" ? 180 : 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="bmsc-card-face bmsc-card-front">
                <div className="bmsc-card-glow" />
                <div className="bmsc-card-head"><span className="bmsc-card-chip"><i /><i /></span><span>{cardLabel}</span></div>
                <div className="bmsc-card-dots">••••&nbsp; ••••&nbsp; ••••&nbsp; ••••</div>
                <div className="bmsc-card-foot"><span><small>CARDHOLDER</small><strong>{name.trim() || "YOUR NAME"}</strong></span><span><small>EXPIRY</small><strong>MM/YY</strong></span></div>
              </div>
              <div className="bmsc-card-face bmsc-card-back">
                <div className="bmsc-card-stripe" />
                <div className="bmsc-card-back-cvc"><small>SECURITY CODE</small><strong>•••</strong></div>
              </div>
            </motion.div>
          </div>

          <div className="bmsc-form-title"><span><CreditCard size={17} /> Card details</span><span>POWERED BY STRIPE</span></div>
          <div className="bmsc-fields">
            <label className="bmsc-field">
              <span>Cardholder name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused("")}
                autoComplete="cc-name"
                placeholder="Name on card"
                maxLength={100}
                disabled={processing}
              />
            </label>
            <label className="bmsc-field">
              <span>Card number {completed.number && <CheckCircle2 size={14} />}</span>
              <div className="bmsc-stripe-field">
                <CardNumberElement
                  options={elementStyle}
                  onFocus={() => setFocused("number")}
                  onBlur={() => setFocused("")}
                  onChange={(event) => onFieldChange("number", event)}
                />
              </div>
            </label>
            <div className="bmsc-field-grid">
              <label className="bmsc-field">
                <span>Expiry date {completed.expiry && <CheckCircle2 size={14} />}</span>
                <div className="bmsc-stripe-field">
                  <CardExpiryElement
                    options={elementStyle}
                    onFocus={() => setFocused("expiry")}
                    onBlur={() => setFocused("")}
                    onChange={(event) => onFieldChange("expiry", event)}
                  />
                </div>
              </label>
              <label className="bmsc-field">
                <span>Security code {completed.cvc && <CheckCircle2 size={14} />}</span>
                <div className="bmsc-stripe-field">
                  <CardCvcElement
                    options={elementStyle}
                    onFocus={() => setFocused("cvc")}
                    onBlur={() => setFocused("")}
                    onChange={(event) => onFieldChange("cvc", event)}
                  />
                </div>
              </label>
            </div>
          </div>
          <button type="submit" className="bmsc-pay-button" disabled={!stripe || processing || remainingSeconds <= 0 || paidRef.current}>
            <LockKeyhole size={17} /><span>{processing ? "Confirming secure payment…" : `Pay ${money(amount)} securely`}</span><ArrowRight size={19} />
          </button>
          <div className="bmsc-security-note"><ShieldCheck size={16} /><span>Card details are processed by Stripe. BookMySeat does not store your card number or CVC.</span></div>
        </motion.section>
      </form>

      <AnimatePresence>
        {processing && (
          <motion.div className="bmsc-processing" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} role="status" aria-live="polite">
            <div className="bmsc-processing-inner"><div className="bmsc-processing-ring"><ShieldCheck size={33}/></div><p>SECURE PAYMENT</p><h2>Confirming your booking</h2><span>Please keep this page open while we check your payment and reservation.</span></div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================
// PAGE CONTROLLER — SAME CREATE-INTENT, HOLD & BACK CONTRACT
// ============================================================
export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, isAuthenticated, loading: authLoading } = useAuth();
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
      sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(location.state));
      return location.state;
    }
    try { return JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) || "null"); }
    catch { return null; }
  }, [location.state]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !token) { navigate("/auth", { replace: true }); return; }
    if (!checkout?.showId || !checkout?.lockId || !checkout?.seatIds?.length) { setLoading(false); return; }
    // Defer one tick so React StrictMode cleanup cannot create duplicate intents.
    let active = true;
    const start = async () => {
      try {
        const [paymentResponse, showResponse] = await Promise.all([
          axios.post(`${API_URL}/api/payments/create-intent`, {
            showId: checkout.showId,
            seatIds: checkout.seatIds,
            lockId: checkout.lockId,
          }, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/api/shows/${checkout.showId}`),
        ]);
        if (!active) return;
        setPayment(paymentResponse.data);
        setSecret(paymentResponse.data.clientSecret);
        setShow(showResponse.data?.show);
      } catch (problem) {
        if (!active) return;
        console.error("Checkout initialization:", problem);
        setError(problem.response?.data?.message || "Unable to start checkout.");
        toast.error(problem.response?.data?.message || "Unable to start checkout.");
      } finally {
        if (active) setLoading(false);
      }
    };
    const requestTimer = setTimeout(start, 0);
    return () => { active = false; clearTimeout(requestTimer); };
  }, [authLoading, isAuthenticated, token, checkout, navigate]);

  useEffect(() => {
    const expiresAt = payment?.lockExpiresAt || checkout?.expiresAt;
    if (!expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0 && !processing) sessionStorage.removeItem(CHECKOUT_KEY);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [payment, checkout, processing]);

  const backToSeats = async () => {
    if (returning || processing || !checkout) return;
    setReturning(true);
    try {
      await axios.delete(`${API_URL}/api/seat-locks/release`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { showId: checkout.showId, seatIds: checkout.seatIds, lockId: checkout.lockId },
      });
    } catch (problem) {
      console.warn("Hold release during navigation:", problem);
    }
    sessionStorage.removeItem(CHECKOUT_KEY);
    navigate(checkout.movieId ? `/booking/${checkout.movieId}?show=${encodeURIComponent(checkout.showId)}${show?.theatre?._id ? `&theatre=${encodeURIComponent(show.theatre._id)}` : ""}` : "/cinemas", { replace: true });
  };

  return (
    <main className="bmsc-page" data-design-version="BMS_CHECKOUT_CINEMATIC_V3">
      <div className="bmsc-ambient" aria-hidden="true" />
      <div className="bmsc-container">
        <div className="bmsc-breadcrumb"><span>01 &nbsp; SELECT SEATS</span><ChevronRight size={14}/><strong>02 &nbsp; SECURE CHECKOUT</strong><ChevronRight size={14}/><span>03 &nbsp; CONFIRMATION</span></div>
        <div className="bmsc-page-heading">
          <div>
            <p>THE FINAL SCENE</p>
            <h1>Make it <em>official.</em></h1>
            <span>Your seats are almost yours. One secure payment to go.</span>
          </div>
          <div className="bmsc-heading-assurance"><ShieldCheck size={18}/><span>ENCRYPTED<br/>PAYMENT</span></div>
        </div>

        <div className="bmsc-top-actions">
          <button type="button" onClick={backToSeats} disabled={returning || processing || !checkout}>
            <ArrowLeft size={16}/>{returning ? "Releasing seats…" : "Back to seats"}
          </button>
          {!!checkout && <div><span className="bmsc-live-dot"/> SEATS HELD <span className="bmsc-time-badge"><Clock3 size={14}/>{clock(seconds)}</span></div>}
        </div>

        {loading || authLoading ? (
          <div className="bmsc-state"><span className="bmsc-spinner"/><h2>Preparing your secure checkout</h2><p>Confirming your reservation and payment session.</p></div>
        ) : !checkout ? (
          <div className="bmsc-state"><Armchair size={36}/><h2>No active checkout</h2><p>Select a showtime and seats before checking out.</p><button onClick={() => navigate("/cinemas")}>Browse cinemas <ArrowRight size={16}/></button></div>
        ) : error ? (
          <div className="bmsc-state"><Info size={36}/><h2>Checkout unavailable</h2><p>{error}</p><button onClick={backToSeats}>Return to seats <ArrowRight size={16}/></button></div>
        ) : seconds <= 0 && !processing ? (
          <div className="bmsc-state"><Timer size={36}/><h2>Reservation expired</h2><p>Your seat hold has ended. Choose your seats again to continue.</p><button onClick={backToSeats}>Select seats again <ArrowRight size={16}/></button></div>
        ) : !secret || !payment || !stripePromise ? (
          <div className="bmsc-state"><Info size={36}/><h2>Secure payment unavailable</h2><p>Stripe has not initialized. Check the frontend's Stripe publishable key configuration.</p></div>
        ) : (
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
        <footer className="bmsc-footer"><span>© BookMySeat · Cinema, uninterrupted.</span><span><LockKeyhole size={13}/> Secure checkout by Stripe</span></footer>
      </div>
    </main>
  );
}
