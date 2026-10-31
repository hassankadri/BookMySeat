
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, CalendarDays, Check, CheckCircle2,
  Clock3, Clapperboard, Film, IndianRupee,
  Loader2, MapPin, MonitorPlay, Plus, Search, ShieldCheck,
  Sparkles, Ticket, Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const FORMATS = ["STANDARD", "3D", "IMAX", "IMAX_3D", "4DX", "DOLBY_CINEMA"];
const easing = [0.22, 1, 0.36, 1];

const control =
  "w-full rounded-xl border border-white/10 bg-[#202025] px-4 py-3.5 text-sm text-white outline-none transition focus:border-[#D71935] disabled:cursor-not-allowed disabled:opacity-40";

const formatName = (value) => String(value || "").replace(/_/g, " ");
const idOf = (value) =>
  String(typeof value === "object" ? value?._id || "" : value || "");
const cash = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const pad = (value) => String(value).padStart(2, "0");

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function movieLanguages(movie) {
  if (!movie) return [];
  return String(movie.language || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getActiveSeats(screen) {
  return Array.isArray(screen?.seats)
    ? screen.seats.filter((seat) => seat.isActive !== false)
    : [];
}

function createSlot({ date, startTime, endTime }) {
  if (!date || !startTime || !endTime) return null;

  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime())
  ) return null;

  if (end <= start) end.setDate(end.getDate() + 1);

  return {
    id: start.toISOString(),
    date,
    startTime,
    endTime,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

const STEPS = [
  { id: "film", number: "01", label: "Choose the film", hint: "Catalogue" },
  { id: "venue", number: "02", label: "Pick the auditorium", hint: "Cinema & screen" },
  { id: "tickets", number: "03", label: "Price the tickets", hint: "Seat categories" },
  { id: "schedule", number: "04", label: "Set the programme", hint: "Screening times" },
];

function Eyebrow({ index, children }) {
  return (
    <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.24em] text-[#f05b74]">
      <span className="h-px w-7 bg-[#D71935]" />
      {index} / {children}
    </p>
  );
}

function Section({ id, index, name, description, children }) {
  return (
    <section id={id} className="scroll-mt-40 border-t border-white/10 pt-9 sm:pt-12">
      <Eyebrow index={index}>{name}</Eyebrow>
      <div className="mb-7 mt-4 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-[clamp(1.8rem,3.4vw,3.15rem)] font-semibold leading-[1.06] tracking-[-.055em] text-[#f5f2ef]">
          {description}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ErrorPanel({ message, retry }) {
  return (
    <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/[.07] p-5 text-sm text-red-200">
      {message}
      {retry && (
        <button type="button" onClick={retry} className="ml-3 underline underline-offset-4">
          Retry
        </button>
      )}
    </div>
  );
}

export default function AddShow() {
  const { token } = useAuth();
  const reduced = useReducedMotion();

  const [movies, setMovies] = useState([]);
  const [theatres, setTheatres] = useState([]);
  const [screens, setScreens] = useState([]);
  const [movie, setMovie] = useState(null);
  const [movieSearch, setMovieSearch] = useState("");
  const [theatreId, setTheatreId] = useState("");
  const [screen, setScreen] = useState(null);
  const [language, setLanguage] = useState("");
  const [format, setFormat] = useState("STANDARD");
  const [prices, setPrices] = useState({});
  const [slots, setSlots] = useState([]);
  const [draft, setDraft] = useState({
    date: today(),
    startTime: "",
    endTime: "",
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [screensLoading, setScreensLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [screenError, setScreenError] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const screenRequest = useRef(0);

  const loadInitial = async (signal) => {
    if (!token) {
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);
    setLoadError("");

    const cfg = {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    };

    try {
      const [m, t] = await Promise.all([
        axios.get(`${API}/api/movies/admin/all`, cfg),
        axios.get(`${API}/api/admin/theatres`, cfg),
      ]);

      if (signal?.aborted) return;

      setMovies(
        (m.data.movies || []).filter(
          (item) => item.listingStatus !== "HIDDEN"
        )
      );

      setTheatres(
        (t.data.theatres || []).filter(
          (item) => item.isActive !== false
        )
      );
    } catch (error) {
      if (!signal?.aborted) {
        setLoadError(
          error.response?.data?.error ||
          "Could not load movie and cinema data."
        );
      }
    } finally {
      if (!signal?.aborted) setInitialLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadInitial(controller.signal);
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    screenRequest.current += 1;
    setScreen(null);
    setPrices({});
    setScreens([]);
    setScreenError("");

    if (!token || !theatreId) {
      setScreensLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setScreensLoading(true);

    axios.get(`${API}/api/screens`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
      params: { theatre: theatreId },
    })
      .then(({ data }) => {
        if (controller.signal.aborted) return;

        const list = Array.isArray(data)
          ? data
          : data.screens || [];

        setScreens(
          list.filter(
            (item) =>
              idOf(item.theatre) === theatreId &&
              item.isActive !== false
          )
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setScreenError(
            error.response?.data?.error ||
            "Unable to load screens for this cinema."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setScreensLoading(false);
      });

    return () => controller.abort();
  }, [theatreId, token]);

  const selectScreen = async (id) => {
    const request = ++screenRequest.current;
    setScreen(null);
    setPrices({});
    setScreenError("");

    if (!id) return;

    setScreenLoading(true);

    try {
      let chosen = screens.find((item) => item._id === id);

      if (!Array.isArray(chosen?.seats) || !chosen.seats.length) {
        const { data } = await axios.get(`${API}/api/screens/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        chosen = data.screen || data;
      }

      if (request !== screenRequest.current) return;

      if (!chosen || !Array.isArray(chosen.seats)) {
        throw new Error("Seat details unavailable");
      }

      const types = [
        ...new Set(
          getActiveSeats(chosen)
            .map((seat) => seat.type)
            .filter(Boolean)
        ),
      ];

      setPrices(
        Object.fromEntries(types.map((type) => [type, ""]))
      );
      setScreen(chosen);
      setFormat(chosen.format || "STANDARD");
    } catch (error) {
      if (request === screenRequest.current) {
        setScreenError(
          error.response?.data?.error ||
          "Could not load this screen's seat layout."
        );
      }
    } finally {
      if (request === screenRequest.current) {
        setScreenLoading(false);
      }
    }
  };

  const filteredMovies = useMemo(
    () => movies.filter((item) =>
      [item.title, item.genre, item.language]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(movieSearch.toLowerCase().trim())
    ),
    [movies, movieSearch]
  );

  const selectedTheatre = theatres.find(
    (item) => item._id === theatreId
  );

  const activeSeats = useMemo(
    () => getActiveSeats(screen),
    [screen]
  );

  const categories = useMemo(() => {
    const map = new Map();

    activeSeats.forEach((seat) => {
      map.set(seat.type, (map.get(seat.type) || 0) + 1);
    });

    return [...map.entries()].map(([type, count]) => ({
      type,
      count,
    }));
  }, [activeSeats]);

  const amountOk =
    categories.length > 0 &&
    categories.every(({ type }) =>
      prices[type] !== "" &&
      Number.isFinite(Number(prices[type])) &&
      Number(prices[type]) > 0
    );

  const totalCapacity = activeSeats.length;

  const grossPotential = categories.reduce(
    (sum, { type, count }) =>
      sum + count * (Number(prices[type]) || 0),
    0
  );

  const completed = [
    Boolean(movie),
    Boolean(theatreId && screen),
    amountOk,
    slots.length > 0,
  ];

  const completedCount = completed.filter(Boolean).length;

  const addSlot = () => {
    const item = createSlot(draft);

    if (!item) {
      toast.error("Enter a valid date, start and end time.");
      return;
    }

    if (new Date(item.start).getTime() <= Date.now()) {
      toast.error("Screening must start in the future.");
      return;
    }

    if (
      slots.some(
        (existing) =>
          new Date(item.start) < new Date(existing.end) &&
          new Date(item.end) > new Date(existing.start)
      )
    ) {
      toast.error(
        "Screening times cannot overlap on the same screen."
      );
      return;
    }

    if (
      new Date(item.end) - new Date(item.start) >
      12 * 60 * 60 * 1000
    ) {
      toast.error(
        "A screening cannot be longer than 12 hours."
      );
      return;
    }

    setSlots((current) =>
      [...current, item].sort(
        (a, b) => new Date(a.start) - new Date(b.start)
      )
    );

    setDraft((current) => ({
      ...current,
      startTime: "",
      endTime: "",
    }));

    setLastResult(null);
  };

  const submit = async () => {
    if (submitting) return;

    if (!movie || !theatreId || !screen || !language.trim()) {
      toast.error(
        "Select the film, cinema, auditorium and language."
      );
      return;
    }

    if (!amountOk) {
      toast.error(
        "Set a positive ticket price for every active seat category."
      );
      return;
    }

    if (!slots.length) {
      toast.error("Add at least one screening time.");
      return;
    }

    if (
      slots.some(
        (slot) =>
          new Date(slot.start).getTime() <= Date.now()
      )
    ) {
      toast.error(
        "One or more screening times are now in the past."
      );
      return;
    }

    setSubmitting(true);
    const failed = [];
    let created = 0;
    let firstError = "";

    const config = {
      headers: { Authorization: `Bearer ${token}` },
    };

    const pricing = categories.map(({ type }) => ({
      seatType: type,
      price: Number(prices[type]),
    }));

    try {
      // Schedule sequentially; retain failed slots for retry.
      for (const slot of slots) {
        try {
          await axios.post(
            `${API}/api/shows`,
            {
              movie: movie._id,
              theatre: theatreId,
              screen: screen._id,
              language: language.trim(),
              format,
              pricing,
              startTime: slot.start,
              endTime: slot.end,
            },
            config
          );

          created += 1;
        } catch (error) {
          failed.push(slot);

          if (!firstError) {
            firstError =
              error.response?.data?.error ||
              error.response?.data?.message ||
              "Scheduling was rejected by the server.";
          }
        }
      }

      setSlots(failed);
      setLastResult({
        created,
        failed: failed.length,
      });

      if (created) {
        toast.success(
          `${created} screening${created === 1 ? "" : "s"} created.`
        );
      }

      if (failed.length) {
        toast.error(
          `${failed.length} slot(s) failed. ${firstError}`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] text-white">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow index="07">
            Programming / new screening
          </Eyebrow>

          <h1 className="mt-5 text-[clamp(2.25rem,3.8vw,4rem)] font-semibold leading-[.93] tracking-[-.078em] text-[#f4f1ed]">
            Set the <span className="text-[#e63b58]">scene.</span>
          </h1>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#a3a3ad]">
            Build a film programme from the actual cinema catalogue,
            room configuration, and ticket inventory.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[.035] px-5 py-3 text-xs text-[#bdbdc6]">
          <Clapperboard
            size={16}
            className="text-[#ef4e6b]"
          />
          New programming session
        </div>
      </header>

      {loadError && (
        <div className="mt-8">
          <ErrorPanel
            message={loadError}
            retry={() => loadInitial()}
          />
        </div>
      )}

      {initialLoading ? (
        <div
          role="status"
          className="mt-12 flex items-center gap-3 text-sm text-zinc-400"
        >
          <Loader2
            size={20}
            className="animate-spin text-[#D71935]"
          />
          Loading cinema data...
        </div>
      ) : (
        <div className="mt-10 grid items-start gap-8 xl:grid-cols-[minmax(0,1.65fr)_minmax(305px,.85fr)]">
          <div className="min-w-0 space-y-12">
            <nav
              aria-label="Scheduling sections"
              className="flex flex-wrap gap-2"
            >
              {STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(`addshow-${step.id}`)
                      ?.scrollIntoView({
                        behavior: reduced ? "auto" : "smooth",
                        block: "start",
                      })
                  }
                  className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs transition hover:border-[#D71935]/60 ${
                    completed[index]
                      ? "border-[#D71935]/25 bg-[#D71935]/10 text-white"
                      : "border-white/10 text-[#92929b]"
                  }`}
                >
                  {completed[index] ? (
                    <Check
                      size={13}
                      className="text-[#f66780]"
                    />
                  ) : (
                    <span className="font-mono">
                      {step.number}
                    </span>
                  )}
                  {step.hint}
                </button>
              ))}
            </nav>

            <Section
              id="addshow-film"
              index="01"
              name="The film"
              description="What are we showing?"
            >
              <div className="relative mb-5">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#757580]"
                />
                <input
                  value={movieSearch}
                  onChange={(event) =>
                    setMovieSearch(event.target.value)
                  }
                  placeholder="Search the movie catalogue"
                  aria-label="Search catalogue"
                  className={`${control} pl-11`}
                />
              </div>

              {filteredMovies.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[.02] p-8 text-sm text-zinc-400">
                  No films found. Add an active movie to the
                  catalogue first.
                </p>
              ) : (
                <div className="grid max-h-[510px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredMovies.map((entry, index) => {
                    const chosen = movie?._id === entry._id;

                    return (
                      <motion.button
                        key={entry._id}
                        type="button"
                        aria-pressed={chosen}
                        onClick={() => {
                          setMovie(entry);
                          setLanguage(
                            movieLanguages(entry)[0] || ""
                          );
                        }}
                        initial={
                          reduced
                            ? false
                            : { opacity: 0, y: 12 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: Math.min(index * 0.035, 0.2),
                        }}
                        className={`group relative min-w-0 overflow-hidden rounded-2xl border text-left transition duration-300 hover:-translate-y-1 ${
                          chosen
                            ? "border-[#ed3b57] bg-[#D71935]/10 shadow-[0_12px_36px_rgba(215,25,53,.14)]"
                            : "border-white/10 bg-[#17171b] hover:border-white/30"
                        }`}
                      >
                        <div className="relative aspect-[2/3] overflow-hidden bg-[#29232a]">
                          {entry.poster ? (
                            <img
                              src={entry.poster}
                              alt={`${entry.title} poster`}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Film
                                size={35}
                                className="text-zinc-600"
                              />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                          {chosen && (
                            <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#D71935] text-white">
                              <Check size={18} />
                            </span>
                          )}

                          <p className="absolute bottom-3 left-3 right-3 truncate text-[10px] font-medium text-white/80">
                            {entry.genre || "Film"}
                          </p>
                        </div>

                        <div className="p-3.5">
                          <p className="truncate text-sm font-semibold text-white">
                            {entry.title}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-[#888892]">
                            {entry.language || "Language unspecified"}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section
              id="addshow-venue"
              index="02"
              name="The location"
              description="Where does it play?"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[.17em] text-[#b2b2ba]">
                    Cinema location
                  </span>
                  <select
                    value={theatreId}
                    onChange={(event) =>
                      setTheatreId(event.target.value)
                    }
                    className={control}
                  >
                    <option value="">
                      Select a cinema
                    </option>
                    {theatres.map((item) => (
                      <option
                        key={item._id}
                        value={item._id}
                      >
                        {item.name} · {item.city}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[.17em] text-[#b2b2ba]">
                    Auditorium
                  </span>
                  <select
                    value={screen?._id || ""}
                    onChange={(event) =>
                      selectScreen(event.target.value)
                    }
                    disabled={
                      !theatreId ||
                      screensLoading ||
                      screenLoading
                    }
                    className={control}
                  >
                    <option value="">
                      {screensLoading || screenLoading
                        ? "Loading screens..."
                        : "Select screen"}
                    </option>
                    {screens.map((item) => (
                      <option
                        key={item._id}
                        value={item._id}
                      >
                        {item.name ||
                          `Screen ${item.screenNumber}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {screenError && (
                <div className="mt-4">
                  <ErrorPanel message={screenError} />
                </div>
              )}

              {screen && (
                <motion.div
                  initial={
                    reduced
                      ? false
                      : { opacity: 0, y: 10 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 flex flex-wrap items-center justify-between gap-5 rounded-[22px] border border-white/10 bg-[#17171b] p-6"
                >
                  <div>
                    <p className="flex items-center gap-2 text-[11px] uppercase tracking-[.17em] text-[#e65a73]">
                      <MonitorPlay size={15} />
                      Selected room
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-[-.045em] text-white">
                      {screen.name}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      {screen.audio || "Audio unspecified"} ·{" "}
                      {formatName(screen.format)}
                    </p>
                  </div>

                  <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border border-[#D71935]/25 bg-[#D71935]/[.08]">
                    <span className="text-3xl font-semibold tabular-nums">
                      {totalCapacity}
                    </span>
                    <span className="mt-1 text-[10px] uppercase tracking-[.14em] text-[#ef7188]">
                      Active seats
                    </span>
                  </div>
                </motion.div>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[.17em] text-[#b2b2ba]">
                    Screening language
                  </span>
                  <input
                    value={language}
                    onChange={(event) =>
                      setLanguage(event.target.value)
                    }
                    placeholder="e.g. Hindi"
                    className={control}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[.17em] text-[#b2b2ba]">
                    Projection format
                  </span>
                  <select
                    value={format}
                    onChange={(event) =>
                      setFormat(event.target.value)
                    }
                    className={control}
                  >
                    {FORMATS.map((item) => (
                      <option key={item} value={item}>
                        {formatName(item)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Section>

            <Section
              id="addshow-tickets"
              index="03"
              name="Ticket strategy"
              description="Price every seat type."
            >
              {!screen ? (
                <p className="rounded-2xl border border-white/10 p-8 text-sm text-zinc-500">
                  Select a screen to load its actual seating categories.
                </p>
              ) : !categories.length ? (
                <ErrorPanel message="This screen has no active seats. Configure its seat map before scheduling." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {categories.map(
                    ({ type, count }, index) => (
                      <motion.label
                        key={type}
                        initial={
                          reduced
                            ? false
                            : { opacity: 0, y: 8 }
                        }
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        transition={{
                          delay: index * 0.07,
                        }}
                        className="group block rounded-[20px] border border-white/10 bg-[#17171b] p-5 transition hover:border-[#D71935]/40"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white">
                            {formatName(type)}
                          </span>
                          <span className="text-xs text-[#85858f]">
                            {count} seats
                          </span>
                        </span>

                        <span className="relative mt-5 block">
                          <IndianRupee
                            size={19}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#f05a74]"
                          />
                          <input
                            aria-label={`${formatName(type)} ticket price`}
                            type="number"
                            min="1"
                            step="1"
                            value={prices[type] ?? ""}
                            onChange={(event) =>
                              setPrices((current) => ({
                                ...current,
                                [type]:
                                  event.target.value,
                              }))
                            }
                            placeholder="Price per seat"
                            className={`${control} pl-11 text-lg font-semibold tabular-nums`}
                          />
                        </span>

                        <p className="mt-3 text-xs text-[#7e7e88]">
                          Max. category gross:{" "}
                          {cash(
                            count *
                              (Number(prices[type]) || 0)
                          )}
                        </p>
                      </motion.label>
                    )
                  )}
                </div>
              )}
            </Section>

            <Section
              id="addshow-schedule"
              index="04"
              name="Programme"
              description="Build the showtime list."
            >
              <div className="rounded-[24px] border border-white/10 bg-[#17171b] p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-xs text-[#a9a9b3]">
                      Date
                    </span>
                    <input
                      type="date"
                      value={draft.date}
                      min={today()}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      className={control}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs text-[#a9a9b3]">
                      Starts
                    </span>
                    <input
                      type="time"
                      value={draft.startTime}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }
                      className={control}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs text-[#a9a9b3]">
                      Ends
                    </span>
                    <input
                      type="time"
                      value={draft.endTime}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }
                      className={control}
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-sm text-xs leading-5 text-[#84848e]">
                    For screenings ending after midnight, the end
                    date advances automatically. Times use this
                    device's local time.
                  </p>
                  <button
                    type="button"
                    onClick={addSlot}
                    className="flex items-center gap-2 rounded-full border border-[#D71935]/55 bg-[#D71935]/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#D71935]"
                  >
                    <Plus size={16} />
                    Add screening
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <AnimatePresence initial={false}>
                  {slots.map((slot, index) => (
                    <motion.div
                      key={slot.id}
                      layout
                      initial={{
                        opacity: 0,
                        y: 8,
                        height: 0,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        height: "auto",
                      }}
                      exit={{
                        opacity: 0,
                        x: 30,
                        height: 0,
                      }}
                      className="flex flex-wrap items-center gap-4 rounded-[18px] border border-white/[.09] bg-[#151518] p-4 sm:p-5"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D71935]/30 bg-[#D71935]/10 font-mono text-xs text-[#fc7088]">
                        {pad(index + 1)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">
                          {new Date(slot.start).toLocaleDateString(
                            "en-IN",
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </p>

                        <p className="mt-1 flex items-center gap-2 text-xs text-[#a7a7b0]">
                          <Clock3 size={13} />
                          {slot.startTime}
                          <ArrowRight size={12} />
                          {slot.endTime}
                          {new Date(slot.end).getDate() !==
                          new Date(slot.start).getDate()
                            ? " · next day"
                            : ""}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSlots((current) =>
                            current.filter(
                              (item) => item.id !== slot.id
                            )
                          )
                        }
                        className="rounded-full border border-white/10 p-2.5 text-[#9999a2] transition hover:border-red-500/40 hover:text-red-300"
                        aria-label={`Remove screening ${index + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {slots.length === 0 && (
                  <div className="rounded-[22px] border border-dashed border-white/10 py-10 text-center">
                    <CalendarDays
                      className="mx-auto text-zinc-600"
                      size={28}
                    />
                    <p className="mt-3 text-sm text-zinc-500">
                      Your screening timeline is empty.
                    </p>
                  </div>
                )}
              </div>
            </Section>
          </div>

          <aside className="min-w-0 xl:sticky xl:top-40">
            <div className="overflow-hidden rounded-[25px] border border-white/10 bg-[#141417]">
              <div className="border-b border-white/10 px-6 py-5">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#ec5a73]">
                  <Sparkles size={15} />
                  Live programme preview
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-.045em]">
                  Before the curtain.
                </h2>
              </div>

              <div className="relative h-44 overflow-hidden bg-[#241820]">
                {movie?.banner || movie?.poster ? (
                  <img
                    src={movie.banner || movie.poster}
                    alt=""
                    className="h-full w-full object-cover opacity-70"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,#632239,transparent_65%)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141417] via-[#141417]/40 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                  <p className="text-[10px] uppercase tracking-[.2em] text-[#f2859a]">
                    Featured selection
                  </p>
                  <p className="mt-1 line-clamp-2 text-xl font-semibold tracking-tight text-white">
                    {movie?.title || "Awaiting film selection"}
                  </p>
                </div>
              </div>

              <div className="space-y-4 px-6 py-6">
                <div className="flex items-center gap-3 text-sm text-[#c4c4cc]">
                  <MapPin size={16} className="shrink-0 text-[#f15a75]" />
                  <span className="truncate">
                    {selectedTheatre?.name || "Choose a cinema"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm text-[#c4c4cc]">
                  <MonitorPlay size={16} className="shrink-0 text-[#f15a75]" />
                  <span className="truncate">
                    {screen?.name || "Choose an auditorium"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm text-[#c4c4cc]">
                  <Ticket size={16} className="shrink-0 text-[#f15a75]" />
                  <span>
                    {totalCapacity} available seats · {slots.length}{" "}
                    showtime{slots.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 border-y border-white/10 py-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[.14em] text-[#858590]">
                      From
                    </p>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                      {amountOk
                        ? cash(
                            Math.min(
                              ...categories.map(({ type }) =>
                                Number(prices[type])
                              )
                            )
                          )
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[.14em] text-[#858590]">
                      Potential gross / show
                    </p>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                      {amountOk
                        ? cash(grossPotential)
                        : "—"}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] font-semibold uppercase tracking-[.17em] text-[#898995]">
                  Readiness · {completedCount} of 4
                </p>

                <div className="grid grid-cols-4 gap-2">
                  {completed.map((done, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full ${
                        done
                          ? "bg-[#D71935]"
                          : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>

                <div className="space-y-3">
                  {STEPS.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 text-xs">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          completed[index]
                            ? "border-[#D71935]/50 bg-[#D71935]/15 text-[#ff7188]"
                            : "border-white/10 text-[#70707b]"
                        }`}
                      >
                        {completed[index] ? (
                          <Check size={13} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span
                        className={
                          completed[index]
                            ? "text-[#d9d9de]"
                            : "text-[#81818c]"
                        }
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={submit}
                  disabled={
                    submitting ||
                    screenLoading ||
                    !completed.every(Boolean) ||
                    !language.trim()
                  }
                  className="mt-2 flex w-full items-center justify-center gap-3 rounded-full bg-[#D71935] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#ee2b4b] disabled:cursor-not-allowed disabled:bg-[#46212b] disabled:text-[#bc8790]"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        className="animate-spin"
                        size={18}
                      />
                      Creating shows...
                    </>
                  ) : (
                    <>
                      Publish {slots.length} screening
                      {slots.length === 1 ? "" : "s"}
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>

                <p className="flex items-start gap-2 text-[11px] leading-5 text-[#85858e]">
                  <ShieldCheck
                    className="mt-0.5 shrink-0 text-[#b44a60]"
                    size={14}
                  />
                  Final availability and schedule conflicts
                  are validated by your backend.
                </p>
              </div>
            </div>

            {lastResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-5 text-sm"
              >
                <p className="flex items-center gap-2 text-[#dcdce2]">
                  <CheckCircle2
                    size={16}
                    className="text-emerald-400"
                  />
                  Last publish attempt
                </p>
                <p className="mt-2 text-zinc-400">
                  {lastResult.created} created ·{" "}
                  {lastResult.failed} remaining for retry
                </p>
              </motion.div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
