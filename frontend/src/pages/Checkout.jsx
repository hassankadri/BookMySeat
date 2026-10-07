import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  ArrowLeft,
  CreditCard,
  Lock,
} from "lucide-react";

import axios from "axios";
import toast from "react-hot-toast";

import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import {
  loadStripe,
} from "@stripe/stripe-js";

import {
  useAuth,
} from "../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const CHECKOUT_STORAGE_KEY =
  "bookmyseat_checkout";

const stripePromise =
  loadStripe(
    process.env
      .REACT_APP_STRIPE_PUBLISHABLE_KEY
  );

// =====================================================
// STRIPE FIELD STYLE
// =====================================================

const stripeFieldStyle = {
  style: {
    base: {
      color:
        "#ffffff",

      fontSize:
        "16px",

      fontFamily:
        "Inter, system-ui, sans-serif",

      "::placeholder": {
        color:
          "#71717a",
      },
    },

    invalid: {
      color:
        "#ef4444",
    },
  },
};

// =====================================================
// PAYMENT FORM
// =====================================================

const CheckoutForm = ({
  clientSecret,
  amount,
  bookingId,
  showId,
  seatIds,
  show,
  remainingSeconds,
}) => {
  const stripe =
    useStripe();

  const elements =
    useElements();

  const navigate =
    useNavigate();

  const [
    name,
    setName,
  ] = useState("");

  const [
    brand,
    setBrand,
  ] = useState("card");

  const [
    focusedField,
    setFocusedField,
  ] = useState(null);

  const [
    processing,
    setProcessing,
  ] = useState(false);

  // ===================================================
  // PAYMENT
  // ===================================================

  const handlePayment =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !stripe ||
        !elements ||
        processing
      ) {
        return;
      }

      if (
        remainingSeconds <=
        0
      ) {
        toast.error(
          "Your seat reservation expired."
        );

        return;
      }

      if (
        !name.trim()
      ) {
        toast.error(
          "Enter the cardholder name."
        );

        return;
      }

      const cardNumber =
        elements.getElement(
          CardNumberElement
        );

      if (!cardNumber) {
        toast.error(
          "Card details are not ready."
        );

        return;
      }

      setProcessing(
        true
      );

      try {
        const {
          error,
          paymentIntent,
        } =
          await stripe.confirmCardPayment(
            clientSecret,
            {
              payment_method: {
                card:
                  cardNumber,

                billing_details: {
                  name:
                    name.trim(),
                },
              },
            }
          );

        if (error) {
          toast.error(
            error.message ||
              "Payment failed."
          );

          setProcessing(
            false
          );

          return;
        }

        if (
          paymentIntent
            ?.status !==
          "succeeded"
        ) {
          toast(
            "Payment is still processing."
          );

          setProcessing(
            false
          );

          return;
        }

        // =============================================
        // WAIT FOR WEBHOOK
        // =============================================

        for (
          let attempt = 0;
          attempt < 12;
          attempt += 1
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                700
              )
          );

          const response =
            await axios.get(
              `${API_URL}/api/shows/${showId}`
            );

          const booked =
            new Set(
              (
                response.data
                  ?.show
                  ?.bookedSeats ||
                []
              ).map(
                (seat) =>
                  String(
                    seat
                  ).toUpperCase()
              )
            );

          const confirmed =
            seatIds.every(
              (seat) =>
                booked.has(
                  String(
                    seat
                  ).toUpperCase()
                )
            );

          if (
            confirmed
          ) {
            sessionStorage.removeItem(
              CHECKOUT_STORAGE_KEY
            );

            navigate(
              `/booking-success?bookingId=${bookingId}`,
              {
                replace:
                  true,

                state: {
                  bookingId,
                  showId,
                  seatIds,
                },
              }
            );

            return;
          }
        }

        /**
         * Stripe was successful.
         * Never ask user to pay twice just because webhook
         * processing is slower than expected.
         */
        sessionStorage.removeItem(
          CHECKOUT_STORAGE_KEY
        );

        navigate(
          `/booking-success?bookingId=${bookingId}`,
          {
            replace:
              true,

            state: {
              bookingId,
              showId,
              seatIds,

              processing:
                true,
            },
          }
        );
      } catch (error) {
        console.error(
          "Checkout payment error:",
          error
        );

        toast.error(
          "Unable to complete payment."
        );

        setProcessing(
          false
        );
      }
    };

  const timerText =
    `${String(
      Math.floor(
        remainingSeconds /
          60
      )
    ).padStart(
      2,
      "0"
    )}:${String(
      remainingSeconds %
        60
    ).padStart(
      2,
      "0"
    )}`;

  return (
    <>
      <form
        onSubmit={
          handlePayment
        }
        className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start"
      >

        {/* LEFT */}

        <div className="lg:sticky lg:top-28">

          <p className="text-sm text-zinc-500 mb-4">
            Your card
          </p>

          {/* CARD */}

          <div className="relative mx-auto max-w-md aspect-[1.58/1] [perspective:1200px]">

            <motion.div
              animate={{
                rotateY:
                  focusedField ===
                  "cvc"
                    ? 180
                    : 0,
              }}
              transition={{
                duration:
                  0.55,

                ease: [
                  0.22,
                  1,
                  0.36,
                  1,
                ],
              }}
              style={{
                transformStyle:
                  "preserve-3d",
              }}
              className="relative w-full h-full"
            >

              {/* FRONT */}

              <div
                style={{
                  backfaceVisibility:
                    "hidden",
                }}
                className="absolute inset-0 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-950 to-black p-7 shadow-2xl"
              >

                <motion.div
                  animate={{
                    x:
                      focusedField ===
                      "number"
                        ? 6
                        : 0,
                  }}
                  className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-red-600/20 blur-3xl"
                />

                <div className="relative z-10 flex h-full flex-col justify-between">

                  <div className="flex items-center justify-between">

                    <CreditCard className="h-8 w-8 text-red-500" />

                    <span className="uppercase text-sm font-semibold tracking-widest text-zinc-300">
                      {brand ===
                      "unknown"
                        ? "CARD"
                        : brand}
                    </span>

                  </div>

                  <div>

                    <p className="mb-5 font-mono text-xl sm:text-2xl tracking-[0.18em]">
                      •••• •••• •••• ••••
                    </p>

                    <div className="flex justify-between gap-6">

                      <div>

                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                          Cardholder
                        </p>

                        <p className="mt-1 truncate text-sm font-medium uppercase">
                          {name ||
                            "YOUR NAME"}
                        </p>

                      </div>

                      <div className="text-right">

                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                          Expires
                        </p>

                        <p className="mt-1 font-mono text-sm">
                          MM/YY
                        </p>

                      </div>

                    </div>

                  </div>

                </div>

              </div>

              {/* BACK */}

              <div
                style={{
                  backfaceVisibility:
                    "hidden",

                  transform:
                    "rotateY(180deg)",
                }}
                className="absolute inset-0 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black shadow-2xl"
              >

                <div className="mt-10 h-14 bg-black" />

                <div className="px-7 pt-8">

                  <p className="mb-2 text-right text-[10px] uppercase tracking-widest text-zinc-500">
                    Security code
                  </p>

                  <div className="flex h-11 items-center justify-end rounded bg-zinc-100 px-4">

                    <span className="font-mono text-zinc-900">
                      •••
                    </span>

                  </div>

                </div>

              </div>

            </motion.div>

          </div>

          {/* ORDER SUMMARY */}

          <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-900/70 p-6">

            <div className="flex justify-between gap-4">

              <div>

                <p className="text-sm text-zinc-500">
                  Movie
                </p>

                <p className="mt-1 font-semibold">
                  {show
                    ?.movie
                    ?.title ||
                    "Movie"}
                </p>

              </div>

              <div className="text-right">

                <p className="text-sm text-zinc-500">
                  Seats
                </p>

                <p className="mt-1 font-semibold">
                  {seatIds.join(
                    ", "
                  )}
                </p>

              </div>

            </div>

            <div className="my-5 border-t border-white/10" />

            <div className="flex items-center justify-between">

              <span className="text-zinc-400">
                Total
              </span>

              <span className="text-2xl font-bold text-red-500">
                ₹
                {
                  amount
                }
              </span>

            </div>

            <div className="mt-5 flex items-center justify-between text-sm">

              <span className="flex items-center gap-2 text-zinc-500">

                <Lock className="h-4 w-4" />

                Seat hold

              </span>

              <span
                className={`font-mono ${
                  remainingSeconds <
                  60
                    ? "text-red-500"
                    : "text-zinc-300"
                }`}
              >
                {
                  timerText
                }
              </span>

            </div>

          </div>

        </div>

        {/* RIGHT */}

        <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 sm:p-8">

          <div className="mb-8">

            <p className="text-sm uppercase tracking-[0.2em] text-red-500">
              Payment
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              Complete your booking
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Your seats are temporarily reserved.
            </p>

          </div>

          <div className="space-y-5">

            {/* NAME */}

            <div>

              <label className="mb-2 block text-sm text-zinc-400">
                Cardholder name
              </label>

              <input
                value={
                  name
                }
                onChange={(
                  event
                ) =>
                  setName(
                    event.target
                      .value
                  )
                }
                onFocus={() =>
                  setFocusedField(
                    "name"
                  )
                }
                onBlur={() =>
                  setFocusedField(
                    null
                  )
                }
                placeholder="Hassan Kadri"
                autoComplete="cc-name"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-white outline-none transition focus:border-red-500"
              />

            </div>

            {/* NUMBER */}

            <div>

              <label className="mb-2 block text-sm text-zinc-400">
                Card number
              </label>

              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 transition focus-within:border-red-500">

                <CardNumberElement
                  options={
                    stripeFieldStyle
                  }
                  onFocus={() =>
                    setFocusedField(
                      "number"
                    )
                  }
                  onBlur={() =>
                    setFocusedField(
                      null
                    )
                  }
                  onChange={(
                    event
                  ) =>
                    setBrand(
                      event.brand ||
                        "card"
                    )
                  }
                />

              </div>

            </div>

            <div className="grid grid-cols-2 gap-4">

              {/* EXPIRY */}

              <div>

                <label className="mb-2 block text-sm text-zinc-400">
                  Expiry
                </label>

                <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 transition focus-within:border-red-500">

                  <CardExpiryElement
                    options={
                      stripeFieldStyle
                    }
                    onFocus={() =>
                      setFocusedField(
                        "expiry"
                      )
                    }
                    onBlur={() =>
                      setFocusedField(
                        null
                      )
                    }
                  />

                </div>

              </div>

              {/* CVC */}

              <div>

                <label className="mb-2 block text-sm text-zinc-400">
                  CVC
                </label>

                <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 transition focus-within:border-red-500">

                  <CardCvcElement
                    options={
                      stripeFieldStyle
                    }
                    onFocus={() =>
                      setFocusedField(
                        "cvc"
                      )
                    }
                    onBlur={() =>
                      setFocusedField(
                        null
                      )
                    }
                  />

                </div>

              </div>

            </div>

          </div>

          <motion.button
            whileHover={{
              scale:
                1.01,
            }}
            whileTap={{
              scale:
                0.98,
            }}
            type="submit"
            disabled={
              processing ||
              !stripe ||
              remainingSeconds <=
                0
            }
            className="mt-8 w-full rounded-full bg-red-600 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Pay ₹
            {
              amount
            }
          </motion.button>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-zinc-500">

            <Lock className="h-3.5 w-3.5" />

            Payment secured by Stripe

          </div>

        </div>

      </form>

      {/* AUTHORISING */}

      <AnimatePresence>
        {processing && (
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl"
          >

            <div className="text-center">

              <motion.div
                animate={{
                  rotate: 360,
                }}
                transition={{
                  duration:
                    1.2,

                  repeat:
                    Infinity,

                  ease:
                    "linear",
                }}
                className="mx-auto mb-8 h-20 w-20 rounded-full border-2 border-zinc-800 border-t-red-500"
              />

              <motion.h2
                initial={{
                  y: 10,
                  opacity: 0,
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                }}
                className="text-3xl font-bold"
              >
                Authorising payment
              </motion.h2>

              <p className="mt-3 text-zinc-500">
                Please don’t close this page.
              </p>

              <motion.div
                initial={{
                  width: 0,
                }}
                animate={{
                  width:
                    "220px",
                }}
                transition={{
                  duration:
                    4,

                  ease:
                    "easeInOut",
                }}
                className="mx-auto mt-8 h-1 rounded-full bg-red-600"
              />

            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// =====================================================
// PAGE
// =====================================================

const Checkout = () => {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const {
    token,
    isAuthenticated,
  } = useAuth();

  const startedRef =
    useRef(false);

  const initialCheckout =
    useMemo(() => {
      if (
        location.state
          ?.showId
      ) {
        sessionStorage.setItem(
          CHECKOUT_STORAGE_KEY,
          JSON.stringify(
            location.state
          )
        );

        return location.state;
      }

      try {
        const stored =
          sessionStorage.getItem(
            CHECKOUT_STORAGE_KEY
          );

        return stored
          ? JSON.parse(
              stored
            )
          : null;
      } catch {
        return null;
      }
    }, [location.state]);

  const [
    clientSecret,
    setClientSecret,
  ] = useState(null);

  const [
    paymentData,
    setPaymentData,
  ] = useState(null);

  const [
    show,
    setShow,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState(0);

  const [
    returning,
    setReturning,
  ] = useState(false);

  // ===================================================
  // INITIALIZE
  // ===================================================

  useEffect(() => {
    if (
      !isAuthenticated ||
      !token ||
      !initialCheckout ||
      startedRef.current
    ) {
      return;
    }

    startedRef.current =
      true;

    const startCheckout =
      async () => {
        try {
          const [
            paymentResponse,
            showResponse,
          ] =
            await Promise.all([
              axios.post(
                `${API_URL}/api/payments/create-intent`,
                {
                  showId:
                    initialCheckout
                      .showId,

                  seatIds:
                    initialCheckout
                      .seatIds,

                  lockId:
                    initialCheckout
                      .lockId,
                },
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
              ),

              axios.get(
                `${API_URL}/api/shows/${initialCheckout.showId}`
              ),
            ]);

          setPaymentData(
            paymentResponse.data
          );

          setClientSecret(
            paymentResponse.data
              .clientSecret
          );

          setShow(
            showResponse.data
              ?.show
          );
        } catch (error) {
          console.error(
            "Checkout initialization failed:",
            error
          );

          toast.error(
            error.response
              ?.data
              ?.message ||
              "Unable to start checkout."
          );

          sessionStorage.removeItem(
            CHECKOUT_STORAGE_KEY
          );

          navigate(
            initialCheckout
              ?.movieId
              ? `/booking/${initialCheckout.movieId}`
              : "/movies",
            {
              replace:
                true,
            }
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    startCheckout();
  }, [
    initialCheckout,
    isAuthenticated,
    token,
    navigate,
  ]);

  // ===================================================
  // TIMER
  // ===================================================

  useEffect(() => {
    const expiresAt =
      paymentData
        ?.lockExpiresAt ||
      initialCheckout
        ?.expiresAt;

    if (!expiresAt) {
      return undefined;
    }

    const update =
      () => {
        const seconds =
          Math.max(
            0,

            Math.ceil(
              (
                new Date(
                  expiresAt
                ).getTime() -
                Date.now()
              ) /
                1000
            )
          );

        setRemainingSeconds(
          seconds
        );

        if (
          seconds === 0
        ) {
          sessionStorage.removeItem(
            CHECKOUT_STORAGE_KEY
          );
        }
      };

    update();

    const interval =
      setInterval(
        update,
        1000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [
    paymentData,
    initialCheckout,
  ]);

  // ===================================================
  // BACK TO SEATS
  // ===================================================

  const handleBack =
    async () => {
      if (
        !initialCheckout ||
        returning
      ) {
        return;
      }

      setReturning(
        true
      );

      try {
        await axios.delete(
          `${API_URL}/api/seat-locks/release`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            data: {
              showId:
                initialCheckout
                  .showId,

              seatIds:
                initialCheckout
                  .seatIds,

              lockId:
                initialCheckout
                  .lockId,
            },
          }
        );
      } catch (error) {
        /**
         * If it already expired there may be nothing left
         * to release. We can still safely return.
         */
        console.error(
          "Checkout hold release:",
          error
        );
      }

      sessionStorage.removeItem(
        CHECKOUT_STORAGE_KEY
      );

      navigate(
        initialCheckout
          .movieId
          ? `/booking/${initialCheckout.movieId}`
          : "/movies",
        {
          replace:
            true,
        }
      );
    };

  // ===================================================
  // GUARDS
  // ===================================================

  if (
    !initialCheckout
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">

        <div className="text-center">

          <p className="text-zinc-400">
            No active checkout found.
          </p>

          <button
            onClick={() =>
              navigate(
                "/movies"
              )
            }
            className="mt-4 text-red-500"
          >
            Browse movies
          </button>

        </div>

      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">

        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            repeat:
              Infinity,

            duration:
              1,

            ease:
              "linear",
          }}
          className="h-10 w-10 rounded-full border-2 border-zinc-800 border-t-red-500"
        />

      </div>
    );
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="min-h-screen bg-[#08090b] pt-24 pb-16">

      <div className="mx-auto max-w-6xl px-4 sm:px-6">

        <button
          onClick={
            handleBack
          }
          disabled={
            returning
          }
          className="mb-8 flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />

          {returning
            ? "Releasing seats..."
            : "Back to seats"}
        </button>

        <div className="mb-10">

          <p className="text-sm uppercase tracking-[0.25em] text-red-500">
            Secure checkout
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Complete your payment
          </h1>

        </div>

        {remainingSeconds <=
        0 ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-10 text-center">

            <h2 className="text-2xl font-bold">
              Seat reservation expired
            </h2>

            <p className="mt-2 text-zinc-400">
              Return to the seat map and choose your seats again.
            </p>

            <button
              onClick={
                handleBack
              }
              className="mt-6 rounded-full bg-red-600 px-8 py-3 font-semibold"
            >
              Select seats again
            </button>

          </div>
        ) : (
          clientSecret &&
          paymentData && (
            <Elements
              stripe={
                stripePromise
              }
            >
              <CheckoutForm
                clientSecret={
                  clientSecret
                }
                amount={
                  paymentData.amount
                }
                bookingId={
                  paymentData.bookingId
                }
                showId={
                  initialCheckout.showId
                }
                seatIds={
                  initialCheckout.seatIds
                }
                show={
                  show
                }
                remainingSeconds={
                  remainingSeconds
                }
              />
            </Elements>
          )
        )}

      </div>

    </div>
  );
};

export default Checkout;