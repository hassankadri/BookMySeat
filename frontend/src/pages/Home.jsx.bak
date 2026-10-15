import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  ArrowRight,
  Building2,
  Clock,
  Film,
  Mail,
  MapPin,
  Phone,
  Play,
  Star,
  Ticket,
} from "lucide-react";

import axios from "axios";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

// =====================================================
// HELPERS
// =====================================================

const formatShowTime = (
  value
) => {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      hour:
        "numeric",

      minute:
        "2-digit",

      day:
        "numeric",

      month:
        "short",
    }
  ).format(date);
};

const getYoutubeId = (
  url
) => {
  if (!url) {
    return null;
  }

  try {
    const parsed =
      new URL(url);

    if (
      parsed.hostname.includes(
        "youtu.be"
      )
    ) {
      return parsed.pathname
        .replace("/", "")
        .slice(0, 11);
    }

    const videoId =
      parsed.searchParams.get(
        "v"
      );

    if (videoId) {
      return videoId.slice(
        0,
        11
      );
    }

    const parts =
      parsed.pathname
        .split("/")
        .filter(Boolean);

    const embedIndex =
      parts.findIndex(
        (part) =>
          part ===
          "embed"
      );

    if (
      embedIndex !== -1 &&
      parts[
        embedIndex + 1
      ]
    ) {
      return parts[
        embedIndex + 1
      ].slice(
        0,
        11
      );
    }
  } catch {
    return null;
  }

  return null;
};

// =====================================================
// HOME
// =====================================================

