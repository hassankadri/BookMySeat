
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Film,
  MapPin,
  Search,
  Ticket,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageShell from "../components/ui/PageShell";
import { formatDuration } from "../utils/formatDuration";

// =============================================================
// BOOKMYSEAT / CINEMA GALLERY V5
// Build marker: BMS_CINEMA_GALLERY_V5_NAV
//
// Only "Details & tickets" navigates to a film.
// Dates and times are display-only with hover styling.
// Existing theatre filtering and booking routes are preserved.
// =============================================================

const readStore = (key) => {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const writeStore = (key, value) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // The theatre ID is also in the URL.
  }
};

const idOf = (value) => String(value?._id || value || "");

const genresOf = (movie) =>
  String(movie?.genre || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const dateOf = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));

const timeOf = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));

const pad = (value) => String(value).padStart(2, "0");

// =============================================================
// BACKEND CONNECTION
// =============================================================

function showEndpoints() {
  const roots = [];

  if (
    ["localhost", "127.0.0.1"].includes(
      window.location.hostname
    )
  ) {
    roots.push(
      `${window.location.protocol}//${window.location.hostname}:5000`
    );
  }

  roots.push(
    process.env.REACT_APP_BACKEND_URL,
    process.env.REACT_APP_API_URL,
    window.location.origin
  );

  return [
    ...new Set(
      roots.filter(Boolean).map((root) => {
        const base = String(root).trim().replace(/\/+$/, "");
        return /\/api$/i.test(base)
          ? `${base}/shows`
          : `${base}/api/shows`;
      })
    ),
  ];
}

async function fetchCinemaShows(theatreId, signal) {
  let lastError;

  for (const endpoint of showEndpoints()) {
    try {
      const { data } = await axios.get(endpoint, {
        params: {
          theatre: theatreId,
          status: "SCHEDULED",
        },
        signal,
        timeout: 7000,
      });

      const result = Array.isArray(data)
        ? data
        : data?.shows;

      if (
        !Array.isArray(result) ||
        data?.success === false
      ) {
        throw new Error(
          "Invalid response from the showtime service."
        );
      }

      return result;
    } catch (error) {
      if (signal.aborted) throw error;

      lastError = error;

      console.warn(
        "Showtime request unavailable:",
        endpoint,
        error
      );
    }
  }

  throw lastError || new Error("Showtime service unavailable.");
}

// =============================================================
// CURSOR-FOLLOWING CRIMSON SPOTLIGHT
// =============================================================

function moveSpotlight(event) {
  if (event.pointerType === "touch") return;

  const bounds = event.currentTarget.getBoundingClientRect();

  event.currentTarget.style.setProperty(
    "--spot-x",
    `${event.clientX - bounds.left}px`
  );

  event.currentTarget.style.setProperty(
    "--spot-y",
    `${event.clientY - bounds.top}px`
  );
}

const moviePalettes = [
  ["#233039", "#729eb3"],
  ["#362127", "#ed6984"],
  ["#303128", "#c6bf8d"],
  ["#282239", "#a597d6"],
  ["#332b22", "#dcb491"],
];

// =============================================================
// FILM ARTWORK
// =============================================================

function FilmImage({ movie, index }) {
  const sources = useMemo(
    () => [
      ...new Set(
        [movie?.poster, movie?.banner].filter(
          (value) =>
            typeof value === "string" &&
            /^(https?:\/\/|\/)/i.test(value.trim())
        )
      ),
    ],
    [movie?.poster, movie?.banner]
  );

  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [movie?._id]);

  const current = sources[imageIndex];
  const palette = moviePalettes[index % moviePalettes.length];

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[16px] bg-[#141418]"
      style={{
        background: `radial-gradient(circle at 65% 20%,${palette[0]},transparent 70%),linear-gradient(155deg,${palette[0]},#0a0a0d 88%)`,
      }}
    >
      {current ? (
        <img
          src={current}
          alt={`${movie.title} poster`}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() =>
            setImageIndex((i) => i + 1)
          }
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.055]"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-between overflow-hidden p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-[.19em] text-white/60">
            <span>BOOKMYSEAT</span>
            <Film size={18} strokeWidth={1.4} />
          </div>

          <div
            aria-hidden="true"
            className="absolute -right-[80px] top-[15%] h-[250px] w-[250px] rotate-[-25deg] rounded-full border-[32px] border-white/[.055]"
          />

          <div
            aria-hidden="true"
            className="absolute -left-[90px] bottom-[-90px] h-[230px] w-[230px] rounded-full border-[25px] border-white/[.04]"
          />

          <div className="relative z-10">
            <span
              className="mb-4 block h-[3px] w-10"
              style={{
                backgroundColor: palette[1],
              }}
            />

            <p className="cine-head break-words text-[clamp(1.45rem,2vw,2.3rem)] leading-[1.06] text-white">
              {movie.title}
            </p>
          </div>

          <span className="relative z-10 text-[10px] uppercase tracking-[.22em] text-white/45">
            Film programme / {pad(index + 1)}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
    </div>
  );
}

