
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Armchair,
  CalendarDays,
  Clock3,
  Info,
  MapPin,
  MonitorPlay,
  ShieldCheck,
  Ticket,
  Timer,
} from "lucide-react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBooking } from "../context/BookingContext";
import { attachSeatEventRecovery } from "../utils/seatEventRecovery";
import SeatIntelligencePanel from "../components/SeatIntelligencePanel";
import "./BookingCinema.css";

// ============================================================
// BOOKMYSEAT — CINEMATIC SEAT SELECTION V3
//
// Uses actual physical Screen.seats, Redis locks, Socket.IO,
// server-defined ticket pricing, and the existing checkout flow.
// ============================================================

const API_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

const HOLD_KEY = "bookmyseat_seat_hold";
const CHECKOUT_KEY = "bookmyseat_checkout";
const MAX_SEATS = 10;

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const normalizeIds = (input) =>
  Array.isArray(input)
    ? [
        ...new Set(
          input
            .map((item) =>
              String(
                typeof item === "string"
                  ? item
                  : item?.seatId || ""
              )
                .trim()
                .toUpperCase()
            )
            .filter(Boolean)
        ),
      ]
    : [];

const dateText = (date) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date(date))
    : "—";

const timeText = (date) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      }).format(new Date(date))
    : "—";

const countText = (seconds) =>
  `${String(Math.floor(Math.max(seconds, 0) / 60)).padStart(
    2,
    "0"
  )}:${String(Math.max(seconds, 0) % 60).padStart(2, "0")}`;

const imageSrc = (value) =>
  typeof value === "string" &&
  /^(https?:\/\/|\/\/)/i.test(value.trim())
    ? value.trim()
    : "";

// ============================================================
// REALISTIC CINEMA CHAIR
// ============================================================

function SeatIcon({
  status = "available",
  category = "REGULAR",
  size = "normal",
}) {
  return (
    <span
      className={`bms-chair bms-chair--${status} bms-chair--${size} bms-chair--${String(
        category
      ).toLowerCase()}`}
      aria-hidden="true"
    >
      <span className="bms-chair__back" />
      <span className="bms-chair__cushion" />
      <span className="bms-chair__arm bms-chair__arm--left" />
      <span className="bms-chair__arm bms-chair__arm--right" />
      <span className="bms-chair__base" />
    </span>
  );
}

function StatusLegend({ status, title }) {
  return (
    <span className="bms-seat-legend__item">
      <SeatIcon status={status} size="mini" />
      <span>{title}</span>
    </span>
  );
}

// ============================================================
// MAIN BOOKING PAGE
// ============================================================

