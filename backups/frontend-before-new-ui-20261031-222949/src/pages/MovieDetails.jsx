
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  Play,
  Star,
  Ticket,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import PageShell from "../components/ui/PageShell";
import { formatDuration } from "../utils/formatDuration";

// ============================================================
// BOOKMYSEAT — EDITORIAL FILM DOSSIER
// Build marker: BMS_MOVIE_DETAILS_EDITORIAL_V2
//
// Preserves: real show IDs, theatre-specific sessions,
// booking navigation, trailer and cast data.
// ============================================================

const ZONE = "Asia/Kolkata";

function readLocal(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeLocal(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Selection is also present in the booking URL.
  }
}

function recordId(record) {
  return String(record?._id || record || "");
}

function imageUrl(value) {
  return typeof value === "string" && /^(https?:\/\/|\/)/i.test(value.trim())
    ? value.trim()
    : "";
}

function dateKey(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);

  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function displayDay(key, options) {
  return new Intl.DateTimeFormat("en-IN", {
    ...options,
    timeZone: ZONE,
  }).format(new Date(`${key}T12:00:00+05:30`));
}

function timeLabel(value) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: ZONE,
  }).format(new Date(value));
}

function minPrice(show) {
  const priced = (Array.isArray(show?.pricing) ? show.pricing : [])
    .map((item) => Number(item.price))
    .filter((price) => Number.isFinite(price) && price >= 0);

  if (priced.length) return Math.min(...priced);
  const legacy = Number(show?.price);
  return Number.isFinite(legacy) && legacy >= 0 ? legacy : null;
}

function genresFor(movie) {
  return String(movie?.genre || "")
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
}

function apiBases() {
  const bases = [];

  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    bases.push(`${window.location.protocol}//${window.location.hostname}:5000`);
  }

  bases.push(
    process.env.REACT_APP_BACKEND_URL,
    process.env.REACT_APP_API_URL,
    window.location.origin
  );

  return [...new Set(bases.filter(Boolean).map((base) =>
    String(base).trim().replace(/\/+$/, "").replace(/\/api$/i, "")
  ))];
}

async function fetchApi(path, options, validate) {
  let lastError = null;

  for (const base of apiBases()) {
    try {
      const response = await axios.get(`${base}/api${path}`, {
        ...options,
        timeout: 7000,
      });
      if (!validate(response.data)) throw new Error("Invalid API response");
      return { data: response.data, base };
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      lastError = error;
      console.warn("Movie detail API failed:", `${base}/api${path}`, error);
    }
  }

  throw lastError || new Error("Movie service unavailable");
}

// ============================================================
// ARTWORK: CINEMATIC, READABLE EVEN IF POSTER IS MISSING
// ============================================================

