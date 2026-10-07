import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  motion,
} from "framer-motion";

import {
  Calendar,
  Check,
  Clock,
  MapPin,
  Ticket,
} from "lucide-react";

import {
  QRCodeSVG,
} from "qrcode.react";

import axios from "axios";

import {
  useAuth,
} from "../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const CINEMA_TIME_ZONE =
  "Asia/Kolkata";

// =====================================================
// HELPERS
// =====================================================

const formatDate = (
  booking
) => {
  const value =
    booking?.show
      ?.startTime ||
    booking?.show
      ?.date;

  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone:
        CINEMA_TIME_ZONE,

      weekday:
        "short",

      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    }
  ).format(
    new Date(value)
  );
};

const formatTime = (
  booking
) => {
  if (
    booking?.show
      ?.startTime
  ) {
    return new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone:
          CINEMA_TIME_ZONE,

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    ).format(
      new Date(
        booking.show
          .startTime
      )
    );
  }

  return (
    booking?.show
      ?.time ||
    "—"
  );
};

// =====================================================
// PAGE
// =====================================================

const BookingSuccess = () => {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] =
    useSearchParams();

  const bookingId =
    searchParams.get(
      "bookingId"
    );

  const {
    token,
    isAuthenticated,
    loading:
      authLoading,
  } = useAuth();

  const [
    booking,
    setBooking,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    stillProcessing,
    setStillProcessing,
  ] = useState(false);

  // ===================================================
  // FETCH CONFIRMED BOOKING
  // ===================================================

  const findBooking =
    useCallback(
      async () => {
        if (
          !token ||
          !bookingId
        ) {
          return null;
        }

        const response =
          await axios.get(
            `${API_URL}/api/bookings/my-bookings`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        return (
          response.data
            ?.bookings ||
          []
        ).find(
          (item) =>
            item._id ===
            bookingId
        );
      },
      [
        token,
        bookingId,
      ]
    );

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
        "/auth",
        {
          replace:
            true,
        }
      );

      return;
    }

    if (!bookingId) {
      navigate(
        "/my-bookings",
        {
          replace:
            true,
        }
      );

      return;
    }

    let cancelled =
      false;

    const loadBooking =
      async () => {
        try {
          /**
           * Usually the webhook has already finished before
           * this page opens.
           *
           * Polling handles the rare case where Stripe succeeded
           * but MongoDB confirmation is still finishing.
           */
          for (
            let attempt = 0;
            attempt < 12;
            attempt += 1
          ) {
            const result =
              await findBooking();

            if (result) {
              if (
                !cancelled
              ) {
                setBooking(
                  result
                );

                setLoading(
                  false
                );
              }

              return;
            }

            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  700
                )
            );
          }

          if (!cancelled) {
            setStillProcessing(
              true
            );

            setLoading(
              false
            );
          }
        } catch (error) {
          console.error(
            "Booking confirmation fetch failed:",
            error
          );

          if (!cancelled) {
            setStillProcessing(
              true
            );

            setLoading(
              false
            );
          }
        }
      };

    loadBooking();

    return () => {
      cancelled =
        true;
    };
  }, [
    authLoading,
    isAuthenticated,
    bookingId,
    navigate,
    findBooking,
  ]);

  const movie =
    booking?.movie ||
    booking?.show
      ?.movie;

  const theatre =
    booking?.show
      ?.theatre;

  const screen =
    booking?.show
      ?.screen;

  const qrValue =
    useMemo(() => {
      if (
        !booking
          ?.qrToken
      ) {
        return null;
      }

      /**
       * Version prefix lets the future scanner know
       * what kind of QR it received.
       */
      return `BMS1:${booking.qrToken}`;
    }, [booking]);

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090b]">

        <div className="text-center">

          <motion.div
            animate={{
              rotate: 360,
            }}
            transition={{
              duration:
                1,

              repeat:
                Infinity,

              ease:
                "linear",
            }}
            className="mx-auto h-12 w-12 rounded-full border-2 border-zinc-800 border-t-red-500"
          />

          <p className="mt-5 text-zinc-400">
            Confirming your booking...
          </p>

        </div>

      </div>
    );
  }

  // ===================================================
  // SLOW WEBHOOK FALLBACK
  // ===================================================

  if (
    stillProcessing &&
    !booking
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090b] px-4">

        <div className="max-w-lg text-center">

          <motion.div
            initial={{
              scale: 0,
            }}
            animate={{
              scale: 1,
            }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 text-amber-400"
          >
            <Clock className="h-10 w-10" />
          </motion.div>

          <h1 className="mt-6 text-3xl font-bold">
            Payment received
          </h1>

          <p className="mt-3 text-zinc-400">
            Your booking is still being confirmed. Do not pay again.
          </p>

          <button
            onClick={() =>
              navigate(
                "/my-bookings"
              )
            }
            className="mt-8 rounded-full bg-red-600 px-8 py-3 font-semibold text-white"
          >
            Check My Bookings
          </button>

        </div>

      </div>
    );
  }

  // ===================================================
  // SUCCESS
  // ===================================================

  return (
    <div className="min-h-screen bg-[#08090b] pt-28 pb-16 px-4">

      <div className="mx-auto max-w-4xl">

        {/* SUCCESS ICON */}

        <motion.div
          initial={{
            scale: 0,
            rotate: -20,
          }}
          animate={{
            scale: 1,
            rotate: 0,
          }}
          transition={{
            type:
              "spring",

            stiffness:
              180,

            damping:
              14,
          }}
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10"
        >
          <motion.div
            initial={{
              pathLength: 0,
            }}
            animate={{
              pathLength: 1,
            }}
          >
            <Check className="h-12 w-12 text-green-400" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{
            y: 20,
            opacity: 0,
          }}
          animate={{
            y: 0,
            opacity: 1,
          }}
          transition={{
            delay:
              0.15,
          }}
          className="mt-6 text-center"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-green-400">
            Payment successful
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Booking Confirmed
          </h1>

          <p className="mt-3 text-zinc-500">
            Your ticket is ready.
          </p>
        </motion.div>

        {/* TICKET */}

        <motion.div
          initial={{
            y: 80,
            opacity: 0,
            rotateX: 8,
          }}
          animate={{
            y: 0,
            opacity: 1,
            rotateX: 0,
          }}
          transition={{
            delay:
              0.3,

            type:
              "spring",

            stiffness:
              100,

            damping:
              18,
          }}
          className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl"
        >

          <div className="grid grid-cols-1 md:grid-cols-[1fr_240px]">

            {/* DETAILS */}

            <div className="p-7 sm:p-9">

              <div className="flex gap-5">

                {movie
                  ?.poster && (
                  <img
                    src={
                      movie.poster
                    }
                    alt={
                      movie.title
                    }
                    className="h-36 w-24 rounded-xl object-cover"
                  />
                )}

                <div className="min-w-0">

                  <p className="text-sm text-zinc-500">
                    Movie
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {movie
                      ?.title ||
                      "Movie"}
                  </h2>

                  <p className="mt-3 text-sm text-zinc-400">
                    {booking.bookingCode ||
                      booking.bookingReference}
                  </p>

                  <div className="mt-4 inline-flex rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
                    CONFIRMED
                  </div>

                </div>

              </div>

              <div className="my-7 border-t border-dashed border-white/10" />

              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">

                <div>
                  <Calendar className="mb-2 h-5 w-5 text-red-500" />

                  <p className="text-xs text-zinc-500">
                    Date
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    {formatDate(
                      booking
                    )}
                  </p>
                </div>

                <div>
                  <Clock className="mb-2 h-5 w-5 text-red-500" />

                  <p className="text-xs text-zinc-500">
                    Time
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    {formatTime(
                      booking
                    )}
                  </p>
                </div>

                <div>
                  <Ticket className="mb-2 h-5 w-5 text-red-500" />

                  <p className="text-xs text-zinc-500">
                    Seats
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    {booking.seats.join(
                      ", "
                    )}
                  </p>
                </div>

                <div>
                  <MapPin className="mb-2 h-5 w-5 text-red-500" />

                  <p className="text-xs text-zinc-500">
                    Screen
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    {screen
                      ?.name ||
                      "Screen"}
                  </p>
                </div>

              </div>

              <div className="mt-7">

                <p className="text-xs text-zinc-500">
                  Theatre
                </p>

                <p className="mt-1 font-medium">
                  {theatre
                    ?.name ||
                    "BookMySeat Cinema"}
                </p>

                {theatre
                  ?.address && (
                  <p className="mt-1 text-sm text-zinc-500">
                    {[
                      theatre.address
                        .area,
                      theatre.address
                        .city,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        ", "
                      )}
                  </p>
                )}

              </div>

              <div className="mt-7 flex items-end justify-between">

                <div>
                  <p className="text-xs text-zinc-500">
                    Paid
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    ₹
                    {Number(
                      booking.totalAmount
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </p>
                </div>

                <p className="text-xs text-zinc-600">
                  {booking.currency ||
                    "INR"}
                </p>

              </div>

            </div>

            {/* QR */}

            <div className="relative flex flex-col items-center justify-center border-t border-dashed border-white/10 bg-white p-8 text-zinc-950 md:border-l md:border-t-0">

              {/* Ticket cutouts */}

              <div className="absolute -left-3 -top-3 hidden h-6 w-6 rounded-full bg-[#08090b] md:block" />

              <div className="absolute -bottom-3 -left-3 hidden h-6 w-6 rounded-full bg-[#08090b] md:block" />

              {qrValue ? (
                <>
                  <motion.div
                    initial={{
                      scale:
                        0.8,

                      opacity:
                        0,
                    }}
                    animate={{
                      scale:
                        1,

                      opacity:
                        1,
                    }}
                    transition={{
                      delay:
                        0.6,
                    }}
                  >
                    <QRCodeSVG
                      value={
                        qrValue
                      }
                      size={
                        165
                      }
                      level="H"
                      marginSize={
                        1
                      }
                    />
                  </motion.div>

                  <p className="mt-5 text-center text-sm font-semibold">
                    Entry QR
                  </p>

                  <p className="mt-1 text-center text-xs text-zinc-500">
                    Show this at the theatre entrance
                  </p>
                </>
              ) : (
                <p className="text-center text-sm text-zinc-500">
                  QR ticket unavailable for this booking.
                </p>
              )}

            </div>

          </div>

        </motion.div>

        {/* ACTIONS */}

        <motion.div
          initial={{
            y: 20,
            opacity: 0,
          }}
          animate={{
            y: 0,
            opacity: 1,
          }}
          transition={{
            delay:
              0.7,
          }}
          className="mt-8 flex flex-wrap justify-center gap-4"
        >

          <button
            onClick={() =>
              navigate(
                "/my-bookings"
              )
            }
            className="rounded-full bg-red-600 px-8 py-3 font-semibold text-white transition hover:bg-red-500 active:scale-95"
          >
            My Bookings
          </button>

          <button
            onClick={() =>
              navigate(
                "/movies"
              )
            }
            className="rounded-full border border-white/10 bg-white/5 px-8 py-3 font-semibold transition hover:bg-white/10 active:scale-95"
          >
            Browse Movies
          </button>

        </motion.div>

      </div>

    </div>
  );
};

export default BookingSuccess;