const Home = () => {
  const [
    shows,
    setShows,
  ] =
    useState([]);

  const [
    comingSoon,
    setComingSoon,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  // ===================================================
  // LOAD REAL INVENTORY
  // ===================================================

  useEffect(() => {
    const loadHomeData =
      async () => {
        setLoading(
          true
        );

        try {
          const [
            showsResponse,
            comingSoonResponse,
          ] =
            await Promise.all([
              axios.get(
                `${API_URL}/api/shows`,
                {
                  params: {
                    status:
                      "SCHEDULED",
                  },
                }
              ),

              axios.get(
                `${API_URL}/api/movies`,
                {
                  params: {
                    status:
                      "COMING_SOON",
                  },
                }
              ),
            ]);

          setShows(
            showsResponse.data
              ?.shows ||
              []
          );

          setComingSoon(
            comingSoonResponse
              .data
              ?.movies ||
              []
          );
        } catch (error) {
          console.error(
            "Home data error:",
            error
          );

          setShows([]);
          setComingSoon([]);
        } finally {
          setLoading(
            false
          );
        }
      };

    loadHomeData();
  }, []);

  // ===================================================
  // NOW SHOWING
  //
  // Derived from actual future Show records.
  //
  // Same movie can have many showtimes, so we display
  // each movie once and keep its next available show.
  // ===================================================

  const nowShowing =
    useMemo(() => {
      const now =
        new Date();

      const futureShows =
        shows
          .filter(
            (show) =>
              show.movie?._id &&
              show.startTime &&
              new Date(
                show.startTime
              ) > now
          )
          .sort(
            (
              first,
              second
            ) =>
              new Date(
                first.startTime
              ) -
              new Date(
                second.startTime
              )
          );

      const map =
        new Map();

      futureShows.forEach(
        (show) => {
          const movie =
            show.movie;

          if (
            !map.has(
              movie._id
            )
          ) {
            map.set(
              movie._id,
              {
                ...movie,

                nextShow:
                  show,

                showCount:
                  1,

                theatreIds:
                  new Set(
                    show.theatre
                      ? [
                          show
                            .theatre
                            ._id,
                        ]
                      : []
                  ),
              }
            );

            return;
          }

          const existing =
            map.get(
              movie._id
            );

          existing.showCount +=
            1;

          if (
            show.theatre?._id
          ) {
            existing.theatreIds.add(
              show.theatre
                ._id
            );
          }
        }
      );

      return Array.from(
        map.values()
      )
        .map(
          (movie) => ({
            ...movie,

            theatreCount:
              movie.theatreIds
                .size,
          })
        )
        .slice(
          0,
          8
        );
    }, [shows]);

  // ===================================================
  // TRAILERS
  //
  // No fake "trending" source anymore.
  //
  // Only movies that are genuinely playing and have
  // a trailer URL are eligible.
  // ===================================================

  const trailerMovies =
    useMemo(
      () =>
        nowShowing
          .filter(
            (movie) =>
              Boolean(
                getYoutubeId(
                  movie.trailer
                )
              )
          )
          .slice(
            0,
            4
          ),
      [nowShowing]
    );

  // ===================================================
  // UI
  // ===================================================

  return (
    <div
      className="min-h-screen"
      data-testid="home-page"
    >

      {/* =============================================
          HERO
      ============================================== */}

      <section
        className="relative flex min-h-[88vh] items-center overflow-hidden"
        data-testid="hero-section"
      >

        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600)",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/90 to-zinc-950/30" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="max-w-2xl">

            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
              BookMySeat
            </p>

            <h1
              className="text-5xl font-black leading-none tracking-tighter sm:text-6xl lg:text-7xl"
              data-testid="hero-title"
            >
              Pick the cinema.

              <span className="mt-2 block text-red-500">
                We handle the rest.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-zinc-400">
              Choose your cinema, see the movies actually playing there, select a real showtime and reserve your seats.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">

              <Link
                to="/cinemas"
                className="inline-flex items-center justify-center rounded-xl bg-red-600 px-7 py-4 font-semibold text-white"
              >
                <Building2 className="mr-2 h-5 w-5" />

                Choose Cinema

                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>

              <Link
                to="/ai-search"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-7 py-4 font-semibold text-zinc-200"
              >
                Ask AI
              </Link>

            </div>

          </div>

        </div>

      </section>

      {/* =============================================
          NOW SHOWING
      ============================================== */}

      <section className="bg-zinc-950 py-20">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

            <div>

              <p className="text-sm uppercase tracking-[0.25em] text-red-500">
                Real cinema inventory
              </p>

              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
                Now Showing
              </h2>

              <p className="mt-3 max-w-xl text-zinc-500">
                These movies are taken from active future showtimes, not from a manually ranked catalogue.
              </p>

            </div>

            <Link
              to="/cinemas"
              className="inline-flex items-center text-sm font-semibold text-zinc-300"
            >
              Choose cinema

              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>

          </div>

          {loading ? (
            <div className="py-20 text-center text-zinc-500">
              Loading shows...
            </div>
          ) : nowShowing.length ===
            0 ? (
            <div className="mt-10 rounded-2xl border border-white/10 py-20 text-center">

              <Film className="mx-auto h-10 w-10 text-zinc-700" />

              <h3 className="mt-4 text-xl font-semibold">
                No upcoming shows
              </h3>

              <p className="mt-2 text-sm text-zinc-500">
                New cinema schedules will appear here automatically.
              </p>

            </div>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">

              {nowShowing.map(
                (movie) => {
                  const show =
                    movie.nextShow;

                  return (
                    <Link
                      key={
                        movie._id
                      }
                      to={
                        show
                          ?.theatre
                          ? `/movie/${movie._id}?theatre=${show.theatre._id}`
                          : `/movie/${movie._id}`
                      }
                      className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60"
                    >

                      <div className="aspect-[2/3] overflow-hidden bg-zinc-900">

                        {movie.poster ? (
                          <img
                            src={
                              movie.poster
                            }
                            alt={
                              movie.title
                            }
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">

                            <Film className="h-10 w-10 text-zinc-700" />

                          </div>
                        )}

                      </div>

                      <div className="p-4">

                        <h3 className="line-clamp-1 font-semibold">
                          {
                            movie.title
                          }
                        </h3>

                        <p className="mt-1 line-clamp-1 text-sm text-zinc-500">
                          {movie.genre ||
                            "Movie"}
                        </p>

                        <div className="mt-4 space-y-2 text-xs text-zinc-400">

                          {movie.avgRating >
                            0 && (
                            <div className="flex items-center gap-2">

                              <Star className="h-4 w-4 text-yellow-500" />

                              <span>
                                {
                                  movie.avgRating
                                }{" "}
                                / 5
                              </span>

                            </div>
                          )}

                          {show?.startTime && (
                            <div className="flex items-center gap-2">

                              <Clock className="h-4 w-4 text-red-500" />

                              <span>
                                Next show{" "}
                                {formatShowTime(
                                  show.startTime
                                )}
                              </span>

                            </div>
                          )}

                          {show?.theatre
                            ?.name && (
                            <div className="flex items-center gap-2">

                              <MapPin className="h-4 w-4 text-red-500" />

                              <span className="line-clamp-1">
                                {
                                  show
                                    .theatre
                                    .name
                                }
                              </span>

                            </div>
                          )}

                        </div>

                      </div>

                    </Link>
                  );
                }
              )}

            </div>
          )}

        </div>

      </section>

      {/* =============================================
          COMING SOON
      ============================================== */}

      {comingSoon.length >
        0 && (
        <section className="border-y border-white/5 bg-zinc-900/30 py-20">

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            <div>

              <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">
                Upcoming releases
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                Coming Soon
              </h2>

              <p className="mt-3 text-zinc-500">
                Movies that are listed but not yet part of the active cinema schedule.
              </p>

            </div>

            <div className="mt-8 flex gap-5 overflow-x-auto pb-4">

              {comingSoon.map(
                (movie) => (
                  <Link
                    key={
                      movie._id
                    }
                    to={`/movie/${movie._id}`}
                    className="w-44 shrink-0"
                  >

                    <div className="aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-zinc-900">

                      {movie.poster ? (
                        <img
                          src={
                            movie.poster
                          }
                          alt={
                            movie.title
                          }
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">

                          <Film className="h-9 w-9 text-zinc-700" />

                        </div>
                      )}

                    </div>

                    <h3 className="mt-3 line-clamp-1 text-sm font-semibold">
                      {
                        movie.title
                      }
                    </h3>

                    <p className="mt-1 text-xs text-zinc-500">
                      {movie.releaseYear ||
                        "Coming Soon"}
                    </p>

                  </Link>
                )
              )}

            </div>

          </div>

        </section>
      )}

      {/* =============================================
          TRAILERS

          Only shown when real movie records contain
          valid YouTube trailer URLs.
      ============================================== */}

      {trailerMovies.length >
        0 && (
        <section className="bg-zinc-950 py-20">

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            <h2 className="text-3xl font-bold">
              Trailers
            </h2>

            <div className="mt-8 grid gap-5 md:grid-cols-2">

              {trailerMovies.map(
                (movie) => {
                  const youtubeId =
                    getYoutubeId(
                      movie.trailer
                    );

                  return (
                    <a
                      key={
                        movie._id
                      }
                      href={
                        movie.trailer
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="group relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-zinc-900"
                    >

                      <img
                        src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                        alt={
                          movie.title
                        }
                        className="h-full w-full object-cover"
                      />

                      <div className="absolute inset-0 bg-black/30" />

                      <div className="absolute inset-0 flex items-center justify-center">

                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600">

                          <Play className="ml-1 h-7 w-7 fill-white text-white" />

                        </div>

                      </div>

                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black px-5 pb-5 pt-16">

                        <h3 className="font-semibold">
                          {
                            movie.title
                          }
                        </h3>

                      </div>

                    </a>
                  );
                }
              )}

            </div>

          </div>

        </section>
      )}

      {/* =============================================
          BOOKING FLOW
      ============================================== */}

      <section className="bg-zinc-950 py-24">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="text-center">

            <p className="text-sm uppercase tracking-[0.25em] text-red-500">
              Simple booking flow
            </p>

            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              From cinema to seat
            </h2>

          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">

            {[
              {
                icon:
                  Building2,

                title:
                  "Choose Cinema",

                description:
                  "Start with the cinema instead of browsing an unrealistic global movie catalogue.",
              },

              {
                icon:
                  Film,

                title:
                  "Pick Movie & Show",

                description:
                  "See only movies with real scheduled shows at the selected cinema.",
              },

              {
                icon:
                  Ticket,

                title:
                  "Reserve Seats",

                description:
                  "Select physical seats, lock them in real time and continue to secure checkout.",
              },
            ].map(
              (
                feature
              ) => (
                <div
                  key={
                    feature.title
                  }
                  className="rounded-2xl border border-white/10 bg-zinc-900/50 p-7"
                >

                  <feature.icon className="h-9 w-9 text-red-500" />

                  <h3 className="mt-5 text-xl font-semibold">
                    {
                      feature.title
                    }
                  </h3>

                  <p className="mt-3 leading-relaxed text-zinc-500">
                    {
                      feature.description
                    }
                  </p>

                </div>
              )
            )}

          </div>

        </div>

      </section>

      {/* =============================================
          FOOTER
      ============================================== */}

      <footer className="border-t border-white/5 bg-zinc-900/40 pb-8 pt-16">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="grid gap-12 md:grid-cols-4">

            <div>

              <div className="flex items-center gap-2">

                <Film className="h-7 w-7 text-red-600" />

                <span className="text-xl font-black">
                  BookMySeat
                </span>

              </div>

              <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                Cinema discovery, real-time seat reservation and secure movie ticket booking.
              </p>

            </div>

            <div>

              <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-300">
                Booking
              </h4>

              <div className="mt-4 space-y-3 text-sm">

                <FooterLink
                  to="/cinemas"
                  label="Cinemas"
                />

                <FooterLink
                  to="/ai-search"
                  label="AI Search"
                />

                <FooterLink
                  to="/my-bookings"
                  label="My Bookings"
                />

                <FooterLink
                  to="/favorites"
                  label="Favorites"
                />

              </div>

            </div>

            <div>

              <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-300">
                Support
              </h4>

              <div className="mt-4 space-y-3 text-sm">

                <FooterLink
                  to="/contact"
                  label="Contact"
                />

                <p className="text-zinc-500">
                  Privacy Policy
                </p>

                <p className="text-zinc-500">
                  Terms of Service
                </p>

              </div>

            </div>

            <div>

              <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-300">
                Contact
              </h4>

              <div className="mt-4 space-y-3 text-sm text-zinc-500">

                <div className="flex items-center gap-2">

                  <Mail className="h-4 w-4 text-red-500" />

                  <span>
                    support@bookmyseat.com
                  </span>

                </div>

                <div className="flex items-center gap-2">

                  <Phone className="h-4 w-4 text-red-500" />

                  <span>
                    Support available online
                  </span>

                </div>

                <div className="flex items-center gap-2">

                  <MapPin className="h-4 w-4 text-red-500" />

                  <span>
                    Mumbai, India
                  </span>

                </div>

              </div>

            </div>

          </div>

          <div className="mt-12 border-t border-white/5 pt-8 text-center text-sm text-zinc-600">
            © {new Date().getFullYear()} BookMySeat.
          </div>

        </div>

      </footer>

    </div>
  );
};

// =====================================================
// FOOTER LINK
// =====================================================

const FooterLink = ({
  to,
  label,
}) => (
  <p>
    <Link
      to={to}
      className="text-zinc-500 hover:text-white"
    >
      {label}
    </Link>
  </p>
);

export default Home;