function FilmVisual({ movie }) {
  const urls = useMemo(() =>
    [...new Set([imageUrl(movie?.banner), imageUrl(movie?.poster)].filter(Boolean))],
    [movie?.banner, movie?.poster]
  );
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => setImageIndex(0), [movie?._id]);

  return (
    <div className="group relative h-full min-h-[350px] w-full overflow-hidden rounded-[22px] border border-white/15 bg-[#151419] sm:min-h-[460px]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_55%_20%,rgba(215,25,53,.35),transparent_63%),linear-gradient(145deg,#312129,#0b0a0d_80%)]" />
      <div className="pointer-events-none absolute -right-20 top-12 h-72 w-72 rounded-full border-[30px] border-white/[.035]" />

      {urls[imageIndex] ? (
        <img
          src={urls[imageIndex]}
          alt={`${movie.title} artwork`}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.055]"
          onError={() => setImageIndex((value) => value + 1)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-between p-7 sm:p-9">
          <span className="text-[11px] font-semibold uppercase tracking-[.3em] text-white/60">
            BookMySeat / The film
          </span>
          <div>
            <span className="mb-5 block h-[3px] w-11 bg-[#D71935]" />
            <p className="cine-display max-w-[13ch] break-words text-[clamp(2.2rem,4vw,4.4rem)] leading-[.94] text-white">
              {movie.title}
            </p>
          </div>
          <span className="text-[11px] uppercase tracking-[.22em] text-white/40">
            A story worth the screen
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
      <div className="absolute bottom-5 left-5 rounded-full border border-white/25 bg-black/35 px-4 py-2 text-[11px] font-bold uppercase tracking-[.18em] text-white backdrop-blur-lg sm:bottom-7 sm:left-7">
        Film profile
      </div>
    </div>
  );
}

// ============================================================
// ONE REAL SCREENING (NO MOCK DATES / NO FAKE PRICES)
// ============================================================

function Screening({ show, onChoose, index, reducedMotion }) {
  const price = minPrice(show);
  const tags = [show.language, show.format, show.screen?.name].filter(Boolean);

  return (
    <motion.li
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 6) * 0.05 }}
    >
      <button
        type="button"
        onClick={onChoose}
        data-testid={`show-${show._id}`}
        className="group flex w-full flex-col gap-5 rounded-[18px] border border-white/10 bg-[#141417] px-5 py-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D71935]/65 hover:bg-[#1b171c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D71935] sm:flex-row sm:items-center sm:gap-7 sm:px-7"
      >
        <div className="flex min-w-[130px] items-center gap-3">
          <span className="h-9 w-[3px] rounded-full bg-[#D71935] transition-all group-hover:h-12" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.17em] text-zinc-500">
              Starts at
            </p>
            <p className="cine-head mt-1 text-[clamp(1.65rem,2.4vw,2.3rem)] leading-none text-white">
              {timeLabel(show.startTime)}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:border-l sm:border-white/10 sm:pl-6">
          {tags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-medium text-zinc-300"
            >
              {tag}
            </span>
          ))}
          {tags.length === 0 && (
            <span className="text-sm text-zinc-400">Cinema screening</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-5 border-t border-white/10 pt-4 sm:border-0 sm:pt-0">
          <div>
            <p className="text-[11px] text-zinc-500">
              {price === null ? "Ticket pricing" : "Tickets from"}
            </p>
            <p className="mt-0.5 text-[20px] font-semibold text-white">
              {price === null ? "At checkout" : `₹${price}`}
            </p>
          </div>
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[.04] text-white transition-all duration-300 group-hover:border-[#D71935] group-hover:bg-[#D71935]">
            <ArrowUpRight size={19} />
          </span>
        </div>
      </button>
    </motion.li>
  );
}

// ============================================================
// MOVIE DETAILS PAGE
// ============================================================

export default function MovieDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reducedMotion = useReducedMotion();
  const showtimesRef = useRef(null);

  const theatreId = searchParams.get("theatre") || readLocal("bookmyseat_theatre");
  const [movie, setMovie] = useState(null);
  const [shows, setShows] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cinemaName, setCinemaName] = useState(() => readLocal("bookmyseat_theatre_name"));

  const moviesUrl = theatreId
    ? `/movies?${new URLSearchParams({ theatre: theatreId, ...(readLocal("bookmyseat_city") ? { city: readLocal("bookmyseat_city") } : {}) }).toString()}`
    : "/cinemas";

  // ==========================================================
  // LOAD MOVIE & FILTER THE SELECTED CINEMA'S FUTURE SHOWS
  // ==========================================================

  useEffect(() => {
    if (!theatreId) {
      navigate("/cinemas", { replace: true });
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    setMovie(null);
    setShows([]);
    setSelectedDate("");
    setCinemaName(readLocal("bookmyseat_theatre_name"));

    async function load() {
      try {
        const [movieResult, showsResult] = await Promise.all([
          fetchApi(`/movies/${encodeURIComponent(id)}`, { signal: controller.signal },
            (data) => Boolean(data?.movie?._id && data.movie.title)),
          fetchApi("/shows", {
            signal: controller.signal,
            params: { movie: id, theatre: theatreId, status: "SCHEDULED" },
          }, (data) => Array.isArray(data?.shows) || Array.isArray(data)),
        ]);

        if (controller.signal.aborted) return;

        setMovie(movieResult.data.movie);

        const rawShows = Array.isArray(showsResult.data)
          ? showsResult.data
          : showsResult.data.shows;

        const now = Date.now();
        const upcoming = rawShows
          .filter((show) =>
            Boolean(show.startTime) &&
            new Date(show.startTime).getTime() > now &&
            show.isActive !== false &&
            String(show.status || "SCHEDULED").toUpperCase() === "SCHEDULED" &&
            recordId(show.theatre || show.theatreId) === String(theatreId) &&
            recordId(show.movie || show.movieId) === String(id)
          )
          .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        setShows(upcoming);
        setSelectedDate(upcoming.length ? dateKey(upcoming[0].startTime) : "");

        const venue = upcoming[0]?.theatre;
        const name = (typeof venue === "object" && venue?.name) ||
          readLocal("bookmyseat_theatre_name") || "Selected cinema";
        setCinemaName(name);
        writeLocal("bookmyseat_theatre", theatreId);
        writeLocal("bookmyseat_theatre_name", name);
      } catch (problem) {
        if (controller.signal.aborted) return;
        console.error("Movie details error:", problem);
        setError("We couldn't load this film. Please try again.");
        toast.error(problem.response?.data?.message || "Failed to load movie.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [id, theatreId, navigate]);

  const dates = useMemo(() =>
    [...new Set(shows.map((show) => dateKey(show.startTime)))].filter(Boolean),
    [shows]
  );

  const dayShows = useMemo(() =>
    shows.filter((show) => dateKey(show.startTime) === selectedDate),
    [shows, selectedDate]
  );

  const scrollToShowtimes = () => {
    showtimesRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const selectShow = (show) => {
    writeLocal("bookmyseat_show", show._id);
    writeLocal("bookmyseat_theatre", theatreId);

    const query = new URLSearchParams({ show: show._id, theatre: theatreId });
    navigate(`/booking/${id}?${query.toString()}`);
  };

  const handleTrailer = () => {
    if (movie?.trailer) {
      window.open(movie.trailer, "_blank", "noopener,noreferrer");
    }
  };

  // ==========================================================
  // LOADING & ERROR STATES
  // ==========================================================

  if (loading) {
    return (
      <PageShell glow="none" testId="movie-details-page">
        <div className="mx-auto flex min-h-[75vh] max-w-[1400px] items-center justify-center px-5" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-4">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#D71935]" />
            <p className="text-sm text-zinc-400">Loading film details</p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !movie) {
    return (
      <PageShell glow="none" testId="movie-details-page">
        <div className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-5 text-center">
          <h1 className="cine-head text-3xl text-white">Film unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            {error || "We couldn't find this film in the catalogue."}
          </p>
          <a href={moviesUrl} className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-[#D71935]">
            <ArrowLeft size={16} /> Back to films
          </a>
        </div>
      </PageShell>
    );
  }

  // ==========================================================
  // EDITORIAL PAGE LAYOUT
  // ==========================================================

  return (
    <PageShell glow="left" testId="movie-details-page">
      <main data-design-version="BMS_MOVIE_DETAILS_EDITORIAL_V2" className="relative mx-auto max-w-[1500px] px-5 pb-24 pt-8 text-white md:px-10">
        {/* BACK LINK + MICRO LABEL */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <a
            href={moviesUrl}
            data-testid="back-to-movies"
            className="group inline-flex items-center gap-2.5 rounded-full border border-white/20 px-5 py-2.5 text-[14px] font-semibold text-zinc-200 transition-colors hover:border-[#D71935] hover:bg-white/[.05] hover:text-white"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            Back to films
          </a>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-zinc-500">
            BookMySeat / Film profile
          </p>
        </div>

        {/* ASYMMETRICAL FILM PROFILE */}
        <section className="grid items-center gap-8 border-b border-white/10 py-9 lg:grid-cols-[1.08fr_.92fr] lg:gap-14 lg:py-12">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0"
          >
            <p className="mb-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.24em] text-[#ff536e]">
              <span className="h-px w-8 bg-[#D71935]" />
              The feature presentation
            </p>

            <h1 className="cine-display max-w-[15ch] break-words text-[clamp(2.9rem,4.7vw,5.4rem)] leading-[.94] tracking-[-.015em] text-white">
              {movie.title}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-[14px] text-zinc-300">
              {Number(movie.avgRating) > 0 && (
                <span className="inline-flex items-center gap-2">
                  <Star size={16} className="fill-[#D71935] text-[#D71935]" />
                  {movie.avgRating}/5
                </span>
              )}
              {movie.duration && (
                <span className="inline-flex items-center gap-2">
                  <Clock3 size={16} className="text-[#ff536e]" />
                  {formatDuration(movie.duration)}
                </span>
              )}
              {movie.releaseYear && (
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={16} className="text-[#ff536e]" />
                  {movie.releaseYear}
                </span>
              )}
              {movie.language && (
                <span className="text-zinc-400">{movie.language}</span>
              )}
            </div>

            {movie.genre && (
              <div className="mt-5 flex flex-wrap gap-2">
                {genresFor(movie).map((genre) => (
                  <span key={genre} className="rounded-full border border-white/20 px-4 py-1.5 text-[12px] font-medium text-zinc-300">
                    {genre}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-7 max-w-2xl text-[16px] leading-[1.85] text-zinc-300 sm:text-[17px]">
              {movie.description}
            </p>

            {(movie.director || movie.producer) && (
              <div className="mt-8 flex flex-wrap gap-x-12 gap-y-5 border-t border-white/10 pt-6">
                {movie.director && (
                  <div>
                    <p className="text-xs text-zinc-500">Directed by</p>
                    <p className="mt-1 text-[16px] font-semibold text-white">{movie.director}</p>
                  </div>
                )}
                {movie.producer && (
                  <div>
                    <p className="text-xs text-zinc-500">Produced by</p>
                    <p className="mt-1 text-[16px] font-semibold text-white">{movie.producer}</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={scrollToShowtimes}
                data-testid="jump-showtimes"
                className="inline-flex items-center gap-2.5 rounded-full bg-[#D71935] px-6 py-3.5 text-[14px] font-bold text-white transition-all duration-300 hover:bg-[#eb2b4a] hover:shadow-[0_15px_35px_rgba(215,25,53,.22)]"
              >
                <Ticket size={18} />
                Choose a showtime
                <ArrowRight size={17} />
              </button>

              {movie.trailer && (
                <button
                  type="button"
                  onClick={handleTrailer}
                  data-testid="trailer-button"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3.5 text-[14px] font-semibold text-zinc-200 transition-colors hover:border-white/45 hover:text-white"
                >
                  <Play size={16} /> Trailer
                </button>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0"
          >
            <FilmVisual movie={movie} />
          </motion.div>
        </section>

        {/* SHOWTIME SELECTOR */}
        <section ref={showtimesRef} id="showtimes" className="scroll-mt-24 border-b border-white/10 py-12 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)] lg:gap-16">
            <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
              <p className="mb-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.21em] text-[#ff536e]">
                <span className="h-px w-8 bg-[#D71935]" />
                Your screening
              </p>
              <h2 className="cine-display text-[clamp(2.7rem,4vw,4.5rem)] leading-[.96]">
                Pick a date.<br />Pick your seat.
              </h2>

              <div className="mt-8 border-l-[3px] border-[#D71935] pl-5">
                <p className="mb-1 flex items-center gap-2 text-sm text-zinc-400">
                  <MapPin size={15} className="text-[#ff536e]" /> Showing at
                </p>
                <p className="cine-head text-[clamp(1.35rem,2vw,2rem)] leading-tight text-white">
                  {cinemaName}
                </p>
                <a
                  href="/cinemas"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-[#ff536e]"
                >
                  Change cinema <ArrowUpRight size={15} />
                </a>
              </div>

              <p className="mt-8 max-w-sm text-[14px] leading-relaxed text-zinc-500">
                Select your date and screening. You'll choose your seats on the next page.
              </p>
            </div>

            <div className="min-w-0">
              {shows.length === 0 ? (
                <div className="rounded-[20px] border border-white/10 bg-[#141417] p-8 sm:p-10">
                  <h3 className="cine-head text-2xl">No upcoming screenings</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                    This film isn't scheduled at the selected cinema right now.
                  </p>
                  <a href="/cinemas" className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-semibold transition-colors hover:border-[#D71935]">
                    Explore other cinemas <ArrowUpRight size={15} />
                  </a>
                </div>
              ) : (
                <>
                  <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-zinc-500">Screening dates</p>
                      <p className="mt-2 text-[15px] text-zinc-300">{dates.length} {dates.length === 1 ? "date" : "dates"} · {shows.length} upcoming {shows.length === 1 ? "show" : "shows"}</p>
                    </div>
                    <span className="text-[12px] text-zinc-500">IST</span>
                  </div>

                  <div className="cine-scroll mt-5 flex gap-3 overflow-x-auto pb-3" role="tablist" aria-label="Screening dates">
                    {dates.map((key) => {
                      const active = key === selectedDate;
                      const day = displayDay(key, { weekday: "short" });
                      const number = displayDay(key, { day: "numeric" });
                      const month = displayDay(key, { month: "short" });
                      return (
                        <button
                          type="button"
                          role="tab"
                          key={key}
                          aria-selected={active}
                          onClick={() => setSelectedDate(key)}
                          data-testid={`date-${key}`}
                          className={`min-w-[100px] shrink-0 rounded-[13px] border px-5 py-4 text-center transition-all duration-250 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D71935] ${active
                            ? "border-[#D71935] bg-[#D71935] text-white shadow-[0_12px_32px_rgba(215,25,53,.17)]"
                            : "border-white/15 bg-white/[.035] text-zinc-400 hover:border-white/35 hover:text-white"}`}
                        >
                          <span className="block text-[12px] font-medium">{day}</span>
                          <span className="cine-display my-1 block text-[30px] leading-none">{number}</span>
                          <span className="block text-[12px]">{month}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-7 flex items-center justify-between gap-3">
                    <h3 className="cine-head text-[22px] text-white">Available sessions</h3>
                    <span className="text-[13px] text-zinc-500">{dayShows.length} {dayShows.length === 1 ? "screening" : "screenings"}</span>
                  </div>

                  <ul key={selectedDate} className="mt-4 space-y-3">
                    {dayShows.map((show, index) => (
                      <Screening
                        key={show._id}
                        show={show}
                        index={index}
                        reducedMotion={reducedMotion}
                        onChoose={() => selectShow(show)}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </section>

        {/* OPTIONAL CAST — ONLY REAL DATA IS RENDERED */}
        {Array.isArray(movie.cast) && movie.cast.some((person) => person?.name) && (
          <section className="py-12 lg:py-16">
            <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[.2em] text-[#ff536e]">The people behind the story</p>
                <h2 className="cine-display text-[clamp(2.2rem,3.5vw,3.5rem)]">Cast & characters</h2>
              </div>
              <span className="text-xs text-zinc-500">{movie.cast.filter((person) => person?.name).length} credited</span>
            </div>

            <div className="cine-scroll mt-7 flex gap-4 overflow-x-auto pb-4 sm:gap-5">
              {movie.cast.filter((person) => person?.name).map((person, index) => (
                <div key={`${person.name}-${index}`} className="w-[165px] shrink-0">
                  <div className="relative h-[165px] overflow-hidden rounded-[14px] border border-white/10 bg-[#18181c]">
                    {imageUrl(person.image) ? (
                      <img src={person.image} alt={person.name} className="h-full w-full object-cover grayscale transition duration-500 hover:grayscale-0" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[54px] font-semibold text-zinc-600">{person.name.charAt(0)}</div>
                    )}
                  </div>
                  <p className="mt-3 text-[15px] font-semibold text-white">{person.name}</p>
                  {person.role && <p className="mt-1 text-xs text-zinc-500">{person.role}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="border-t border-white/10 pt-5 text-[12px] text-zinc-500">
          All screening times shown in India Standard Time.
        </footer>
      </main>
    </PageShell>
  );
}
