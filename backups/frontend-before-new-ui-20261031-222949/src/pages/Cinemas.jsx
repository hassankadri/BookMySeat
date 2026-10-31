
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { flushSync } from "react-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Film,
  Clapperboard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageShell from "../components/ui/PageShell";

// =====================================================
// BACKEND CONNECTION
// =====================================================

const theatreEndpoints = () => {
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
        const base = String(root)
          .trim()
          .replace(/\/+$/, "");

        return /\/api$/i.test(base)
          ? `${base}/theatres`
          : `${base}/api/theatres`;
      })
    ),
  ];
};

// =====================================================
// CINEMA DESTINATIONS
// =====================================================
// These IDs are from bookmyseat_db.
// Live API theatre records are preferred.
// The IDs remain as fallbacks for this database.
// =====================================================

const DESTINATIONS = [
  {
    key: "lower-parel",
    slug: "grand-galleria-lower-parel-mumbai",
    theatreId: "6ace39936b6e073bf1dedef4",
    name: "Grand Galleria Mall",
    area: "Lower Parel",
    city: "Mumbai",
    address: "Senapati Bapat Marg, Lower Parel",
    photo: "/images/cinemas/lower-parel.jpg",
    remote:
      "https://images.pexels.com/photos/7081167/pexels-photo-7081167.jpeg?auto=compress&cs=tinysrgb&w=1600",
    description:
      "A good film. An evening in the heart of the city.",
  },
  {
    key: "kurla",
    slug: "phoenix-marketcity-kurla-mumbai",
    theatreId: "6ace39936b6e073bf1dedf20",
    name: "Phoenix Marketcity",
    area: "Kurla West",
    city: "Mumbai",
    address: "LBS Marg, Kurla West",
    photo: "/images/cinemas/kurla.jpg",
    remote:
      "https://images.pexels.com/photos/8261819/pexels-photo-8261819.jpeg?auto=compress&cs=tinysrgb&w=1600",
    description:
      "Make a night of it, from first frame to final credits.",
  },
  {
    key: "malad",
    slug: "inorbit-mall-malad-mumbai",
    theatreId: "6ace39936b6e073bf1dedf4c",
    name: "Inorbit Mall",
    area: "Malad West",
    city: "Mumbai",
    address: "Link Road, Malad West",
    photo: "/images/cinemas/malad.jpg",
    remote:
      "https://images.pexels.com/photos/7991139/pexels-photo-7991139.jpeg?auto=compress&cs=tinysrgb&w=1600",
    description:
      "Your next big-screen escape, closer to home.",
  },
  {
    key: "ghatkopar",
    slug: "r-city-mall-ghatkopar-mumbai",
    theatreId: "6ace39936b6e073bf1dedf78",
    name: "R City Mall",
    area: "Ghatkopar West",
    city: "Mumbai",
    address: "LBS Marg, Ghatkopar West",
    photo: "/images/cinemas/ghatkopar.jpg",
    remote:
      "https://images.pexels.com/photos/7991381/pexels-photo-7991381.jpeg?auto=compress&cs=tinysrgb&w=1600",
    description:
      "A little more cinema in your everyday.",
  },
  {
    key: "thane",
    slug: "viviana-mall-thane",
    theatreId: "6ace39936b6e073bf1dedfa4",
    name: "Viviana Mall",
    area: "Thane",
    city: "Thane",
    address: "Eastern Express Highway, Thane",
    photo: "/images/cinemas/thane.jpg",
    remote:
      "https://images.pexels.com/photos/32716872/pexels-photo-32716872.jpeg?auto=compress&cs=tinysrgb&w=1600",
    description:
      "The stories you came for, on a much bigger screen.",
  },
];

// =====================================================
// HELPERS
// =====================================================

const norm = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const theatreFor = (destination, theatres) =>
  theatres.find(
    (venue) =>
      venue.slug === destination.slug
  ) ||
  theatres.find(
    (venue) =>
      norm(venue.name) === norm(destination.name) &&
      norm(venue.city) === norm(destination.city)
  );

// =====================================================
// CINEMA PHOTOGRAPH
// =====================================================