// =============================================================
// DISPLAY-ONLY SESSION
// =============================================================

function Session({ show }) {
  return (
    <div className="group/session cursor-default select-none rounded-xl border border-white/[.12] bg-white/[.035] px-4 py-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D71935]/65 hover:bg-[#D71935]/[.11] hover:shadow-[0_8px_24px_rgba(215,25,53,.10)]">
      <div className="flex items-center gap-2 text-[12px] text-zinc-400 transition-colors group-hover/session:text-zinc-200">
        <CalendarDays
          size={14}
          className="shrink-0 text-[#ef4863] transition-transform duration-300 group-hover/session:scale-110"
        />

        <span>{dateOf(show.startTime)}</span>
      </div>

      <p className="mt-2 pl-[22px] text-[19px] font-semibold tabular-nums text-white sm:text-[20px]">
        {timeOf(show.startTime)}
      </p>
    </div>
  );
}

// =============================================================
// FILM CARD
// =============================================================

function FilmCard({
  movie,
  index,
  onDetails,
  reducedMotion,
}) {
  const shows = movie.availableShows || [];

  const meta = [
  formatDuration(movie.duration),
  movie.language,
]
  .filter(Boolean)
  .join("  /  ");

  return (
    <motion.article
      onPointerMove={moveSpotlight}
      initial={
        reducedMotion
          ? false
          : { opacity: 0, y: 26 }
      }
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        amount: 0.12,
      }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group relative isolate min-w-0 overflow-hidden rounded-[26px] border border-white/[.12] bg-[#111114] transition-[border-color,transform,box-shadow] duration-500 hover:-translate-y-1 hover:border-[#D71935]/55 hover:shadow-[0_25px_65px_rgba(0,0,0,.34)]"
    >
      {/* CURSOR-FOLLOWING RED LIGHT */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(390px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(215,25,53,.23), rgba(215,25,53,.055) 38%, transparent 76%)",
        }}
      />

      <div className="relative z-10 p-5 sm:p-7">
        <div className="grid grid-cols-[minmax(0,1fr)_38%] gap-5 sm:min-h-[250px] sm:gap-7">

          <div className="flex min-w-0 flex-col justify-between py-1">
            <div>
              <div className="mb-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#fd5871]">
                <span className="h-px w-7 bg-[#D71935]" />
                Film {pad(index + 1)}
              </div>

              <h2 className="cine-head break-words text-[clamp(1.9rem,2.7vw,2.85rem)] leading-[1.04] tracking-tight text-[#f7f6f7]">
                {movie.title}
              </h2>

              <p className="mt-4 text-[14px] leading-6 text-zinc-300">
                {genresOf(movie).slice(0, 3).join(" / ") || "Film"}
              </p>

              {meta && (
                <p className="mt-2 text-[13px] text-zinc-500">
                  {meta}
                </p>
              )}
            </div>

            <p className="mt-5 flex items-center gap-2 text-[12px] text-zinc-500">
              <Clock3
                size={14}
                className="text-[#ee4963]"
              />

              {shows.length} upcoming{" "}
              {shows.length === 1
                ? "session"
                : "sessions"}
            </p>
          </div>

          <div className="h-[230px] min-w-0 sm:h-[260px]">
            <FilmImage
              movie={movie}
              index={index}
            />
          </div>
        </div>

        <div className="mt-6 border-t border-white/[.12] pt-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-zinc-400">
              Upcoming showtimes
            </p>

            <span className="text-[12px] text-zinc-500">
              IST
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {shows.slice(0, 2).map((show) => (
              <Session
                key={show._id}
                show={show}
              />
            ))}
          </div>

          {/* ONLY DETAILS & TICKETS NAVIGATES */}

          <button
            type="button"
            onClick={onDetails}
            data-testid={`movie-${movie._id}`}
            className="mt-5 flex w-full items-center justify-between gap-3 rounded-full bg-[#D71935] px-6 py-4 text-[15px] font-semibold text-white transition-all duration-300 hover:bg-[#ef2e50] hover:shadow-[0_12px_30px_rgba(215,25,53,.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span className="inline-flex items-center gap-2.5">
              <Ticket size={18} />
              Details & tickets
            </span>

            <ArrowUpRight
              size={18}
              className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

// =============================================================
// MOVIES PAGE
// =============================================================

export default function Movies() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [searchParams] = useSearchParams();

  const theatreId =
    searchParams.get("theatre") ||
    readStore("bookmyseat_theatre");

  const cityQuery =
    searchParams.get("city") || "";

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");

  const [cinemaName, setCinemaName] = useState(
    () =>
      readStore("bookmyseat_theatre_name") ||
      "Selected cinema"
  );

  const [city, setCity] = useState(
    () =>
      cityQuery ||
      readStore("bookmyseat_city")
  );

  useEffect(() => {
    if (!theatreId) {
      navigate("/cinemas", {
        replace: true,
      });
    }
  }, [theatreId, navigate]);

  // LOAD SCHEDULED MOVIES

  useEffect(() => {
    if (!theatreId) return undefined;

    const controller = new AbortController();

    setLoading(true);
    setError("");
    setMovies([]);
    setSearch("");
    setGenre("All");

    setCinemaName(
      readStore("bookmyseat_theatre_name") ||
        "Selected cinema"
    );

    setCity(
      cityQuery ||
        readStore("bookmyseat_city")
    );

    async function load() {
      try {
        const records = await fetchCinemaShows(
          theatreId,
          controller.signal
        );

        if (controller.signal.aborted) return;

        const now = Date.now();

        const upcoming = records
          .filter((show) => {
            const start = new Date(
              show.startTime
            ).getTime();

            return (
              Number.isFinite(start) &&
              start > now &&
              show.isActive !== false &&
              String(
                show.status || "SCHEDULED"
              ).toUpperCase() === "SCHEDULED" &&
              idOf(
                show.theatre || show.theatreId
              ) === String(theatreId)
            );
          })
          .sort(
            (a, b) =>
              new Date(a.startTime) -
              new Date(b.startTime)
          );

        const grouped = new Map();

        for (const show of upcoming) {
          const movie = show.movie;

          if (
            !movie ||
            typeof movie !== "object" ||
            !movie._id
          ) {
            continue;
          }

          const key = String(movie._id);

          if (!grouped.has(key)) {
            grouped.set(key, {
              ...movie,
              availableShows: [],
            });
          }

          grouped.get(key).availableShows.push(show);
        }

        setMovies([...grouped.values()]);

        const theatre = upcoming[0]?.theatre;

        const name =
          (typeof theatre === "object" &&
            theatre?.name) ||
          readStore("bookmyseat_theatre_name") ||
          "Selected cinema";

        const resolvedCity =
          (typeof theatre === "object" &&
            theatre?.city) ||
          cityQuery ||
          readStore("bookmyseat_city");

        setCinemaName(name);
        setCity(resolvedCity);

        writeStore(
          "bookmyseat_theatre",
          theatreId
        );

        writeStore(
          "bookmyseat_theatre_name",
          name
        );

        if (resolvedCity) {
          writeStore(
            "bookmyseat_city",
            resolvedCity
          );
        }
      } catch (problem) {
        if (controller.signal.aborted) return;

        console.error(
          "Unable to load cinema programme:",
          problem
        );

        setError(
          "The cinema programme couldn't be loaded. Please try again."
        );

        setMovies([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [
    theatreId,
    cityQuery,
    retry,
  ]);

  // GENRE AND SEARCH

  const genres = useMemo(
    () => [
      "All",
      ...new Set(
        movies.flatMap(genresOf)
      ),
    ],
    [movies]
  );

  const visibleMovies = useMemo(() => {
    const word = search.trim().toLowerCase();

    // Films remain ordered by their nearest upcoming screening.
    return movies.filter(
      (movie) =>
        (
          !word ||
          String(movie.title || "")
            .toLowerCase()
            .includes(word)
        ) &&
        (
          genre === "All" ||
          genresOf(movie).includes(genre)
        )
    );
  }, [movies, search, genre]);

  const totalShows = movies.reduce(
    (total, movie) =>
      total + movie.availableShows.length,
    0
  );

  const openDetails = (movie) => {
    navigate(
      `/movie/${movie._id}?theatre=${encodeURIComponent(
        theatreId
      )}`
    );
  };

  return (
    <PageShell glow="right" testId="movies-page">
      <main
        data-design-version="BMS_CINEMA_GALLERY_V5_NAV"
        className="relative mx-auto max-w-[1480px] px-5 pb-24 pt-9 text-[#f7f6f6] md:px-10"
      >

        {/* TOP HEADER — BACK LINK ON LEFT */}

        <header className="border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <a
              href="/cinemas"
              data-testid="change-cinema"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:border-[#D71935] hover:bg-white/[.055]"
            >
              <ArrowLeft size={17} />
              Back to cinemas
            </a>

            <span className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.23em] text-[#fa526b]">
              <span className="h-px w-8 bg-[#D71935]" />
              Now showing
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1
                className="cine-head text-[clamp(2.4rem,4vw,4rem)] leading-[1.02] tracking-tight"
                data-testid="movies-cinema-name"
              >
                {cinemaName || "Selected cinema"}
              </h1>

              {city && (
                <p className="mt-3 inline-flex items-center gap-2 text-[15px] text-zinc-400">
                  <MapPin
                    size={16}
                    className="text-[#ec4963]"
                  />
                  {city}
                </p>
              )}
            </div>

            {!loading && !error && (
              <p className="text-[14px] text-zinc-400">
                <span className="font-bold text-white">
                  {movies.length}
                </span>{" "}
                films

                <span className="mx-3 text-zinc-600">
                  /
                </span>

                <span className="font-bold text-white">
                  {totalShows}
                </span>{" "}
                upcoming showtimes
              </p>
            )}
          </div>
        </header>

        {/* SEARCH AND GENRE FILTERS */}

        <section aria-label="Film filters" className="py-7">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[210px] flex-1 sm:max-w-[440px]">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search films"
                aria-label="Search films"
                data-testid="movie-search"
                className="h-12 w-full rounded-xl border border-white/[.15] bg-[#16161a] pl-12 pr-4 text-[15px] text-white outline-none placeholder:text-zinc-500 focus:border-[#D71935]"
              />
            </div>
          </div>

          <div
            className="cine-scroll mt-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Filter by genre"
          >
            {genres.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={genre === item}
                onClick={() => setGenre(item)}
                className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D71935] ${
                  genre === item
                    ? "border-[#D71935] bg-[#D71935] text-white"
                    : "border-white/[.18] text-zinc-400 hover:border-white/45 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {/* LOADING */}

        {loading && (
          <div
            className="grid gap-6 lg:grid-cols-2"
            aria-label="Loading films"
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[480px] animate-pulse rounded-[26px] bg-white/[.05]"
              />
            ))}
          </div>
        )}

        {/* API ERROR */}

        {!loading && error && (
          <section
            role="alert"
            className="mx-auto mt-8 max-w-xl rounded-2xl border border-white/[.15] bg-[#151518] p-10 text-center"
          >
            <h2 className="cine-head text-3xl">
              Showtimes unavailable
            </h2>

            <p className="mt-4 text-[15px] text-zinc-400">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                setRetry((n) => n + 1)
              }
              className="mt-6 rounded-full bg-[#D71935] px-6 py-3 text-[14px] font-semibold text-white hover:bg-[#ec304c]"
            >
              Try again
            </button>
          </section>
        )}

        {/* NO MATCHING FILMS */}

        {!loading &&
          !error &&
          visibleMovies.length === 0 && (
            <section className="mx-auto mt-8 max-w-xl rounded-2xl border border-white/[.15] bg-[#151518] p-10 text-center">
              <h2 className="cine-head text-3xl">
                {movies.length
                  ? "No matching films"
                  : "No upcoming screenings"}
              </h2>

              <p className="mt-4 text-[15px] text-zinc-400">
                {movies.length
                  ? "Try another movie title or genre."
                  : "There are no upcoming screenings at this cinema right now."}
              </p>

              {movies.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setGenre("All");
                  }}
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-[14px] font-semibold text-white"
                >
                  <X size={15} />
                  Clear filters
                </button>
              ) : (
                <a
                  href="/cinemas"
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-[14px] font-semibold text-white"
                >
                  <ArrowLeft size={15} />
                  All cinemas
                </a>
              )}
            </section>
          )}

        {/* EXISTING TWO-COLUMN MOVIE GALLERY */}

        {!loading &&
          !error &&
          visibleMovies.length > 0 && (
            <section aria-label="Films now showing">
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="cine-head text-[clamp(1.7rem,2.3vw,2.5rem)] text-white">
                  In this cinema
                </h2>

                <span className="text-[13px] text-zinc-500">
                  {visibleMovies.length} films
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-2 lg:gap-7">
                {visibleMovies.map((movie, index) => (
                  <FilmCard
                    key={movie._id}
                    movie={movie}
                    index={index}
                    onDetails={() =>
                      openDetails(movie)
                    }
                    reducedMotion={reducedMotion}
                  />
                ))}
              </div>
            </section>
          )}

        {/* FOOTER — WITHOUT SECOND CINEMA LINK */}

        <footer className="mt-12 border-t border-white/10 pt-6 text-[13px] text-zinc-500">
          Screening times displayed in India Standard Time.
        </footer>
      </main>
    </PageShell>
  );
}
