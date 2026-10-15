
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Film,
  MapPin,
  Play,
  Search,
  Ticket,
  X,
} from "lucide-react";

import "../styles/kimi-cinema.css";

const API_URL = process.env.REACT_APP_BACKEND_URL || "";

const CINEMA_PHOTO =
  "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=2000&q=85";

const clamp = (n, low, high) =>
  Math.max(low, Math.min(high, n));

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function dateText(value) {
  const d = new Date(value);

  if (!value || Number.isNaN(d.getTime())) {
    return "Showtime coming soon";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function filmLink(movie) {
  const theatreId = movie?.nextShow?.theatre?._id;

  return `/movie/${encodeURIComponent(movie._id)}${
    theatreId
      ? `?theatre=${encodeURIComponent(theatreId)}`
      : ""
  }`;
}

function youtubeLink(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    let id = null;

    if (host === "youtu.be" || host === "www.youtu.be") {
      id = url.pathname.slice(1);
    }

    if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
      ].includes(host)
    ) {
      id =
        url.searchParams.get("v") ||
        url.pathname.match(
          /\/(?:embed|shorts|live)\/([\w-]+)/
        )?.[1];
    }

    return /^[\w-]{11}$/.test(id || "")
      ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`
      : null;
  } catch {
    return null;
  }
}

function genreText(movie) {
  if (Array.isArray(movie.genre)) {
    return movie.genre.join(" / ");
  }

  return movie.genre || "Cinema";
}

// --------------------------------------------------
// Poster with safe missing-image state
// --------------------------------------------------

function Poster({ movie, className = "" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [movie?.poster]);

  return (
    <div className={`kimi-poster ${className}`}>
      {movie?.poster && !failed ? (
        <img
          src={movie.poster}
          alt={`${movie.title} poster`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="kimi-poster-fallback"
          aria-label={`Artwork unavailable for ${
            movie?.title || "film"
          }`}
        >
          <Film
            size={28}
            strokeWidth={1}
            aria-hidden="true"
          />
          <span>Poster unavailable</span>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------
// Scroll reveal
// --------------------------------------------------

function Reveal({
  children,
  className = "",
  delay = 0,
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={
        reduce
          ? false
          : { opacity: 0, y: 28 }
      }
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: 0.65,
        delay,
        ease: [0.2, 0.7, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

// --------------------------------------------------
// Interactive 3D ticket
// --------------------------------------------------

function HeroTicket({ film }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  function tilt(event) {
    if (
      reduce ||
      !ref.current ||
      event.pointerType === "touch"
    ) {
      return;
    }

    const box = ref.current.getBoundingClientRect();

    const x =
      (event.clientX - box.left) / box.width - 0.5;

    const y =
      (event.clientY - box.top) / box.height - 0.5;

    ref.current.style.setProperty(
      "--tilt-x",
      `${-y * 12}deg`
    );

    ref.current.style.setProperty(
      "--tilt-y",
      `${x * 14}deg`
    );
  }

  function reset() {
    if (!ref.current) return;

    ref.current.style.setProperty(
      "--tilt-x",
      "0deg"
    );

    ref.current.style.setProperty(
      "--tilt-y",
      "0deg"
    );
  }

  return (
    <div
      className="kimi-ticket-scene"
      onPointerMove={tilt}
      onPointerLeave={reset}
    >
      <div
        className="kimi-orbit-ring"
        aria-hidden="true"
      />

      <div className="kimi-ticket" ref={ref}>
        <div className="kimi-ticket-header">
          <span>BOOKMYSEAT / ADMIT ONE</span>
          <span>01—26</span>
        </div>

        <div className="kimi-ticket-art">
          <Poster movie={film || { title: "" }} />
        </div>

        <div className="kimi-ticket-bottom">
          <span>FEATURED SCREENING</span>

          <strong>
            {film?.title || "YOUR NEXT FILM"}
          </strong>

          <small>
            {film?.nextShow?.startTime
              ? dateText(film.nextShow.startTime)
              : "Explore available films"}
          </small>
        </div>

        <div
          className="kimi-ticket-perforation"
          aria-hidden="true"
        />
      </div>

      <div
        className="kimi-ticket-back"
        aria-hidden="true"
      >
        BMS / 26
      </div>

      <span className="kimi-scene-caption">
        MOVE CURSOR TO EXPLORE
      </span>
    </div>
  );
}

// --------------------------------------------------
// Film card
// --------------------------------------------------

function FilmCard({ film, index }) {
  return (
    <Link
      className="kimi-film-card"
      to={filmLink(film)}
      aria-label={`View ${film.title}`}
    >
      <div className="kimi-film-image">
        <Poster movie={film} />

        <span className="kimi-film-number">
          {String(index + 1).padStart(2, "0")}
        </span>

        <span className="kimi-film-open">
          <ArrowUpRight size={19} />
        </span>
      </div>

      <div className="kimi-film-details">
        <h3>{film.title}</h3>

        <p>{genreText(film)}</p>

        <span>
          <Clock3 size={12} />
          {dateText(film.nextShow?.startTime)}
        </span>
      </div>
    </Link>
  );
}

// ==================================================
// HOME PAGE
// ==================================================

export default function Home() {
  const [shows, setShows] = useState([]);
  const [comingSoon, setComingSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [active, setActive] = useState(0);

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");

  const [trailer, setTrailer] = useState(null);

  const heroInner = useRef(null);
  const showcase = useRef(null);
  const rail = useRef(null);

  const reduce = useReducedMotion();

  // --------------------------------------------------
  // Load real BookMySeat data
  // --------------------------------------------------

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    async function fetchFilms() {
      const responses = await Promise.allSettled([
        axios.get(`${API_URL}/api/shows`, {
          params: { status: "SCHEDULED" },
          signal: controller.signal,
        }),

        axios.get(`${API_URL}/api/movies`, {
          params: { status: "COMING_SOON" },
          signal: controller.signal,
        }),
      ]);

      if (!alive) return;

      const [showResponse, futureResponse] = responses;

      if (showResponse.status === "fulfilled") {
        setShows(
          Array.isArray(showResponse.value.data?.shows)
            ? showResponse.value.data.shows
            : []
        );
      } else {
        setError(true);
      }

      if (futureResponse.status === "fulfilled") {
        setComingSoon(
          Array.isArray(futureResponse.value.data?.movies)
            ? futureResponse.value.data.movies
            : []
        );
      }

      setLoading(false);
    }

    fetchFilms();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  // --------------------------------------------------
  // Active upcoming screenings
  // --------------------------------------------------

  const films = useMemo(() => {
    const seen = new Map();

    shows
      .filter(
        (show) =>
          show?.movie?._id &&
          show?.startTime &&
          new Date(show.startTime).getTime() >
            Date.now()
      )
      .sort(
        (a, b) =>
          new Date(a.startTime) -
          new Date(b.startTime)
      )
      .forEach((show) => {
        const id = String(show.movie._id);

        if (!seen.has(id)) {
          seen.set(id, {
            ...show.movie,
            nextShow: show,
          });
        }
      });

    return Array.from(seen.values());
  }, [shows]);

  const cities = useMemo(
    () =>
      [
        ...new Set(
          shows
            .map((show) => show?.theatre?.city)
            .filter(Boolean)
        ),
      ].sort(),
    [shows]
  );

  const featured = films.length
    ? films[active % films.length]
    : null;

  // --------------------------------------------------
  // Search by movie or city
  // --------------------------------------------------

  const shown = films.filter((film) => {
    if (
      search &&
      !film.title
        .toLowerCase()
        .includes(search.toLowerCase().trim())
    ) {
      return false;
    }

    if (!city) return true;

    return shows.some(
      (show) =>
        String(show?.movie?._id) ===
          String(film._id) &&
        show?.theatre?.city === city &&
        new Date(show.startTime).getTime() >
          Date.now()
    );
  });

  const soon = comingSoon
    .filter(
      (movie) =>
        movie?._id &&
        !films.some(
          (film) =>
            String(film._id) ===
            String(movie._id)
        )
    )
    .slice(0, 4);

  // --------------------------------------------------
  // KIMI-inspired sticky section recession
  // --------------------------------------------------

  useEffect(() => {
    if (reduce) return;

    let frame = 0;

    const update = () => {
      if (
        !showcase.current ||
        !heroInner.current
      ) {
        return;
      }

      const top =
        showcase.current.getBoundingClientRect().top;

      const progress = clamp(
        1 - top / Math.max(window.innerHeight, 1),
        0,
        1
      );

      if (window.innerWidth > 767) {
        heroInner.current.style.transform =
          progress > 0
            ? `scale(${1 - progress * 0.065})`
            : "";

        heroInner.current.style.filter =
          progress > 0
            ? `brightness(${1 - progress * 0.48})`
            : "";
      } else {
        heroInner.current.style.transform = "";
        heroInner.current.style.filter = "";
      }

      frame = 0;
    };

    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(update);
      }
    };

    update();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener(
        "scroll",
        onScroll
      );

      window.removeEventListener(
        "resize",
        onScroll
      );

      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [reduce]);

  // --------------------------------------------------
  // Trailer Escape handling
  // --------------------------------------------------

  useEffect(() => {
    if (!trailer) return undefined;

    const close = (event) => {
      if (event.key === "Escape") {
        setTrailer(null);
      }
    };

    window.addEventListener("keydown", close);

    return () =>
      window.removeEventListener(
        "keydown",
        close
      );
  }, [trailer]);

  // --------------------------------------------------
  // Navigation actions
  // --------------------------------------------------

  function move(direction) {
    setActive(
      (index) =>
        (index + direction + films.length) %
        films.length
    );
  }

  function scrollFilms(event) {
    event?.preventDefault();

    showcase.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
    });
  }

  return (
    <main
      className="kimi-home"
      data-testid="home-page"
    >
      {/* ============================================
          HERO
      ============================================ */}

      <section
        className="kimi-hero"
        data-testid="hero-section"
      >
        <div
          className="kimi-hero-inner"
          ref={heroInner}
        >
          <div
            className="kimi-hero-grid"
            aria-hidden="true"
          />

          <div className="kimi-hero-photo">
            <img
              src={CINEMA_PHOTO}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display =
                  "none";
              }}
            />
          </div>

          <div className="kimi-hero-content kimi-wrap">
            <div className="kimi-hero-topline">
              <span>
                BOOKMYSEAT / CINEMA CULTURE
              </span>

              <span>
                DISCOVER. BOOK. WATCH.
              </span>
            </div>

            <motion.div
              className="kimi-hero-main"
              initial={
                reduce
                  ? false
                  : { opacity: 0, y: 36 }
              }
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.75,
              }}
            >
              <div className="kimi-hero-copy">
                <p className="kimi-code">
                  EXPERIENCE / 001
                </p>

                <h1>
                  GOOD FILMS.
                  <br />
                  <span>GREAT SEATS.</span>
                  <br />
                  YOUR NIGHT.
                </h1>

                <p className="kimi-hero-intro">
                  Find what's actually playing,
                  choose a cinema and book the
                  seats you want. All in one
                  place.
                </p>

                <div className="kimi-hero-actions">
                  <Link
                    to="/movies"
                    className="kimi-solid-button"
                  >
                    Explore films
                    <ArrowUpRight size={19} />
                  </Link>

                  <Link
                    to="/cinemas"
                    className="kimi-plain-button"
                  >
                    Find a cinema
                    <ArrowRight size={18} />
                  </Link>

                  {youtubeLink(
                    featured?.trailer
                  ) && (
                    <button
                      type="button"
                      className="kimi-plain-button"
                      onClick={() =>
                        setTrailer(
                          youtubeLink(
                            featured.trailer
                          )
                        )
                      }
                    >
                      <Play size={17} />
                      Watch trailer
                    </button>
                  )}
                </div>
              </div>

              <HeroTicket film={featured} />
            </motion.div>

            <div className="kimi-hero-foot">
              <button
                type="button"
                onClick={scrollFilms}
              >
                SCROLL TO DISCOVER
                <ArrowDownRight size={16} />
              </button>

              <span>
                {films.length
                  ? `${String(
                      active + 1
                    ).padStart(2, "0")} / ${String(
                      films.length
                    ).padStart(2, "0")}`
                  : "FILM / CULTURE"}
              </span>

              <div className="kimi-arrows">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  disabled={films.length < 2}
                  aria-label="Previous featured film"
                >
                  <ChevronLeft size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => move(1)}
                  disabled={films.length < 2}
                  aria-label="Next featured film"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          NOW SHOWING
      ============================================ */}

      <section
        className="kimi-showcase"
        ref={showcase}
        id="now-showing"
        data-testid="now-showing-section"
      >
        <div
          className="kimi-checker"
          aria-hidden="true"
        />

        <div className="kimi-wrap kimi-showcase-content">
          <Reveal className="kimi-section-heading">
            <span className="kimi-code">
              THE LINEUP / LIVE SHOWTIMES
            </span>

            <h2>
              NOW <i>SHOWING.</i>
            </h2>

            <p>
              Films with scheduled screenings
              at BookMySeat cinemas.
            </p>
          </Reveal>

          <div className="kimi-toolbar">
            <div className="kimi-field">
              <Search size={17} />

              <input
                aria-label="Search films"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="FIND A FILM"
              />
            </div>

            <div className="kimi-field">
              <MapPin size={17} />

              <select
                aria-label="Filter by city"
                value={city}
                onChange={(event) =>
                  setCity(event.target.value)
                }
              >
                <option value="">
                  ALL CITIES
                </option>

                {cities.map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="kimi-toolbar-arrows">
              <button
                type="button"
                aria-label="Scroll films left"
                onClick={() =>
                  rail.current?.scrollBy({
                    left: -480,
                    behavior: reduce
                      ? "auto"
                      : "smooth",
                  })
                }
              >
                <ChevronLeft />
              </button>

              <button
                type="button"
                aria-label="Scroll films right"
                onClick={() =>
                  rail.current?.scrollBy({
                    left: 480,
                    behavior: reduce
                      ? "auto"
                      : "smooth",
                  })
                }
              >
                <ChevronRight />
              </button>
            </div>
          </div>

          {loading ? (
            <div
              className="kimi-loading"
              role="status"
            >
              Loading live cinema schedules…
            </div>
          ) : error ? (
            <div
              className="kimi-loading"
              role="alert"
            >
              We couldn't load showtimes right now.

              <button
                type="button"
                onClick={() =>
                  window.location.reload()
                }
              >
                Retry
              </button>
            </div>
          ) : shown.length ? (
            <div
              className="kimi-film-rail"
              ref={rail}
            >
              {shown.map((film, index) => (
                <FilmCard
                  film={film}
                  key={film._id}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="kimi-loading">
              No screenings match your search.

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCity("");
                }}
              >
                Clear filters
              </button>
            </div>
          )}

          <div className="kimi-showcase-bottom">
            <span>
              ONLY REAL SCHEDULED SCREENINGS
            </span>

            <Link to="/movies">
              ALL FILMS
              <ArrowUpRight size={19} />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          BOOKING JOURNEY
      ============================================ */}

      <section className="kimi-journey">
        <div className="kimi-wrap">
          <Reveal className="kimi-journey-heading">
            <span className="kimi-code">
              HOW IT WORKS / 003 STEPS
            </span>

            <h2>
              YOUR SEAT.
              <br />
              YOUR <span>CALL.</span>
            </h2>
          </Reveal>

          <div className="kimi-journey-list">
            <Reveal className="kimi-journey-row">
              <span>01</span>

              <div>
                <h3>CHOOSE A CINEMA</h3>

                <p>
                  See the films and screenings
                  at your preferred location.
                </p>
              </div>

              <Link
                to="/cinemas"
                aria-label="Explore cinemas"
              >
                <ArrowUpRight />
              </Link>
            </Reveal>

            <Reveal
              className="kimi-journey-row"
              delay={0.07}
            >
              <span>02</span>

              <div>
                <h3>FIND A SHOWTIME</h3>

                <p>
                  Pick the film, date and
                  screening that suit you.
                </p>
              </div>

              <Link
                to="/movies"
                aria-label="Explore movies and showtimes"
              >
                <ArrowUpRight />
              </Link>
            </Reveal>

            <Reveal
              className="kimi-journey-row"
              delay={0.14}
            >
              <span>03</span>

              <div>
                <h3>MAKE IT YOUR NIGHT</h3>

                <p>
                  Choose your seats, complete
                  checkout and access your ticket.
                </p>
              </div>

              <Link
                to="/my-bookings"
                aria-label="View my bookings"
              >
                <ArrowUpRight />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================================
          CINEMA EDITORIAL
      ============================================ */}

      <section className="kimi-editorial">
        <div className="kimi-editorial-image">
          <img
            src={CINEMA_PHOTO}
            loading="lazy"
            alt="Movie theatre auditorium"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";
            }}
          />
        </div>

        <Reveal className="kimi-editorial-text">
          <span className="kimi-code">
            THE BIG SCREEN / YOUR WAY
          </span>

          <h2>
            MORE THAN
            <br />
            A SCREENING.
          </h2>

          <p>
            Explore cinemas, discover the next
            film worth seeing and make room
            for the moments that stay with you.
          </p>

          <Link
            to="/cinemas"
            className="kimi-outline-button"
          >
            EXPLORE CINEMAS
            <ArrowUpRight size={19} />
          </Link>
        </Reveal>
      </section>

      {/* ============================================
          COMING SOON
      ============================================ */}

      {soon.length > 0 && (
        <section className="kimi-coming">
          <div className="kimi-wrap">
            <Reveal className="kimi-coming-head">
              <span className="kimi-code">
                ON THE HORIZON / COMING SOON
              </span>

              <h2>UP NEXT.</h2>
            </Reveal>

            <div className="kimi-coming-grid">
              {soon.map((film, index) => (
                <Link
                  to={`/movie/${encodeURIComponent(
                    film._id
                  )}`}
                  className="kimi-coming-card"
                  key={film._id}
                >
                  <Poster movie={film} />

                  <span>
                    {String(index + 1).padStart(
                      2,
                      "0"
                    )}{" "}
                    / {film.title}

                    <ArrowUpRight size={17} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================
          AI DISCOVERY FINALE
      ============================================ */}

      <section className="kimi-finale">
        <div className="kimi-wrap kimi-finale-inner">
          <div>
            <span className="kimi-code">
              BOOKMYSEAT / DISCOVER
            </span>

            <h2>
              THE NEXT
              <br />
              <em>GOOD STORY.</em>
            </h2>

            <p>
              Not sure what to watch? Let the
              movie assistant help you explore
              what's available.
            </p>

            <Link
              className="kimi-final-cta"
              to="/ai-search"
            >
              DISCOVER WITH AI
              <ArrowUpRight size={20} />
            </Link>
          </div>

          <div
            className="kimi-finale-decor"
            aria-hidden="true"
          >
            <Ticket strokeWidth={0.75} />
          </div>
        </div>
      </section>

      {/* ============================================
          FOOTER
      ============================================ */}

      <footer className="kimi-footer">
        <div className="kimi-wrap">
          <strong>
            BOOKMYSEAT<span>®</span>
          </strong>

          <nav aria-label="Footer navigation">
            <Link to="/movies">FILMS</Link>
            <Link to="/cinemas">CINEMAS</Link>
            <Link to="/ai-search">
              DISCOVER
            </Link>
            <Link to="/my-bookings">
              MY BOOKINGS
            </Link>
            <Link to="/contact">CONTACT</Link>
          </nav>

          <div className="kimi-footer-meta">
            <span>
              © {new Date().getFullYear()} BOOKMYSEAT
            </span>

            <span>THE CINEMA IS CALLING.</span>
          </div>
        </div>
      </footer>

      {/* ============================================
          TRAILER MODAL
      ============================================ */}

      {trailer && (
        <div
          className="kimi-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Film trailer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setTrailer(null);
            }
          }}
        >
          <div className="kimi-modal-inner">
            <button
              type="button"
              onClick={() => setTrailer(null)}
              aria-label="Close trailer"
            >
              <X />
            </button>

            <iframe
              title="Movie trailer"
              src={trailer}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </main>
  );
}
