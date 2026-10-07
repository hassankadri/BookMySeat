import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  Armchair,
  Clock,
  MapPin,
  Ticket,
} from "lucide-react";

import axios from "axios";

import toast from "react-hot-toast";

import {
  io,
} from "socket.io-client";

import {
  useAuth,
} from "../context/AuthContext";

import {
  useBooking,
} from "../context/BookingContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const MAX_SEATS = 10;

const HOLD_STORAGE_KEY =
  "bookmyseat_seat_hold";

const CHECKOUT_STORAGE_KEY =
  "bookmyseat_checkout";

// =====================================================
// HELPERS
// =====================================================

const normalizeSeatIds = (
  value
) => {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => {
          if (
            typeof item ===
            "string"
          ) {
            return item
              .trim()
              .toUpperCase();
          }

          return String(
            item?.seatId ||
              ""
          )
            .trim()
            .toUpperCase();
        })
        .filter(Boolean)
    ),
  ];
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
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
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
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(value)
  );
};

const formatCountdown = (
  seconds
) => {
  const safe =
    Math.max(
      seconds,
      0
    );

  const minutes =
    Math.floor(
      safe / 60
    );

  const remaining =
    safe % 60;

  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    remaining
  ).padStart(
    2,
    "0"
  )}`;
};

// =====================================================
// PAGE
// =====================================================

const Booking = () => {
  const {
    id: movieId,
  } =
    useParams();

  const [
    searchParams,
  ] =
    useSearchParams();

  const navigate =
    useNavigate();

  const {
    token,
    isAuthenticated,
    loading: authLoading,
  } =
    useAuth();

  const {
    updateBooking,
  } =
    useBooking();

  const showId =
    searchParams.get(
      "show"
    ) ||
    localStorage.getItem(
      "bookmyseat_show"
    );

  const theatreId =
    searchParams.get(
      "theatre"
    ) ||
    localStorage.getItem(
      "bookmyseat_theatre"
    );

  const [
    show,
    setShow,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    selectedSeats,
    setSelectedSeats,
  ] =
    useState([]);

  const selectedSeatsRef =
    useRef([]);

  const [
    lockedSeats,
    setLockedSeats,
  ] =
    useState([]);

  const [
    bookedSeats,
    setBookedSeats,
  ] =
    useState([]);

  const [
    hold,
    setHold,
  ] =
    useState(null);

  const holdRef =
    useRef(null);

  const [
    secondsLeft,
    setSecondsLeft,
  ] =
    useState(0);

  const [
    seatAction,
    setSeatAction,
  ] =
    useState(null);

  const [
    proceeding,
    setProceeding,
  ] =
    useState(false);

  // ===================================================
  // KEEP REFS CURRENT
  // ===================================================

  useEffect(() => {
    selectedSeatsRef.current =
      selectedSeats;
  }, [selectedSeats]);

  useEffect(() => {
    holdRef.current =
      hold;
  }, [hold]);

  // ===================================================
  // AUTH
  // ===================================================

  useEffect(() => {
    if (
      authLoading
    ) {
      return;
    }

    if (
      !isAuthenticated
    ) {
      toast.error(
        "Please login to book tickets."
      );

      navigate(
        "/auth"
      );
    }
  }, [
    authLoading,
    isAuthenticated,
    navigate,
  ]);

  // ===================================================
  // RESTORE EXISTING HOLD AFTER REFRESH
  // ===================================================

  useEffect(() => {
    if (!showId) {
      return;
    }

    try {
      const raw =
        sessionStorage.getItem(
          HOLD_STORAGE_KEY
        );

      if (!raw) {
        return;
      }

      const saved =
        JSON.parse(raw);

      if (
        String(
          saved.showId
        ) !==
        String(showId)
      ) {
        return;
      }

      if (
        !saved.expiresAt ||
        new Date(
          saved.expiresAt
        ) <= new Date()
      ) {
        sessionStorage.removeItem(
          HOLD_STORAGE_KEY
        );

        return;
      }

      const restoredSeats =
        normalizeSeatIds(
          saved.seatIds
        );

      if (
        restoredSeats.length ===
        0 ||
        !saved.lockId
      ) {
        return;
      }

      setSelectedSeats(
        restoredSeats
      );

      setHold({
        lockId:
          saved.lockId,

        expiresAt:
          saved.expiresAt,
      });
    } catch (error) {
      sessionStorage.removeItem(
        HOLD_STORAGE_KEY
      );
    }
  }, [showId]);

  // ===================================================
  // SAVE HOLD LOCALLY
  // ===================================================

  const saveHold = useCallback(
    ({
      seatIds,
      lockId,
      expiresAt,
    }) => {
      if (
        !lockId ||
        !expiresAt ||
        !seatIds?.length
      ) {
        sessionStorage.removeItem(
          HOLD_STORAGE_KEY
        );

        return;
      }

      sessionStorage.setItem(
        HOLD_STORAGE_KEY,

        JSON.stringify({
          showId,
          seatIds,
          lockId,
          expiresAt,
        })
      );
    },
    [showId]
  );

  // ===================================================
  // LOAD SHOW
  // ===================================================

  useEffect(() => {
    const loadShow =
      async () => {
        if (
          authLoading ||
          !isAuthenticated
        ) {
          return;
        }

        if (!showId) {
          toast.error(
            "Please select a show first."
          );

          navigate(
            `/movie/${movieId}${
              theatreId
                ? `?theatre=${theatreId}`
                : ""
            }`,
            {
              replace: true,
            }
          );

          return;
        }

        setLoading(true);

        try {
          const response =
            await axios.get(
              `${API_URL}/api/shows/${showId}`
            );

          const loadedShow =
            response.data?.show;

          if (
            !loadedShow
          ) {
            throw new Error(
              "Show not found."
            );
          }

          const loadedMovieId =
            loadedShow.movie
              ?._id ||
            loadedShow.movie;

          if (
            movieId &&
            String(
              loadedMovieId
            ) !==
              String(
                movieId
              )
          ) {
            throw new Error(
              "Selected show does not belong to this movie."
            );
          }

          setShow(
            loadedShow
          );

          setBookedSeats(
            normalizeSeatIds(
              loadedShow.bookedSeats
            )
          );

          localStorage.setItem(
            "bookmyseat_show",
            loadedShow._id
          );

          if (
            loadedShow.theatre
              ?._id
          ) {
            localStorage.setItem(
              "bookmyseat_theatre",
              loadedShow.theatre._id
            );
          }

          if (
            loadedShow.theatre
              ?.name
          ) {
            localStorage.setItem(
              "bookmyseat_theatre_name",
              loadedShow.theatre.name
            );
          }
        } catch (error) {
          console.error(
            "Load booking show:",
            error
          );

          toast.error(
            error.response
              ?.data
              ?.message ||
              error.message ||
              "Could not load this show."
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    loadShow();
  }, [
    showId,
    movieId,
    theatreId,
    authLoading,
    isAuthenticated,
    navigate,
  ]);

  // ===================================================
  // LOAD REDIS LOCKS
  // ===================================================

  const refreshLockedSeats =
    useCallback(
      async () => {
        if (!showId) {
          return;
        }

        try {
          const response =
            await axios.get(
              `${API_URL}/api/seat-locks/${showId}`
            );

          setLockedSeats(
            normalizeSeatIds(
              response.data
                ?.lockedSeats
            )
          );
        } catch (error) {
          console.error(
            "Load seat locks:",
            error
          );
        }
      },
      [showId]
    );

  useEffect(() => {
    if (!showId) {
      return;
    }

    refreshLockedSeats();

    // Socket.IO is the real-time path.
    // Polling is only a recovery fallback if an event is missed.
    const interval =
      setInterval(
        refreshLockedSeats,
        15000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [
    showId,
    refreshLockedSeats,
  ]);

  // ===================================================
  // SOCKET.IO LIVE SEAT UPDATES
  // ===================================================

  useEffect(() => {
    if (!showId) {
      return;
    }

    const socket =
      io(API_URL, {
        transports: [
          "websocket",
          "polling",
        ],

        reconnection: true,
      });

    socket.emit(
      "show:join",
      {
        showId,
      }
    );

    const eventMatchesShow =
      (payload) => {
        if (
          !payload?.showId
        ) {
          return true;
        }

        return (
          String(
            payload.showId
          ) ===
          String(showId)
        );
      };

    const handleHeld =
      (payload) => {
        if (
          !eventMatchesShow(
            payload
          )
        ) {
          return;
        }

        const seats =
          normalizeSeatIds(
            payload?.seatIds
          );

        setLockedSeats(
          (current) =>
            [
              ...new Set([
                ...current,
                ...seats,
              ]),
            ]
        );
      };

    const handleReleased =
      (payload) => {
        if (
          !eventMatchesShow(
            payload
          )
        ) {
          return;
        }

        const released =
          new Set(
            normalizeSeatIds(
              payload?.seatIds
            )
          );

        setLockedSeats(
          (current) =>
            current.filter(
              (seatId) =>
                !released.has(
                  seatId
                )
            )
        );
      };

    const handleBooked =
      (payload) => {
        if (
          !eventMatchesShow(
            payload
          )
        ) {
          return;
        }

        const newlyBooked =
          normalizeSeatIds(
            payload?.seatIds
          );

        const bookedSet =
          new Set(
            newlyBooked
          );

        setBookedSeats(
          (current) =>
            [
              ...new Set([
                ...current,
                ...newlyBooked,
              ]),
            ]
        );

        setLockedSeats(
          (current) =>
            current.filter(
              (seatId) =>
                !bookedSet.has(
                  seatId
                )
            )
        );

        setSelectedSeats(
          (current) =>
            current.filter(
              (seatId) =>
                !bookedSet.has(
                  seatId
                )
            )
        );
      };

    socket.on(
      "seats:held",
      handleHeld
    );

    socket.on(
      "seats:released",
      handleReleased
    );

    socket.on(
      "seats:booked",
      handleBooked
    );

    return () => {
      socket.emit(
        "show:leave",
        {
          showId,
        }
      );

      socket.off(
        "seats:held",
        handleHeld
      );

      socket.off(
        "seats:released",
        handleReleased
      );

      socket.off(
        "seats:booked",
        handleBooked
      );

      socket.disconnect();
    };
  }, [showId]);

  // ===================================================
  // HOLD COUNTDOWN
  // ===================================================

  useEffect(() => {
    if (
      !hold?.expiresAt
    ) {
      setSecondsLeft(
        0
      );

      return;
    }

    let expired = false;

    const updateTimer =
      () => {
        const remaining =
          Math.max(
            Math.ceil(
              (
                new Date(
                  hold.expiresAt
                ).getTime() -
                Date.now()
              ) /
                1000
            ),
            0
          );

        setSecondsLeft(
          remaining
        );

        if (
          remaining === 0 &&
          !expired
        ) {
          expired = true;

          setHold(null);

          setSelectedSeats(
            []
          );

          updateBooking({
            selectedSeats:
              [],
          });

          sessionStorage.removeItem(
            HOLD_STORAGE_KEY
          );

          refreshLockedSeats();

          toast.error(
            "Your seat hold expired. Please select your seats again."
          );
        }
      };

    updateTimer();

    const timer =
      setInterval(
        updateTimer,
        1000
      );

    return () =>
      clearInterval(
        timer
      );
  }, [
    hold?.expiresAt,
    refreshLockedSeats,
    updateBooking,
  ]);

  // ===================================================
  // SCREEN SEATS
  // ===================================================

  const physicalSeats =
    useMemo(() => {
      if (
        !Array.isArray(
          show?.screen?.seats
        )
      ) {
        return [];
      }

      return show.screen.seats
        .filter(
          (seat) =>
            seat.isActive !==
            false
        )
        .map(
          (seat) => ({
            ...seat,

            seatId:
              String(
                seat.seatId
              ).toUpperCase(),
          })
        );
    }, [show]);

  // ===================================================
  // PRICE MAP
  // ===================================================

  const pricing =
    useMemo(() => {
      const map =
        new Map();

      if (
        Array.isArray(
          show?.pricing
        )
      ) {
        show.pricing.forEach(
          (item) => {
            map.set(
              item.seatType,
              Number(
                item.price ||
                  0
              )
            );
          }
        );
      }

      return map;
    }, [show]);

  const getSeatPrice =
    useCallback(
      (seat) => {
        return (
          pricing.get(
            seat.type
          ) ??
          Number(
            show?.price ||
              0
          )
        );
      },
      [
        pricing,
        show?.price,
      ]
    );

  // ===================================================
  // SEAT MAP BY ROW + COLUMN
  // ===================================================

  const seatRows =
    useMemo(() => {
      const rows =
        new Map();

      physicalSeats.forEach(
        (seat) => {
          const row =
            String(
              seat.row ||
                ""
            ).toUpperCase();

          if (!row) {
            return;
          }

          if (
            !rows.has(row)
          ) {
            rows.set(
              row,
              []
            );
          }

          rows
            .get(row)
            .push(seat);
        }
      );

      return [
        ...rows.entries(),
      ]
        .map(
          ([
            row,
            seats,
          ]) => ({
            row,

            seats:
              seats.sort(
                (
                  a,
                  b
                ) =>
                  Number(
                    a.column ||
                      a.number ||
                      0
                  ) -
                  Number(
                    b.column ||
                      b.number ||
                      0
                  )
              ),
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            a.row.localeCompare(
              b.row,
              undefined,
              {
                numeric:
                  true,
              }
            )
        );
    }, [physicalSeats]);

  const bookedSet =
    useMemo(
      () =>
        new Set(
          bookedSeats
        ),
      [bookedSeats]
    );

  const lockedSet =
    useMemo(
      () =>
        new Set(
          lockedSeats
        ),
      [lockedSeats]
    );

  const selectedSet =
    useMemo(
      () =>
        new Set(
          selectedSeats
        ),
      [selectedSeats]
    );

  // ===================================================
  // TOTAL
  // ===================================================

  const selectedTotal =
    useMemo(() => {
      return selectedSeats.reduce(
        (
          total,
          seatId
        ) => {
          const seat =
            physicalSeats.find(
              (item) =>
                item.seatId ===
                seatId
            );

          if (!seat) {
            return total;
          }

          return (
            total +
            getSeatPrice(
              seat
            )
          );
        },
        0
      );
    }, [
      selectedSeats,
      physicalSeats,
      getSeatPrice,
    ]);

  // ===================================================
  // HOLD SEAT
  // ===================================================

  const selectSeat =
    async (seat) => {
      const seatId =
        seat.seatId;

      if (
        bookedSet.has(
          seatId
        ) ||
        lockedSet.has(
          seatId
        )
      ) {
        return;
      }

      if (
        selectedSeatsRef
          .current
          .length >=
        MAX_SEATS
      ) {
        toast.error(
          `You can select a maximum of ${MAX_SEATS} seats.`
        );

        return;
      }

      if (seatAction) {
        return;
      }

      const nextSeats = [
        ...selectedSeatsRef.current,
        seatId,
      ];

      setSeatAction(
        seatId
      );

      try {
        const response =
          await axios.post(
            `${API_URL}/api/seat-locks/hold`,

            {
              showId,
              seatIds:
                nextSeats,
            },

            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const result =
          response.data;

        const confirmedSelection =
          normalizeSeatIds(
            result.seats ||
              nextSeats
          );

        const nextHold = {
          lockId:
            result.lockId,

          expiresAt:
            result.expiresAt,
        };

        setSelectedSeats(
          confirmedSelection
        );

        setLockedSeats(
          (current) =>
            [
              ...new Set([
                ...current,
                ...confirmedSelection,
              ]),
            ]
        );

        setHold(
          nextHold
        );

        saveHold({
          seatIds:
            confirmedSelection,

          lockId:
            nextHold.lockId,

          expiresAt:
            nextHold.expiresAt,
        });

        updateBooking({
          movie:
            show?.movie,

          show,

          selectedDate:
            show?.startTime,

          selectedTime:
            show?.startTime,

          selectedSeats:
            confirmedSelection,
        });
      } catch (error) {
        console.error(
          "Hold seat error:",
          error
        );

        toast.error(
          error.response
            ?.data
            ?.message ||
            "This seat is no longer available."
        );

        refreshLockedSeats();
      } finally {
        setSeatAction(
          null
        );
      }
    };

  // ===================================================
  // RELEASE ONE SEAT
  // ===================================================

  const releaseSeat =
    async (seat) => {
      const seatId =
        seat.seatId;

      const currentHold =
        holdRef.current;

      if (
        !currentHold
          ?.lockId
      ) {
        setSelectedSeats(
          (current) =>
            current.filter(
              (id) =>
                id !==
                seatId
            )
        );

        return;
      }

      if (seatAction) {
        return;
      }

      setSeatAction(
        seatId
      );

      try {
        await axios.delete(
          `${API_URL}/api/seat-locks/release`,

          {
            data: {
              showId,

              seatIds: [
                seatId,
              ],

              lockId:
                currentHold.lockId,
            },

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        const remaining =
          selectedSeatsRef.current.filter(
            (id) =>
              id !==
              seatId
          );

        setSelectedSeats(
          remaining
        );

        setLockedSeats(
          (current) =>
            current.filter(
              (id) =>
                id !==
                seatId
            )
        );

        updateBooking({
          selectedSeats:
            remaining,
        });

        if (
          remaining.length ===
          0
        ) {
          setHold(null);

          sessionStorage.removeItem(
            HOLD_STORAGE_KEY
          );
        } else {
          saveHold({
            seatIds:
              remaining,

            lockId:
              currentHold.lockId,

            expiresAt:
              currentHold.expiresAt,
          });
        }
      } catch (error) {
        console.error(
          "Release seat error:",
          error
        );

        toast.error(
          error.response
            ?.data
            ?.message ||
            "Could not release seat."
        );

        refreshLockedSeats();
      } finally {
        setSeatAction(
          null
        );
      }
    };

  // ===================================================
  // SEAT CLICK
  // ===================================================

  const handleSeatClick =
    (seat) => {
      const seatId =
        seat.seatId;

      if (
        selectedSet.has(
          seatId
        )
      ) {
        releaseSeat(
          seat
        );

        return;
      }

      selectSeat(
        seat
      );
    };

  // ===================================================
  // RELEASE ALL + RETURN
  // ===================================================

  const returnToShowtimes =
    async () => {
      const seats =
        [
          ...selectedSeatsRef.current,
        ];

      const currentHold =
        holdRef.current;

      if (
        seats.length >
          0 &&
        currentHold
          ?.lockId
      ) {
        try {
          await axios.delete(
            `${API_URL}/api/seat-locks/release`,

            {
              data: {
                showId,

                seatIds:
                  seats,

                lockId:
                  currentHold.lockId,
              },

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );
        } catch (error) {
          console.error(
            "Release seats:",
            error
          );
        }
      }

      setSelectedSeats(
        []
      );

      setHold(null);

      sessionStorage.removeItem(
        HOLD_STORAGE_KEY
      );

      navigate(
        `/movie/${movieId}?theatre=${
          show?.theatre
            ?._id ||
          theatreId ||
          ""
        }`
      );
    };

  // ===================================================
  // CHECKOUT
  // ===================================================

  const proceedToCheckout =
    () => {
      if (
        selectedSeats.length ===
        0
      ) {
        toast.error(
          "Select at least one seat."
        );

        return;
      }

      if (
        !hold?.lockId ||
        !hold?.expiresAt
      ) {
        toast.error(
          "Your seat reservation is no longer valid."
        );

        return;
      }

      if (
        new Date(
          hold.expiresAt
        ) <= new Date()
      ) {
        toast.error(
          "Your seat reservation expired."
        );

        return;
      }

      setProceeding(
        true
      );

      const checkoutState = {
        movieId,

        showId:
          show._id,

        seatIds: [
          ...selectedSeats,
        ],

        lockId:
          hold.lockId,

        expiresAt:
          hold.expiresAt,

        total:
          selectedTotal,
      };

      // Checkout already knows how to restore this
      // if the page refreshes.
      sessionStorage.setItem(
        CHECKOUT_STORAGE_KEY,

        JSON.stringify(
          checkoutState
        )
      );

      updateBooking({
        movie:
          show.movie,

        show,

        selectedDate:
          show.startTime,

        selectedTime:
          show.startTime,

        selectedSeats:
          [
            ...selectedSeats,
          ],
      });

      navigate(
        "/checkout",

        {
          state:
            checkoutState,
        }
      );
    };

  // ===================================================
  // SEAT BUTTON STYLE
  // ===================================================

  const getSeatClass =
    (seat) => {
      const seatId =
        seat.seatId;

      if (
        selectedSet.has(
          seatId
        )
      ) {
        return "border-red-500 bg-red-600 text-white";
      }

      if (
        bookedSet.has(
          seatId
        )
      ) {
        return "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-700";
      }

      if (
        lockedSet.has(
          seatId
        )
      ) {
        return "cursor-not-allowed border-yellow-900/50 bg-yellow-950/30 text-yellow-700";
      }

      switch (
        seat.type
      ) {
        case "PREMIUM":
          return "border-yellow-700 bg-zinc-900 text-yellow-300";

        case "RECLINER":
          return "border-purple-700 bg-zinc-900 text-purple-300";

        case "LOUNGER":
          return "border-blue-700 bg-zinc-900 text-blue-300";

        case "WHEELCHAIR":
          return "border-green-700 bg-zinc-900 text-green-300";

        default:
          return "border-zinc-600 bg-zinc-900 text-zinc-300";
      }
    };

  // ===================================================
  // LOADING
  // ===================================================

  if (
    authLoading ||
    loading
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <p className="text-zinc-500">
          Loading seats...
        </p>
      </div>
    );
  }

  // ===================================================
  // INVALID SHOW
  // ===================================================

  if (
    !show ||
    !show.screen
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">

        <div className="text-center">

          <p className="text-xl font-semibold">
            Show unavailable
          </p>

          <button
            onClick={() =>
              navigate(
                "/cinemas"
              )
            }
            className="mt-5 text-red-500"
          >
            Choose another show
          </button>

        </div>

      </div>
    );
  }

  // ===================================================
  // PAGE
  // ===================================================

  return (
    <div
      className="min-h-screen pb-20 pt-24"
      data-testid="booking-page"
    >

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* =============================================
            SHOW INFORMATION
        ============================================== */}

        <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-7 md:flex-row md:items-end">

          <div>

            <p className="text-sm text-zinc-500">
              Select your seats
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              {show.movie
                ?.title ||
                "Movie"}
            </h1>

            <div className="mt-4 flex flex-wrap gap-5 text-sm text-zinc-400">

              <div className="flex items-center gap-2">

                <MapPin className="h-4 w-4 text-red-500" />

                <span>
                  {show.theatre
                    ?.name ||
                    "Cinema"}

                  {" • "}

                  {show.screen
                    ?.name ||
                    "Screen"}
                </span>

              </div>

              <div className="flex items-center gap-2">

                <Clock className="h-4 w-4" />

                <span>
                  {formatDate(
                    show.startTime
                  )}

                  {" • "}

                  {formatTime(
                    show.startTime
                  )}
                </span>

              </div>

            </div>

          </div>

          <button
            type="button"
            onClick={
              returnToShowtimes
            }
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300"
          >
            Change Showtime
          </button>

        </div>

        {/* =============================================
            HOLD TIMER
        ============================================== */}

        {selectedSeats.length >
          0 &&
          hold && (
            <div className="mt-6 flex flex-col justify-between gap-3 rounded-lg border border-yellow-900/40 bg-yellow-950/10 p-4 sm:flex-row sm:items-center">

              <div>

                <p className="font-medium text-yellow-300">
                  Seats temporarily reserved
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Complete payment before the timer expires.
                </p>

              </div>

              <div className="font-mono text-xl font-bold text-yellow-300">
                {formatCountdown(
                  secondsLeft
                )}
              </div>

            </div>
          )}

        {/* =============================================
            SCREEN
        ============================================== */}

        <div className="mx-auto mt-12 max-w-3xl">

          <div className="h-1 rounded-full bg-zinc-600" />

          <p className="mt-3 text-center text-xs uppercase tracking-[0.35em] text-zinc-600">
            Screen
          </p>

        </div>

        {/* =============================================
            REAL PHYSICAL SEATS
        ============================================== */}

        {seatRows.length ===
        0 ? (
          <div className="py-20 text-center">

            <Armchair className="mx-auto h-10 w-10 text-zinc-700" />

            <p className="mt-4 text-zinc-500">
              This screen has no active seats configured.
            </p>

          </div>
        ) : (
          <div className="mt-10 overflow-x-auto pb-5">

            <div className="mx-auto w-max min-w-full space-y-4">

              {seatRows.map(
                ({
                  row,
                  seats,
                }) => {
                  const maximumColumn =
                    Math.max(
                      ...seats.map(
                        (seat) =>
                          Number(
                            seat.column ||
                              seat.number ||
                              0
                          )
                      )
                    );

                  return (
                    <div
                      key={row}
                      className="flex items-center justify-center gap-3"
                    >

                      <span className="w-6 text-center text-sm font-semibold text-zinc-500">
                        {row}
                      </span>

                      <div className="flex gap-2">

                        {Array.from(
                          {
                            length:
                              maximumColumn,
                          },

                          (
                            _,
                            index
                          ) => {
                            const column =
                              index + 1;

                            const seat =
                              seats.find(
                                (item) =>
                                  Number(
                                    item.column ||
                                      item.number
                                  ) ===
                                  column
                              );

                            // Missing column = physical aisle.
                            if (!seat) {
                              return (
                                <div
                                  key={`aisle-${row}-${column}`}
                                  className="w-7 sm:w-10"
                                />
                              );
                            }

                            const seatId =
                              seat.seatId;

                            const selected =
                              selectedSet.has(
                                seatId
                              );

                            const booked =
                              bookedSet.has(
                                seatId
                              );

                            const locked =
                              lockedSet.has(
                                seatId
                              ) &&
                              !selected;

                            const disabled =
                              booked ||
                              locked ||
                              (
                                seatAction &&
                                seatAction !==
                                  seatId
                              );

                            return (
                              <button
                                key={
                                  seatId
                                }
                                type="button"
                                disabled={
                                  disabled
                                }
                                onClick={() =>
                                  handleSeatClick(
                                    seat
                                  )
                                }
                                title={`${seatId} • ${seat.type} • ₹${getSeatPrice(
                                  seat
                                )}`}
                                className={`h-8 w-8 rounded border text-[10px] font-semibold sm:h-10 sm:w-10 sm:text-xs ${getSeatClass(
                                  seat
                                )}`}
                              >
                                {
                                  seat.number
                                }
                              </button>
                            );
                          }
                        )}

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </div>
        )}

        {/* =============================================
            LEGEND
        ============================================== */}

        <div className="mt-8 flex flex-wrap justify-center gap-5 text-xs text-zinc-500">

          <Legend
            className="border-zinc-600 bg-zinc-900"
            text="Available"
          />

          <Legend
            className="border-red-500 bg-red-600"
            text="Selected"
          />

          <Legend
            className="border-yellow-900 bg-yellow-950/30"
            text="Temporarily Held"
          />

          <Legend
            className="border-zinc-800 bg-zinc-900 opacity-40"
            text="Booked"
          />

        </div>

        {/* =============================================
            DYNAMIC SEAT PRICING
        ============================================== */}

        {show.pricing
          ?.length >
          0 && (
          <div className="mx-auto mt-8 max-w-3xl">

            <h2 className="text-sm font-semibold">
              Seat Categories
            </h2>

            <div className="mt-3 flex flex-wrap gap-3">

              {show.pricing.map(
                (item) => (
                  <div
                    key={
                      item.seatType
                    }
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-500">
                      {
                        item.seatType
                      }
                    </span>

                    <span className="ml-2 font-semibold">
                      ₹
                      {
                        item.price
                      }
                    </span>
                  </div>
                )
              )}

            </div>

          </div>
        )}

        {/* =============================================
            SUMMARY
        ============================================== */}

        <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-white/10 bg-zinc-900 p-6">

          <div className="flex items-center gap-2">

            <Ticket className="h-5 w-5 text-red-500" />

            <h2 className="text-lg font-semibold">
              Booking Summary
            </h2>

          </div>

          {selectedSeats.length ===
          0 ? (
            <p className="mt-5 text-sm text-zinc-500">
              Select seats to continue.
            </p>
          ) : (
            <>

              <div className="mt-5 space-y-4">

                <div className="flex justify-between gap-5">

                  <span className="text-zinc-500">
                    Seats
                  </span>

                  <span className="text-right font-medium">
                    {selectedSeats.join(
                      ", "
                    )}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="text-zinc-500">
                    Tickets
                  </span>

                  <span className="font-medium">
                    {
                      selectedSeats.length
                    }
                  </span>

                </div>

                {/* INDIVIDUAL PRICE DETAILS */}

                {selectedSeats.map(
                  (seatId) => {
                    const seat =
                      physicalSeats.find(
                        (item) =>
                          item.seatId ===
                          seatId
                      );

                    if (!seat) {
                      return null;
                    }

                    return (
                      <div
                        key={
                          seatId
                        }
                        className="flex justify-between text-sm"
                      >

                        <span className="text-zinc-500">
                          {seatId}{" "}
                          •{" "}
                          {
                            seat.type
                          }
                        </span>

                        <span>
                          ₹
                          {getSeatPrice(
                            seat
                          )}
                        </span>

                      </div>
                    );
                  }
                )}

              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">

                <span className="text-lg font-semibold">
                  Total
                </span>

                <span className="text-2xl font-bold">
                  ₹
                  {selectedTotal.toLocaleString(
                    "en-IN"
                  )}
                </span>

              </div>

              <button
                type="button"
                disabled={
                  proceeding ||
                  secondsLeft <=
                    0
                }
                onClick={
                  proceedToCheckout
                }
                className="mt-6 w-full rounded-lg bg-red-600 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {proceeding
                  ? "Opening Checkout..."
                  : `Pay ₹${selectedTotal.toLocaleString(
                      "en-IN"
                    )}`}
              </button>

            </>
          )}

        </div>

      </div>

    </div>
  );
};

// =====================================================
// LEGEND
// =====================================================

const Legend = ({
  className,
  text,
}) => (
  <div className="flex items-center gap-2">

    <div
      className={`h-5 w-5 rounded border ${className}`}
    />

    <span>
      {text}
    </span>

  </div>
);

export default Booking;