function VenuePhoto({
  destination,
  className = "",
  priority = false,
}) {
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [destination.key]);

  const source = [
    destination.photo,
    destination.remote,
  ][sourceIndex];

  return (
    <div
      className={`relative overflow-hidden bg-[#141418] ${className}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 65% 25%,rgba(215,25,53,.24),transparent 53%),linear-gradient(125deg,#25252b,#0a0a0d 70%)",
        }}
      />

      {sourceIndex < 2 && (
        <img
          key={`${destination.key}-${sourceIndex}`}
          src={source}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() =>
            setSourceIndex(
              (index) => index + 1
            )
          }
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            filter:
              "brightness(1.08) saturate(1.17)",
          }}
        />
      )}
    </div>
  );
}

// =====================================================
// CINEMAS PAGE
// BMS_CINEMA_SLIDE_V1
// =====================================================

export default function Cinemas() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const [selected, setSelected] = useState(0);
  const [city, setCity] = useState("All");
  const [theatres, setTheatres] = useState([]);

  // ===================================================
  // LOAD LIVE THEATRE RECORDS
  // ===================================================

  useEffect(() => {
    const controller = new AbortController();

    const loadTheatres = async () => {
      for (const endpoint of theatreEndpoints()) {
        try {
          const response = await axios.get(endpoint, {
            signal: controller.signal,
            timeout: 7000,
          });

          const records = Array.isArray(response.data)
            ? response.data
            : response.data?.theatres;

          if (!Array.isArray(records)) {
            continue;
          }

          const activeRecords = records.filter(
            (venue) => venue.isActive !== false
          );

          if (
            DESTINATIONS.some(
              (place) =>
                theatreFor(place, activeRecords)
            )
          ) {
            if (!controller.signal.aborted) {
              setTheatres(activeRecords);
            }

            return;
          }
        } catch (error) {
          if (controller.signal.aborted) return;

          console.warn(
            "Could not read cinema directory:",
            endpoint,
            error
          );
        }
      }
    };

    loadTheatres();

    return () => controller.abort();
  }, []);

  // ===================================================
  // CITY FILTER
  // ===================================================

  const filtered = useMemo(
    () =>
      DESTINATIONS.filter(
        (item) =>
          city === "All" || item.city === city
      ),
    [city]
  );

  const active = DESTINATIONS[selected];

  const choose = (index) => {
    setSelected(index);
  };

  const chooseCity = (nextCity) => {
    setCity(nextCity);

    if (
      nextCity !== "All" &&
      DESTINATIONS[selected].city !== nextCity
    ) {
      setSelected(
        DESTINATIONS.findIndex(
          (item) => item.city === nextCity
        )
      );
    }
  };

  // ===================================================
  // SMOOTH CINEMA -> MOVIES SLIDE
  // ===================================================
  //
  // No global AnimatePresence is added.
  //
  // Chrome and other supporting browsers animate
  // the previous and next page snapshots.
  //
  // Unsupported browsers navigate normally.
  // Reduced-motion preference is respected.
  //
  // ===================================================

  const slideToMovies = (url) => {
    if (
      reducedMotion ||
      typeof document.startViewTransition !== "function"
    ) {
      navigate(url);
      return;
    }

    const transitionStyles =
      document.createElement("style");

    transitionStyles.textContent = `
      @keyframes bmsCinemaOut {
        from {
          opacity: 1;
          transform: translateX(0);
        }

        to {
          opacity: 0;
          transform: translateX(-48px);
        }
      }

      @keyframes bmsMoviesIn {
        from {
          opacity: 0;
          transform: translateX(52px);
        }

        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      ::view-transition-old(root) {
        animation:
          340ms cubic-bezier(.22, 1, .36, 1)
          both bmsCinemaOut;
      }

      ::view-transition-new(root) {
        animation:
          460ms cubic-bezier(.22, 1, .36, 1)
          both bmsMoviesIn;
      }
    `;

    document.head.appendChild(transitionStyles);

    try {
      const transition =
        document.startViewTransition(() => {
          flushSync(() => navigate(url));
        });

      transition.finished.then(
        () => transitionStyles.remove(),
        () => transitionStyles.remove()
      );
    } catch (error) {
      transitionStyles.remove();
      navigate(url);
    }
  };

  // ===================================================
  // OPEN SELECTED CINEMA
  // ===================================================

  const openCinema = (destination) => {
    const theatre = theatreFor(
      destination,
      theatres
    );

    const theatreId = String(
      theatre?._id || destination.theatreId
    );

    const theatreName =
      theatre?.name || destination.name;

    const theatreCity =
      theatre?.city || destination.city;

    try {
      localStorage.setItem(
        "bookmyseat_theatre",
        theatreId
      );

      localStorage.setItem(
        "bookmyseat_theatre_name",
        theatreName
      );

      localStorage.setItem(
        "bookmyseat_city",
        theatreCity
      );
    } catch {
      // The URL still identifies the cinema.
    }

    const query = new URLSearchParams({
      theatre: theatreId,
      city: theatreCity,
    });

    slideToMovies(
      `/movies?${query.toString()}`
    );
  };

  // ===================================================
  // ORIGINAL DIRECTORY DESIGN
  // ===================================================

  return (
    <PageShell glow="left" testId="cinemas-page">
      <main className="relative mx-auto max-w-[1480px] px-5 pb-20 pt-10 text-white md:px-10 md:pt-14">

        {/* EDITORIAL HEADING */}

        <motion.div
          initial={
            reducedMotion
              ? false
              : { opacity: 0, y: 20 }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.75,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mb-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-7 lg:mb-10 lg:flex-row lg:items-end"
        >
          <div>
            <div className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.25em] text-[#ff4968]">
              <span className="h-px w-7 bg-[#D71935]" />

              The cinema directory

              <span className="text-zinc-600">
                / 05
              </span>
            </div>

            <h1 className="cine-display text-[clamp(2.8rem,5.4vw,5.4rem)] leading-[.92] tracking-tight">
              Where to{" "}
              <span className="text-[#ff4562]">
                watch.
              </span>
            </h1>
          </div>

          <p className="max-w-[360px] text-sm leading-relaxed text-zinc-400 md:text-base">
            Five destinations across Mumbai and Thane.
            Find your area, then discover what is playing.
          </p>
        </motion.div>

        {/* LOCATION LIST AND PHOTOGRAPH */}

        <div className="grid min-h-[580px] gap-6 lg:grid-cols-[.88fr_1.12fr] lg:gap-9">

          {/* LEFT — CINEMA LIST */}

          <div className="order-2 flex min-w-0 flex-col lg:order-1">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[.22em] text-zinc-500">
                Select a destination
              </span>

              <div
                className="inline-flex gap-1 rounded-full border border-white/10 bg-white/[.03] p-1"
                aria-label="Filter by city"
              >
                {["All", "Mumbai", "Thane"].map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={city === option}
                      onClick={() =>
                        chooseCity(option)
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                        city === option
                          ? "bg-[#D71935] text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {option}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0e0e11]/75">
              {filtered.map((place) => {
                const actualIndex =
                  DESTINATIONS.findIndex(
                    (item) =>
                      item.key === place.key
                  );

                const isActive =
                  selected === actualIndex;

                return (
                  <button
                    type="button"
                    key={place.key}
                    onMouseEnter={() =>
                      choose(actualIndex)
                    }
                    onFocus={() =>
                      choose(actualIndex)
                    }
                    onClick={() =>
                      openCinema(place)
                    }
                    aria-label={`View movies at ${place.name}`}
                    className={`group relative flex w-full items-center gap-4 border-b border-white/[.08] px-4 py-4 text-left outline-none transition-colors duration-300 last:border-b-0 focus-visible:bg-white/[.08] sm:px-5 ${
                      isActive
                        ? "bg-white/[.075]"
                        : "hover:bg-white/[.035]"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="bms-selected-cinema"
                        className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full bg-[#D71935]"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 35,
                        }}
                      />
                    )}

                    <span
                      className={`w-6 shrink-0 text-xs tabular-nums ${
                        isActive
                          ? "text-[#ff526e]"
                          : "text-zinc-600"
                      }`}
                    >
                      {String(
                        actualIndex + 1
                      ).padStart(2, "0")}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3
                        className={`cine-head truncate text-lg leading-tight transition-colors sm:text-xl ${
                          isActive
                            ? "text-white"
                            : "text-zinc-300"
                        }`}
                      >
                        {place.name}
                      </h3>

                      <p className="mt-1 truncate text-xs text-zinc-500 sm:text-sm">
                        {place.area}

                        <span className="px-1 text-zinc-700">
                          /
                        </span>

                        {place.city}
                      </p>
                    </div>

                    <ArrowUpRight
                      className={`h-5 w-5 shrink-0 transition-all duration-300 ${
                        isActive
                          ? "-translate-y-0.5 translate-x-0.5 text-[#ff526e]"
                          : "text-zinc-600 group-hover:text-white"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
              <p className="text-xs leading-relaxed text-zinc-500">
                <MapPin
                  className="mr-1 inline h-3.5 w-3.5 text-[#ff526e]"
                />

                {filtered.length}{" "}
                {filtered.length === 1
                  ? "location"
                  : "locations"}{" "}
                in view
              </p>

              <button
                type="button"
                onClick={() =>
                  openCinema(active)
                }
                className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-200 transition-colors hover:text-[#ff526e]"
              >
                Films at {active.name}

                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* RIGHT — PHOTOGRAPH */}

          <div className="order-1 min-w-0 lg:order-2">
            <div className="group relative h-[390px] overflow-hidden rounded-[23px] border border-white/15 bg-[#131318] shadow-[0_30px_80px_rgba(0,0,0,.28)] md:h-[510px] lg:h-full lg:min-h-[580px]">

              <AnimatePresence
                mode="sync"
                initial={false}
              >
                <motion.div
                  key={active.key}
                  className="absolute inset-0"
                  initial={
                    reducedMotion
                      ? false
                      : {
                          opacity: 0,
                          scale: 1.035,
                        }
                  }
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  transition={{
                    duration: reducedMotion
                      ? 0
                      : 0.65,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <VenuePhoto
                    destination={active}
                    priority
                    className="h-full w-full"
                  />
                </motion.div>
              </AnimatePresence>

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />

              <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-white/85 backdrop-blur-lg md:left-7 md:top-7">
                <Film
                  size={13}
                  className="text-[#ff526e]"
                />

                Cinema destinations
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-9">
                <AnimatePresence
                  mode="wait"
                  initial={false}
                >
                  <motion.div
                    key={`${active.key}-copy`}
                    initial={
                      reducedMotion
                        ? false
                        : {
                            opacity: 0,
                            y: 16,
                          }
                    }
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 0,
                      y: -10,
                    }}
                    transition={{
                      duration: reducedMotion
                        ? 0
                        : 0.35,
                    }}
                  >
                    <div className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.22em] text-white/75">
                      <span className="h-px w-8 bg-[#ff4968]" />

                      {active.area} / {active.city}
                    </div>

                    <h2 className="cine-display max-w-[650px] text-[clamp(2.1rem,4.3vw,4.6rem)] leading-[.94] text-white">
                      {active.name}
                    </h2>

                    <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-200">
                      {active.description}
                    </p>

                    <p className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
                      <MapPin
                        size={14}
                        className="text-[#ff526e]"
                      />

                      {active.address}
                    </p>
                  </motion.div>
                </AnimatePresence>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/25 pt-5">
                  <span className="text-[10px] text-zinc-300/80">
                    Editorial photograph · Interior may differ by venue
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      openCinema(active)
                    }
                    className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ec2847] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    View films & showtimes

                    <ArrowUpRight size={17} />
                  </button>
                </div>
              </div>

              <div className="pointer-events-none absolute right-6 top-7 text-[10px] font-medium tracking-[.18em] text-white/70 md:right-8">
                {String(
                  selected + 1
                ).padStart(2, "0")}{" "}
                / 05
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <div className="mt-7 flex flex-col justify-between gap-3 border-t border-white/10 pt-5 text-xs text-zinc-500 md:flex-row md:items-center">
          <p>
            Locations are shown as a portfolio directory;
            screening availability comes from live BookMySeat listings.
          </p>

          <span className="inline-flex items-center gap-2 whitespace-nowrap text-zinc-400">
            <Clapperboard
              size={15}
              className="text-[#ff526e]"
            />

            Made for the big screen
          </span>
        </div>
      </main>
    </PageShell>
  );
}