function Booking() {
  const { id: movieId } = useParams();
  const [params] = useSearchParams();

  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const {
    token,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const { updateBooking } = useBooking();

  const updateBookingRef = useRef(updateBooking);

  useEffect(() => {
    updateBookingRef.current = updateBooking;
  }, [updateBooking]);

  const showId =
    params.get("show") ||
    localStorage.getItem("bookmyseat_show");

  const theatreId =
    params.get("theatre") ||
    localStorage.getItem("bookmyseat_theatre");

  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");

  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [lockedSeats, setLockedSeats] = useState([]);

  const [hold, setHold] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [seatAction, setSeatAction] = useState(null);
  const [proceeding, setProceeding] = useState(false);
  const [focusType, setFocusType] = useState("ALL");

  const selectedRef = useRef([]);
  const holdRef = useRef(null);

  useEffect(() => {
    selectedRef.current = selectedSeats;
  }, [selectedSeats]);

  useEffect(() => {
    holdRef.current = hold;
  }, [hold]);

  // ==========================================================
  // AUTHENTICATION
  // ==========================================================

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast.error("Please login to book tickets.");
      navigate("/auth", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // ==========================================================
  // RESTORE EXISTING SEAT HOLD
  // ==========================================================

  useEffect(() => {
    if (!showId) return;

    try {
      const saved = JSON.parse(
        sessionStorage.getItem(HOLD_KEY) || "null"
      );

      if (!saved || String(saved.showId) !== String(showId)) {
        return;
      }

      if (
        !saved.lockId ||
        !saved.expiresAt ||
        Date.parse(saved.expiresAt) <= Date.now()
      ) {
        sessionStorage.removeItem(HOLD_KEY);
        return;
      }

      const seats = normalizeIds(saved.seatIds);

      if (!seats.length) return;

      setSelectedSeats(seats);

      setHold({
        lockId: saved.lockId,
        expiresAt: saved.expiresAt,
      });
    } catch (_) {
      sessionStorage.removeItem(HOLD_KEY);
    }
  }, [showId]);

  const saveHold = useCallback(
    (seatIds, nextHold) => {
      if (
        !nextHold?.lockId ||
        !nextHold?.expiresAt ||
        !seatIds.length
      ) {
        sessionStorage.removeItem(HOLD_KEY);
        return;
      }

      sessionStorage.setItem(
        HOLD_KEY,
        JSON.stringify({
          showId,
          seatIds,
          lockId: nextHold.lockId,
          expiresAt: nextHold.expiresAt,
        })
      );
    },
    [showId]
  );

  // ==========================================================
  // LOAD ACTUAL SHOW, SCREEN AND BOOKED SEATS
  // ==========================================================

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    if (!showId) {
      toast.error("Please select a show first.");

      navigate(
        `/movie/${movieId}${
          theatreId ? `?theatre=${theatreId}` : ""
        }`,
        { replace: true }
      );

      return;
    }

    let live = true;

    setLoading(true);
    setFailed("");

    axios
      .get(`${API_URL}/api/shows/${showId}`)
      .then(({ data }) => {
        if (!live) return;

        const nextShow = data?.show;

        if (!nextShow) {
          throw new Error("Show not found.");
        }

        const loadedId =
          nextShow.movie?._id || nextShow.movie;

        if (
          movieId &&
          String(loadedId) !== String(movieId)
        ) {
          throw new Error(
            "Selected show does not belong to this movie."
          );
        }

        setShow(nextShow);

        setBookedSeats(
          normalizeIds(nextShow.bookedSeats)
        );

        localStorage.setItem(
          "bookmyseat_show",
          String(nextShow._id)
        );

        if (nextShow.theatre?._id) {
          localStorage.setItem(
            "bookmyseat_theatre",
            String(nextShow.theatre._id)
          );
        }

        if (nextShow.theatre?.name) {
          localStorage.setItem(
            "bookmyseat_theatre_name",
            nextShow.theatre.name
          );
        }
      })
      .catch((error) => {
        if (!live) return;

        console.error("Load booking show:", error);

        setFailed(
          error.response?.data?.message ||
            error.message ||
            "Could not load this show."
        );
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [
    authLoading,
    isAuthenticated,
    showId,
    movieId,
    theatreId,
    navigate,
  ]);

  // ==========================================================
  // FETCH REDIS SEAT LOCKS
  // ==========================================================

  const refreshLockedSeats = useCallback(async () => {
    if (!showId) return;

    try {
      const { data } = await axios.get(
        `${API_URL}/api/seat-locks/${showId}`
      );

      setLockedSeats(normalizeIds(data?.lockedSeats));
    } catch (error) {
      console.error("Load seat locks:", error);
    }
  }, [showId]);

  useEffect(() => {
    if (!showId) return;

    refreshLockedSeats();

    // Socket.IO is primary. Polling recovers missed events.
    const interval = setInterval(
      refreshLockedSeats,
      15000
    );

    return () => clearInterval(interval);
  }, [showId, refreshLockedSeats]);

  // ==========================================================
  // SOCKET.IO REAL-TIME SEAT UPDATES
  // ==========================================================

  useEffect(() => {
    if (!showId) return;

    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    const matches = (payload) =>
      !payload?.showId ||
      String(payload.showId) === String(showId);

    const onHeld = (payload) => {
      if (!matches(payload)) return;

      setLockedSeats((old) => [
        ...new Set([
          ...old,
          ...normalizeIds(payload?.seatIds),
        ]),
      ]);
    };

    const onReleased = (payload) => {
      if (!matches(payload)) return;

      const released = new Set(
        normalizeIds(payload?.seatIds)
      );

      setLockedSeats((old) =>
        old.filter((id) => !released.has(id))
      );
    };

    const onBooked = (payload) => {
      if (!matches(payload)) return;

      const seats = normalizeIds(payload?.seatIds);
      const booked = new Set(seats);

      setBookedSeats((old) => [
        ...new Set([...old, ...seats]),
      ]);

      setLockedSeats((old) =>
        old.filter((id) => !booked.has(id))
      );

      setSelectedSeats((old) =>
        old.filter((id) => !booked.has(id))
      );
    };

    const detachRecovery = attachSeatEventRecovery({
      socket,
      showId,
      apiUrl: API_URL,
      refreshLockedSeats,

      onBookedSnapshot: (serverSeats) => {
        const booked = normalizeIds(serverSeats);

        setBookedSeats(booked);

        const unavailable = new Set(booked);

        if (
          selectedRef.current.some((id) =>
            unavailable.has(id)
          )
        ) {
          selectedRef.current = [];
          holdRef.current = null;

          setSelectedSeats([]);
          setHold(null);

          sessionStorage.removeItem(HOLD_KEY);

          updateBookingRef.current({
            selectedSeats: [],
          });

          toast.error(
            "Seat availability changed. Please choose your seats again."
          );
        }
      },
    });

    socket.on("seats:held", onHeld);
    socket.on("seats:released", onReleased);
    socket.on("seats:booked", onBooked);

    return () => {
      socket.emit("show:leave", { showId });

      socket.off("seats:held", onHeld);
      socket.off("seats:released", onReleased);
      socket.off("seats:booked", onBooked);

      detachRecovery();
      socket.disconnect();
    };
  }, [showId, refreshLockedSeats]);

  // ==========================================================
  // HOLD EXPIRY COUNTDOWN
  // ==========================================================

  useEffect(() => {
    if (!hold?.expiresAt) {
      setSecondsLeft(0);
      return;
    }

    let expired = false;

    const tick = () => {
      const remaining = Math.max(
        Math.ceil(
          (Date.parse(hold.expiresAt) - Date.now()) / 1000
        ),
        0
      );

      setSecondsLeft(remaining);

      if (remaining === 0 && !expired) {
        expired = true;

        setHold(null);
        setSelectedSeats([]);

        selectedRef.current = [];

        updateBooking({
          selectedSeats: [],
        });

        sessionStorage.removeItem(HOLD_KEY);

        refreshLockedSeats();

        toast.error(
          "Your seat hold expired. Please select your seats again."
        );
      }
    };

    tick();

    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [
    hold?.expiresAt,
    refreshLockedSeats,
    updateBooking,
  ]);

  // ==========================================================
  // REAL PHYSICAL SEATS AND PRICING
  // ==========================================================

  const seats = useMemo(
    () =>
      Array.isArray(show?.screen?.seats)
        ? show.screen.seats
            .filter((seat) => seat.isActive !== false)
            .map((seat) => ({
              ...seat,
              seatId: String(
                seat.seatId || ""
              ).toUpperCase(),
            }))
            .filter((seat) => seat.seatId)
        : [],
    [show]
  );

  const seatById = useMemo(
    () =>
      new Map(
        seats.map((seat) => [
          seat.seatId,
          seat,
        ])
      ),
    [seats]
  );

  const pricing = useMemo(
    () =>
      new Map(
        (show?.pricing || []).map((item) => [
          String(item.seatType).toUpperCase(),
          Number(item.price || 0),
        ])
      ),
    [show]
  );

  const getSeatPrice = useCallback(
    (seat) =>
      pricing.get(
        String(seat.type).toUpperCase()
      ) ?? Number(show?.price || 0),
    [pricing, show?.price]
  );

  // ==========================================================
  // ORGANIZE SEATS BY ROW AND PHYSICAL COLUMN
  // ==========================================================

  const seatRows = useMemo(() => {
    const rows = new Map();

    seats.forEach((seat) => {
      const row = String(
        seat.row || ""
      ).toUpperCase();

      if (!row) return;

      if (!rows.has(row)) {
        rows.set(row, []);
      }

      rows.get(row).push(seat);
    });

    return [...rows.entries()]
      .map(([row, list]) => ({
        row,
        seats: list.sort(
          (a, b) =>
            Number(a.column || a.number || 0) -
            Number(b.column || b.number || 0)
        ),
      }))
      .sort((a, b) =>
        a.row.localeCompare(
          b.row,
          undefined,
          { numeric: true }
        )
      );
  }, [seats]);

  const seatColumns = useMemo(
    () =>
      Math.max(
        0,
        ...seats.map((seat) =>
          Number(
            seat.column ||
              seat.number ||
              0
          )
        )
      ),
    [seats]
  );

  const seatMap = useMemo(
    () =>
      new Map(
        seatRows.flatMap(({ row, seats: list }) =>
          list.map((seat) => [
            `${row}:${Number(
              seat.column || seat.number
            )}`,
            seat,
          ])
        )
      ),
    [seatRows]
  );

  const selectedSet = useMemo(
    () => new Set(selectedSeats),
    [selectedSeats]
  );

  const bookedSet = useMemo(
    () => new Set(bookedSeats),
    [bookedSeats]
  );

  const lockedSet = useMemo(
    () => new Set(lockedSeats),
    [lockedSeats]
  );

  const selectedTotal = useMemo(
    () =>
      selectedSeats.reduce(
        (sum, seatId) =>
          sum +
          (seatById.has(seatId)
            ? getSeatPrice(seatById.get(seatId))
            : 0),
        0
      ),
    [
      selectedSeats,
      seatById,
      getSeatPrice,
    ]
  );

  const categories = useMemo(
    () =>
      (show?.pricing || []).filter((item) =>
        seats.some(
          (seat) =>
            String(seat.type).toUpperCase() ===
            String(item.seatType).toUpperCase()
        )
      ),
    [show, seats]
  );

  const availableCount = seats.filter(
    (seat) =>
      !bookedSet.has(seat.seatId) &&
      !lockedSet.has(seat.seatId)
  ).length;

  const seatStatus = (seatId) => {
    if (selectedSet.has(seatId)) return "selected";
    if (bookedSet.has(seatId)) return "booked";
    if (lockedSet.has(seatId)) return "held";
    return "available";
  };

  // ==========================================================
  // HOLD SELECTED SEAT ON SERVER
  // ==========================================================

  const selectSeat = async (seat) => {
    if (
      seatAction ||
      bookedSet.has(seat.seatId) ||
      lockedSet.has(seat.seatId)
    ) {
      return;
    }

    if (selectedRef.current.length >= MAX_SEATS) {
      toast.error(
        `You can select a maximum of ${MAX_SEATS} seats.`
      );
      return;
    }

    setSeatAction(seat.seatId);

    try {
      const next = [
        ...selectedRef.current,
        seat.seatId,
      ];

      const { data } = await axios.post(
        `${API_URL}/api/seat-locks/hold`,
        {
          showId,
          seatIds: next,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const confirmed = normalizeIds(
        data.seats || next
      );

      const nextHold = {
        lockId: data.lockId,
        expiresAt: data.expiresAt,
      };

      setSelectedSeats(confirmed);
      selectedRef.current = confirmed;

      setLockedSeats((old) => [
        ...new Set([
          ...old,
          ...confirmed,
        ]),
      ]);

      setHold(nextHold);
      saveHold(confirmed, nextHold);

      updateBooking({
        movie: show?.movie,
        show,
        selectedDate: show?.startTime,
        selectedTime: show?.startTime,
        selectedSeats: confirmed,
      });
    } catch (error) {
      console.error("Hold seat error:", error);

      toast.error(
        error.response?.data?.message ||
          "This seat is no longer available."
      );

      refreshLockedSeats();
    } finally {
      setSeatAction(null);
    }
  };

  // ==========================================================
  // RELEASE ONE SELECTED SEAT
  // ==========================================================

  const releaseSeat = async (seat) => {
    if (seatAction) return;

    const current = holdRef.current;

    if (!current?.lockId) {
      const remaining = selectedRef.current.filter(
        (id) => id !== seat.seatId
      );

      setSelectedSeats(remaining);
      selectedRef.current = remaining;

      updateBooking({
        selectedSeats: remaining,
      });

      return;
    }

    setSeatAction(seat.seatId);

    try {
      await axios.delete(
        `${API_URL}/api/seat-locks/release`,
        {
          data: {
            showId,
            seatIds: [seat.seatId],
            lockId: current.lockId,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const remaining = selectedRef.current.filter(
        (id) => id !== seat.seatId
      );

      setSelectedSeats(remaining);
      selectedRef.current = remaining;

      setLockedSeats((old) =>
        old.filter((id) => id !== seat.seatId)
      );

      updateBooking({
        selectedSeats: remaining,
      });

      if (remaining.length) {
        saveHold(remaining, current);
      } else {
        setHold(null);
        sessionStorage.removeItem(HOLD_KEY);
      }
    } catch (error) {
      console.error("Release seat error:", error);

      toast.error(
        error.response?.data?.message ||
          "Could not release seat."
      );

      refreshLockedSeats();
    } finally {
      setSeatAction(null);
    }
  };

  const clickSeat = (seat) => {
    if (selectedSet.has(seat.seatId)) {
      releaseSeat(seat);
    } else {
      selectSeat(seat);
    }
  };

  // ==========================================================
  // ACCESSIBLE KEYBOARD SEAT NAVIGATION
  // ==========================================================
  //
  // Arrow keys follow physical rows and columns.
  // Unavailable seats are skipped.
  //
  // Home / End move to the first / last seat in a row.
  //
  // Enter / Space remain native button actions.
  // ==========================================================

  const handleSeatMapKeyDown = (event) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    const keys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ];

    if (!keys.includes(event.key)) return;

    const current = event.target.closest?.(
      "button[data-bms-seat-id]"
    );

    const container = event.currentTarget;

    if (!current || !container.contains(current)) {
      return;
    }

    const buttons = Array.from(
      container.querySelectorAll(
        "button[data-bms-seat-id]"
      )
    ).filter(
      (button) =>
        !button.disabled &&
        button.getClientRects().length
    );

    if (!buttons.length) return;

    const rows = [
      ...new Set(
        buttons.map(
          (button) => button.dataset.seatRow
        )
      ),
    ];

    const currentRow = current.dataset.seatRow;
    const rowIndex = rows.indexOf(currentRow);

    const column = Number(
      current.dataset.seatColumn
    );

    const inRow = (row) =>
      buttons
        .filter(
          (button) => button.dataset.seatRow === row
        )
        .sort(
          (a, b) =>
            Number(a.dataset.seatColumn) -
            Number(b.dataset.seatColumn)
        );

    let target = null;

    const ownRow = inRow(currentRow);
    const ownIndex = ownRow.indexOf(current);

    if (event.key === "Home") {
      target = ownRow[0];
    } else if (event.key === "End") {
      target = ownRow[ownRow.length - 1];
    } else if (event.key === "ArrowLeft") {
      target = ownRow[ownIndex - 1];
    } else if (event.key === "ArrowRight") {
      target = ownRow[ownIndex + 1];
    } else {
      const step =
        event.key === "ArrowDown" ? 1 : -1;

      for (
        let i = rowIndex + step;
        i >= 0 && i < rows.length;
        i += step
      ) {
        const candidates = inRow(rows[i]);

        if (candidates.length) {
          target = candidates.reduce(
            (best, button) =>
              Math.abs(
                Number(button.dataset.seatColumn) -
                  column
              ) <
              Math.abs(
                Number(best.dataset.seatColumn) -
                  column
              )
                ? button
                : best
          );

          break;
        }
      }
    }

    // Only prevent scrolling when focus can move.
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  // ==========================================================
  // CHANGE SHOWTIME AND RELEASE EXISTING HOLD
  // ==========================================================

  const returnToShowtimes = async () => {
    if (seatAction || proceeding) return;

    const current = holdRef.current;
    const currentSeats = [
      ...selectedRef.current,
    ];

    if (
      currentSeats.length &&
      current?.lockId
    ) {
      try {
        await axios.delete(
          `${API_URL}/api/seat-locks/release`,
          {
            data: {
              showId,
              seatIds: currentSeats,
              lockId: current.lockId,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (error) {
        console.error("Release seats:", error);
      }
    }

    setSelectedSeats([]);
    selectedRef.current = [];
    setHold(null);

    updateBooking({
      selectedSeats: [],
    });

    sessionStorage.removeItem(HOLD_KEY);

    navigate(
      `/movie/${movieId}?theatre=${
        show?.theatre?._id ||
        theatreId ||
        ""
      }`
    );
  };

  // ==========================================================
  // EXISTING CHECKOUT CONTRACT — UNCHANGED
  // ==========================================================

  const proceedToCheckout = () => {
    if (seatAction || proceeding) return;

    if (!selectedSeats.length) {
      toast.error("Select at least one seat.");
      return;
    }

    if (
      !hold?.lockId ||
      !hold?.expiresAt ||
      Date.parse(hold.expiresAt) <= Date.now()
    ) {
      toast.error(
        "Your seat reservation expired. Please select again."
      );
      return;
    }

    setProceeding(true);

    const checkoutState = {
      movieId,
      showId: show._id,
      seatIds: [...selectedSeats],
      lockId: hold.lockId,
      expiresAt: hold.expiresAt,
      total: selectedTotal,
    };

    sessionStorage.setItem(
      CHECKOUT_KEY,
      JSON.stringify(checkoutState)
    );

    updateBooking({
      movie: show.movie,
      show,
      selectedDate: show.startTime,
      selectedTime: show.startTime,
      selectedSeats: [...selectedSeats],
    });

    navigate("/checkout", {
      state: checkoutState,
    });
  };

  // ==========================================================
  // LOADING / ERROR STATES
  // ==========================================================

  if (authLoading || loading) {
    return (
      <main
        id="main-content"
        className="bms-seat-page bms-seat-loading"
        data-testid="booking-page"
      >
        <span className="bms-seat-spinner" />
        Preparing your auditorium…
      </main>
    );
  }

  if (!show?.screen || failed) {
    return (
      <main
        id="main-content"
        className="bms-seat-page bms-seat-loading"
        data-testid="booking-page"
      >
        <h2>Show unavailable</h2>

        <p>
          {failed ||
            "This screening could not be loaded."}
        </p>

        <button
          className="bms-seat-btn-secondary"
          onClick={() => navigate("/cinemas")}
        >
          Browse cinemas
        </button>
      </main>
    );
  }

  const poster = imageSrc(
    show.movie?.poster ||
      show.movie?.banner
  );

  const banner = imageSrc(
    show.movie?.banner ||
      show.movie?.poster
  );

  const heading =
    show.movie?.title ||
    "Your screening";

  // ==========================================================
  // PREMIUM CINEMATIC INTERFACE
  // ==========================================================

  return (
    <main
      id="main-content"
      className="bms-seat-page"
      data-testid="booking-page"
      data-design-version="BMS_CINEMATIC_SEATS_V3"
    >
      <div
        className="bms-seat-ambient"
        aria-hidden="true"
        style={
          banner
            ? {
                backgroundImage: `linear-gradient(90deg,#09090c 0%,rgba(9,9,12,.78) 58%,rgba(9,9,12,.55) 100%),url("${banner}")`,
              }
            : undefined
        }
      />

      <div className="bms-seat-container">
        {/* MOVIE INFORMATION */}

        <motion.div
          className="bms-seat-header"
          initial={
            reducedMotion
              ? false
              : { opacity: 0, y: 14 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <button
            type="button"
            className="bms-seat-back"
            onClick={returnToShowtimes}
            disabled={Boolean(
              seatAction || proceeding
            )}
            aria-label="Back to showtimes"
          >
            <ArrowLeft size={19} />
            <span>Back</span>
          </button>

          <div className="bms-seat-film">
            {poster ? (
              <img
                className="bms-seat-film__poster"
                src={poster}
                alt={`${heading} poster`}
              />
            ) : (
              <div className="bms-seat-film__poster bms-seat-film__poster--empty">
                <MonitorPlay size={30} />
              </div>
            )}

            <div>
              <p className="bms-seat-eyebrow">
                Your screening · Select your seats
              </p>

              <h1>{heading}</h1>

              <div className="bms-seat-film__metadata">
                <span>
                  <MapPin size={15} />
                  {show.theatre?.name || "Cinema"}
                </span>

                <span>
                  <MonitorPlay size={15} />
                  {show.screen?.name || "Screen"}
                </span>

                <span>
                  <CalendarDays size={15} />
                  {dateText(show.startTime)}
                </span>

                <span>
                  <Clock3 size={15} />
                  {timeText(show.startTime)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="bms-seat-btn-secondary bms-seat-change"
            onClick={returnToShowtimes}
            disabled={Boolean(
              seatAction || proceeding
            )}
          >
            <CalendarDays size={17} />
            Change showtime
          </button>
        </motion.div>

        <div className="bms-seat-layout">
          {/* AUDITORIUM / SEAT MAP */}

          <motion.section
            className="bms-seat-auditorium"
            initial={
              reducedMotion
                ? false
                : { opacity: 0, y: 22 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.08,
            }}
            aria-label="Interactive cinema seat map"
          >
            <div className="bms-seat-room-head">
              <span className="bms-seat-room-head__label">
                AUDITORIUM EXPERIENCE
              </span>

              <span className="bms-seat-room-head__count">
                <span className="bms-seat-live-dot" />
                {availableCount} seats available
              </span>
            </div>

            {/* CURVED CINEMA SCREEN */}

            <div
              className="bms-seat-screen"
              aria-hidden="true"
            >
              <div className="bms-seat-screen__curve" />
              <span>SCREEN</span>
              <div className="bms-seat-screen__glow" />
            </div>

            {/* LIVE RESERVATION COUNTDOWN */}

            {selectedSeats.length > 0 && hold && (
              <div
                className="bms-seat-timer"
                aria-label="Seat hold countdown"
              >
                <span>
                  <Timer size={16} />
                  Your seats are held. Complete
                  checkout before the timer ends.
                </span>

                <strong
                  aria-live="off"
                  aria-label={`${countText(secondsLeft)} remaining`}
                >
                  {countText(secondsLeft)}
                </strong>

                <span
                  className="sr-only"
                  role="status"
                  aria-live="polite"
                >
                  {secondsLeft <= 30
                    ? "Less than 30 seconds remain to finish checkout."
                    : secondsLeft <= 60
                      ? "Less than one minute remains to finish checkout."
                      : ""}
                </span>
              </div>
            )}

            {/* REAL PHYSICAL SEAT GRID */}

            {seatRows.length === 0 ? (
              <div className="bms-seat-empty">
                <Armchair size={34} />
                <p>
                  This auditorium has no active
                  seats configured.
                </p>
              </div>
            ) : (
              <div className="bms-seat-map-scroll">
                {/* SELECTION ANNOUNCEMENTS */}

                <p
                  className="sr-only"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {selectedSeats.length
                    ? `${selectedSeats.length} seat${
                        selectedSeats.length === 1
                          ? ""
                          : "s"
                      } selected: ${selectedSeats.join(", ")}.`
                    : "No seats selected."}
                </p>

                {/* KEYBOARD INSTRUCTIONS */}

                <p
                  id="bms-seat-keyboard-help"
                  className="sr-only"
                >
                  Use Tab to enter the seat map.
                  Arrow keys move between available
                  seats. Home and End move to the
                  first and last seat in a row.
                  Enter or Space selects or releases
                  a seat.
                </p>

                <div
                  className="bms-seat-map"
                  role="group"
                  aria-label="Select your seats"
                  aria-describedby="bms-seat-keyboard-help"
                  onKeyDown={handleSeatMapKeyDown}
                  style={{
                    "--bms-cols": seatColumns,
                  }}
                >
                  {seatRows.map(({ row }) => (
                    <div
                      className="bms-seat-row"
                      key={row}
                    >
                      <span className="bms-seat-row__label">
                        {row}
                      </span>

                      <div className="bms-seat-row__chairs">
                        {Array.from(
                          {
                            length: seatColumns,
                          },
                          (_, index) => {
                            const column = index + 1;

                            const seat = seatMap.get(
                              `${row}:${column}`
                            );

                            // Missing physical columns
                            // remain empty as aisles.

                            if (!seat) {
                              return (
                                <span
                                  className="bms-seat-aisle"
                                  key={`${row}-aisle-${column}`}
                                  aria-hidden="true"
                                />
                              );
                            }

                            const status = seatStatus(
                              seat.seatId
                            );

                            const category = String(
                              seat.type || "REGULAR"
                            ).toUpperCase();

                            const disabled =
                              status === "booked" ||
                              status === "held" ||
                              Boolean(seatAction) ||
                              proceeding;

                            const dimmed =
                              focusType !== "ALL" &&
                              category !== focusType &&
                              status !== "selected";

                            return (
                              <button
                                type="button"
                                key={seat.seatId}
                                data-bms-seat-id={
                                  seat.seatId
                                }
                                data-seat-row={row}
                                data-seat-column={column}
                                className={`bms-seat-position focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D71935]${
                                  dimmed
                                    ? " bms-seat-position--muted"
                                    : ""
                                }`}
                                title={`${seat.seatId} · ${category} · ${money(
                                  getSeatPrice(seat)
                                )} · ${status}`}
                                aria-label={`Seat ${
                                  seat.seatId
                                }, ${category.toLowerCase()}, ${money(
                                  getSeatPrice(seat)
                                )}, ${status}`}
                                aria-pressed={
                                  status === "selected"
                                }
                                disabled={
                                  status === "booked" ||
                                  status === "held" ||
                                  proceeding
                                }
                                aria-disabled={disabled}
                                aria-busy={
                                  seatAction === seat.seatId
                                }
                                data-testid={`seat-${seat.seatId}`}
                                onClick={() =>
                                  clickSeat(seat)
                                }
                              >
                                <SeatIcon
                                  status={status}
                                  category={category}
                                />

                                <span className="bms-seat-position__number">
                                  {seat.number ||
                                    column}
                                </span>

                                {seatAction ===
                                  seat.seatId && (
                                  <span className="bms-seat-position__busy" />
                                )}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <span className="bms-seat-row__label">
                        {row}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STATUS LEGEND */}

            <div
              className="bms-seat-legend"
              aria-label="Seat availability legend"
            >
              <StatusLegend
                status="available"
                title="Available"
              />

              <StatusLegend
                status="selected"
                title="Selected"
              />

              <StatusLegend
                status="held"
                title="Temporarily held"
              />

              <StatusLegend
                status="booked"
                title="Booked"
              />
            </div>

            {/* SEAT CATEGORIES */}

            <div className="bms-seat-category-head">
              <div>
                <p className="bms-seat-eyebrow">
                  CHOOSE YOUR COMFORT
                </p>

                <h2>Seat categories</h2>
              </div>

              <p>
                Prices set by this cinema
              </p>
            </div>

            <div className="bms-seat-categories">
              {categories.map((item) => {
                const type = String(
                  item.seatType
                ).toUpperCase();

                const active =
                  focusType === type;

                const label =
                  type.charAt(0) +
                  type.slice(1).toLowerCase();

                const descriptions = {
                  REGULAR:
                    "The classic cinema experience",
                  PREMIUM:
                    "A little more room to relax",
                  RECLINER:
                    "Extra comfort, every scene",
                  LOUNGER:
                    "Room to stretch out",
                  WHEELCHAIR:
                    "Accessible seating",
                };

                return (
                  <button
                    key={type}
                    type="button"
                    className={`bms-seat-category${
                      active
                        ? " bms-seat-category--active"
                        : ""
                    }`}
                    aria-pressed={active}
                    onClick={() =>
                      setFocusType(
                        active ? "ALL" : type
                      )
                    }
                  >
                    <SeatIcon
                      category={type}
                      status="available"
                      size="category"
                    />

                    <span className="bms-seat-category__text">
                      <strong>{label}</strong>

                      <small>
                        {descriptions[type] ||
                          "Cinema seating"}
                      </small>

                      <b>
                        {money(item.price)}
                      </b>
                    </span>

                    <span className="bms-seat-category__radio" />
                  </button>
                );
              })}
            </div>

            {focusType !== "ALL" && (
              <button
                type="button"
                className="bms-seat-clear-filter"
                onClick={() =>
                  setFocusType("ALL")
                }
              >
                Show all seat categories
              </button>
            )}

            <p className="bms-seat-note">
              <Info size={14} />
              Choose seats directly from the map.
              Categories only highlight their
              locations; availability is updated
              live.
            </p>
          </motion.section>

          {/* STICKY BOOKING SUMMARY */}

          <motion.aside
            className="bms-seat-summary"
            initial={
              reducedMotion
                ? false
                : { opacity: 0, x: 20 }
            }
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.14,
            }}
          >
            <SeatIntelligencePanel
              showId={showId}
              apiUrl={API_URL}
              token={token}
              selectedCount={selectedSeats.length}
              busy={Boolean(seatAction || proceeding)}
              onApply={async (suggestion) => {
                if (
                  seatAction ||
                  proceeding ||
                  selectedRef.current.length > 0 ||
                  holdRef.current?.lockId
                ) {
                  toast.error(
                    "Deselect your current seats before applying a recommendation."
                  );

                  return false;
                }

                const requested = normalizeIds(
                  suggestion.seatIds
                );

                if (
                  !requested.length ||
                  requested.length > MAX_SEATS ||
                  requested.some(
                    (id) =>
                      !seatById.has(id) ||
                      bookedSet.has(id) ||
                      lockedSet.has(id)
                  )
                ) {
                  toast.error(
                    "Availability changed. Find seats again."
                  );

                  await refreshLockedSeats();
                  return false;
                }

                setSeatAction("SMART_PICK");

                try {
                  const { data } = await axios.post(
                    `${API_URL}/api/seat-locks/hold`,
                    {
                      showId,
                      seatIds: requested,
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                      timeout: 12000,
                    }
                  );

                  const confirmed = normalizeIds(
                    data.seats
                  );

                  const matches =
                    confirmed.length === requested.length &&
                    confirmed.every((id) =>
                      requested.includes(id)
                    );

                  if (
                    !data.success ||
                    !matches ||
                    !data.lockId ||
                    !data.expiresAt
                  ) {
                    throw new Error(
                      "The server did not confirm the requested seat hold."
                    );
                  }

                  const nextHold = {
                    lockId: data.lockId,
                    expiresAt: data.expiresAt,
                  };

                  selectedRef.current = confirmed;
                  holdRef.current = nextHold;

                  setSelectedSeats(confirmed);
                  setHold(nextHold);

                  setLockedSeats((old) => [
                    ...new Set([...old, ...confirmed]),
                  ]);

                  saveHold(confirmed, nextHold);

                  updateBooking({
                    movie: show?.movie,
                    show,
                    selectedDate: show?.startTime,
                    selectedTime: show?.startTime,
                    selectedSeats: confirmed,
                  });

                  toast.success(
                    "Your recommended seats are held."
                  );

                  return true;
                } catch (error) {
                  toast.error(
                    error.response?.data?.message ||
                      error.message ||
                      "These seats are no longer available."
                  );

                  await refreshLockedSeats();
                  return false;
                } finally {
                  setSeatAction(null);
                }
              }}
            />

            <div className="bms-seat-summary__head">
              <span className="bms-seat-summary__icon">
                <Ticket size={22} />
              </span>

              <div>
                <h2>Booking summary</h2>

                <p>
                  {selectedSeats.length
                    ? `${selectedSeats.length} ${
                        selectedSeats.length === 1
                          ? "seat"
                          : "seats"
                      } selected`
                    : "Build your cinema experience"}
                </p>
              </div>
            </div>

            {selectedSeats.length === 0 ? (
              <div className="bms-seat-summary__empty">
                <div className="bms-seat-summary__empty-chair">
                  <SeatIcon size="large" />
                </div>

                <h3>
                  Your perfect seats await
                </h3>

                <p>
                  Choose your favourite seats
                  from the auditorium to see
                  your booking here.
                </p>
              </div>
            ) : (
              <div className="bms-seat-summary__selections">
                <div className="bms-seat-summary__section-label">
                  YOUR SEATS
                </div>

                <div className="bms-seat-summary__pills">
                  {selectedSeats.map((id) => (
                    <span
                      className="bms-seat-summary__pill"
                      key={id}
                    >
                      {id}
                    </span>
                  ))}
                </div>

                <div className="bms-seat-summary__lines">
                  {selectedSeats.map((id) => {
                    const seat = seatById.get(id);

                    if (!seat) return null;

                    return (
                      <div key={id}>
                        <span>
                          {id} ·{" "}
                          {String(
                            seat.type || "Regular"
                          ).toLowerCase()}
                        </span>

                        <strong>
                          {money(
                            getSeatPrice(seat)
                          )}
                        </strong>
                      </div>
                    );
                  })}
                </div>

                {hold && (
                  <div className="bms-seat-summary__held">
                    <ShieldCheck size={15} />
                    Seats held for

                    <strong>
                      {countText(secondsLeft)}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* LIVE PRICE BREAKDOWN */}

            <div className="bms-seat-summary__total">
              <div>
                <span>
                  Tickets ({selectedSeats.length})
                </span>

                <strong>
                  {money(selectedTotal)}
                </strong>
              </div>

              <div>
                <span>
                  Convenience fee
                  <Info size={13} />
                </span>

                <span>
                  Calculated at checkout
                </span>
              </div>

              <div className="bms-seat-summary__grand">
                <strong>
                  Ticket subtotal
                </strong>

                <b>
                  {money(selectedTotal)}
                </b>
              </div>
            </div>

            <button
              type="button"
              className="bms-seat-pay"
              disabled={
                !selectedSeats.length ||
                !hold?.lockId ||
                secondsLeft <= 0 ||
                proceeding ||
                Boolean(seatAction)
              }
              onClick={proceedToCheckout}
              data-testid="proceed-to-checkout"
            >
              <span>
                {proceeding
                  ? "Opening checkout…"
                  : selectedSeats.length
                    ? `Continue · ${money(selectedTotal)}`
                    : "Select seats to continue"}
              </span>

              <ArrowRight size={18} />
            </button>

            <p className="bms-seat-summary__disclaimer">
              <ShieldCheck size={14} />
              Secure reservation. Final charges
              are confirmed at checkout.
            </p>
          </motion.aside>
        </div>
      </div>
    </main>
  );
}

export default Booking;
