import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Clock,
  MapPin,
  Search,
  Star,
  Ticket,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import axios from "axios";
import toast from "react-hot-toast";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

// =====================================================
// HELPERS
// =====================================================

const getGenres = (
  movie
) =>
  String(
    movie.genre ||
      ""
  )
    .split(",")
    .map(
      (genre) =>
        genre.trim()
    )
    .filter(Boolean);

const formatTime = (
  value
) =>
  new Intl.DateTimeFormat(
    "en-IN",
    {
      hour:
        "numeric",

      minute:
        "2-digit",
    }
  ).format(
    new Date(value)
  );

// =====================================================
// PAGE
// =====================================================

const Movies = () => {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] =
    useSearchParams();

  const [
    movies,
    setMovies,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState("");

  const [
    selectedGenre,
    setSelectedGenre,
  ] =
    useState("All");

  const [
    theatreName,
    setTheatreName,
  ] =
    useState("");

  const [
    city,
    setCity,
  ] =
    useState("");

  // ===================================================
  // SELECTED CINEMA
  // ===================================================

  const theatreFromUrl =
    searchParams.get(
      "theatre"
    );

  const selectedTheatre =
    theatreFromUrl ||
    localStorage.getItem(
      "bookmyseat_theatre"
    );

  // ===================================================
  // CINEMA-FIRST RULE
  // ===================================================

  useEffect(() => {
    if (
      !selectedTheatre
    ) {
      navigate(
        "/cinemas",
        {
          replace: true,
        }
      );
    }
  }, [
    selectedTheatre,
    navigate,
  ]);

  // ===================================================
  // LOAD REAL MOVIES AT CINEMA
  // ===================================================

  useEffect(() => {
    const loadMovies =
      async () => {
        if (
          !selectedTheatre
        ) {
          return;
        }

        setLoading(
          true
        );

        try {
          const response =
            await axios.get(
              `${API_URL}/api/shows`,
              {
                params: {
                  theatre:
                    selectedTheatre,

                  status:
                    "SCHEDULED",
                },
              }
            );

          const now =
            new Date();

          const shows =
            (
              response.data
                ?.shows ||
              []
            )
              .filter(
                (show) =>
                  show.startTime &&
                  new Date(
                    show.startTime
                  ) > now
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  new Date(
                    a.startTime
                  ) -
                  new Date(
                    b.startTime
                  )
              );

          // -------------------------------------------
          // SAME MOVIE MAY HAVE MANY SHOWS.
          //
          // Display the movie once.
          // -------------------------------------------

          const movieMap =
            new Map();

          shows.forEach(
            (show) => {
              const movie =
                show.movie;

              if (
                !movie?._id
              ) {
                return;
              }

              if (
                !movieMap.has(
                  movie._id
                )
              ) {
                movieMap.set(
                  movie._id,
                  {
                    ...movie,

                    availableShows:
                      [],
                  }
                );
              }

              movieMap
                .get(
                  movie._id
                )
                .availableShows.push(
                  show
                );
            }
          );

          setMovies(
            Array.from(
              movieMap.values()
            )
          );

          const theatre =
            shows[0]
              ?.theatre;

          const resolvedName =
            theatre?.name ||
            localStorage.getItem(
              "bookmyseat_theatre_name"
            ) ||
            "Selected Cinema";

          const resolvedCity =
            theatre?.city ||
            localStorage.getItem(
              "bookmyseat_city"
            ) ||
            "";

          setTheatreName(
            resolvedName
          );

          setCity(
            resolvedCity
          );

          localStorage.setItem(
            "bookmyseat_theatre",
            selectedTheatre
          );

          localStorage.setItem(
            "bookmyseat_theatre_name",
            resolvedName
          );

          if (
            resolvedCity
          ) {
            localStorage.setItem(
              "bookmyseat_city",
              resolvedCity
            );
          }
        } catch (error) {
          console.error(
            "Load cinema movies:",
            error
          );

          toast.error(
            error.response
              ?.data
              ?.message ||
              "Could not load movies for this cinema."
          );

          setMovies(
            []
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    loadMovies();
  }, [
    selectedTheatre,
  ]);

  // ===================================================
  // GENRES
  // ===================================================

  const genres =
    useMemo(() => {
      return [
        "All",

        ...new Set(
          movies.flatMap(
            getGenres
          )
        ),
      ];
    }, [movies]);

  // ===================================================
  // FILTERING
  // ===================================================

  const filteredMovies =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      return movies.filter(
        (movie) => {
          const titleMatch =
            !query ||
            movie.title
              ?.toLowerCase()
              .includes(
                query
              );

          const genreMatch =
            selectedGenre ===
              "All" ||
            getGenres(
              movie
            ).includes(
              selectedGenre
            );

          return (
            titleMatch &&
            genreMatch
          );
        }
      );
    }, [
      movies,
      searchQuery,
      selectedGenre,
    ]);

  // ===================================================
  // OPEN MOVIE
  // ===================================================

  const openMovie =
    (movie) => {
      navigate(
        `/movie/${movie._id}?theatre=${selectedTheatre}`
      );
    };

  // ===================================================
  // PAGE
  // ===================================================

  return (
    <div className="min-h-screen pb-20 pt-24">

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ===========================================
            CINEMA
        ============================================ */}

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

          <div>

            <p className="text-sm text-zinc-500">
              Movies playing at
            </p>

            <div className="mt-2 flex items-center gap-2">

              <MapPin className="h-5 w-5 text-red-500" />

              <h1 className="text-3xl font-bold">
                {theatreName ||
                  "Selected Cinema"}
              </h1>

            </div>

            {city && (
              <p className="mt-2 text-sm text-zinc-500">
                {city}
              </p>
            )}

          </div>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/cinemas"
              )
            }
            className="rounded-lg border border-white/10 px-4 py-2 text-sm"
          >
            Change Cinema
          </button>

        </div>

        {/* ===========================================
            FILTERS
        ============================================ */}

        <div className="mt-8 flex flex-col gap-4 md:flex-row">

          <div className="relative max-w-md flex-1">

            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />

            <input
              type="text"
              value={
                searchQuery
              }
              onChange={(
                event
              ) =>
                setSearchQuery(
                  event.target
                    .value
                )
              }
              placeholder="Search movies..."
              className="w-full rounded-lg border border-white/10 bg-zinc-900 py-3 pl-10 pr-4 outline-none focus:border-red-500"
            />

          </div>

          <div className="flex flex-wrap gap-2">

            {genres.map(
              (genre) => (
                <button
                  key={
                    genre
                  }
                  type="button"
                  onClick={() =>
                    setSelectedGenre(
                      genre
                    )
                  }
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    selectedGenre ===
                    genre
                      ? "border-red-500 bg-red-600 text-white"
                      : "border-white/10 text-zinc-400"
                  }`}
                >
                  {
                    genre
                  }
                </button>
              )
            )}

          </div>

        </div>

        {/* ===========================================
            LOADING
        ============================================ */}

        {loading && (
          <div className="py-24 text-center text-zinc-500">
            Loading cinema schedule...
          </div>
        )}

        {/* ===========================================
            MOVIES
        ============================================ */}

        {!loading &&
          filteredMovies.length >
            0 && (
            <>

              <div className="mt-10 flex items-end justify-between">

                <div>

                  <h2 className="text-2xl font-bold">
                    Available Movies
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Select a movie to view dates and showtimes.
                  </p>

                </div>

                <p className="text-sm text-zinc-500">
                  {
                    filteredMovies.length
                  }{" "}
                  movie
                  {filteredMovies.length ===
                  1
                    ? ""
                    : "s"}
                </p>

              </div>

              <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5">

                {filteredMovies.map(
                  (movie) => {
                    const nextShow =
                      movie.availableShows
                        ?.[0];

                    return (
                      <button
                        key={
                          movie._id
                        }
                        type="button"
                        onClick={() =>
                          openMovie(
                            movie
                          )
                        }
                        className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900 text-left"
                      >

                        {/* POSTER */}

                        <div className="aspect-[2/3] overflow-hidden bg-zinc-800">

                          {movie.poster ? (
                            <img
                              src={
                                movie.poster
                              }
                              alt={
                                movie.title
                              }
                              loading="lazy"
                              onError={(
                                event
                              ) => {
                                event.currentTarget.onerror =
                                  null;

                                event.currentTarget.src =
                                  `https://placehold.co/600x900/111111/ffffff?text=${encodeURIComponent(
                                    movie.title
                                  )}`;
                              }}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-zinc-600">
                              No Poster
                            </div>
                          )}

                        </div>

                        {/* INFO */}

                        <div className="p-4">

                          <h3 className="line-clamp-1 font-semibold">
                            {
                              movie.title
                            }
                          </h3>

                          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">

                            <div className="flex items-center gap-1">

                              <Star className="h-3.5 w-3.5 text-yellow-500" />

                              <span>
                                {movie.avgRating ||
                                  "—"}
                              </span>

                            </div>

                            <div className="flex items-center gap-1">

                              <Clock className="h-3.5 w-3.5" />

                              <span>
                                {movie.duration ||
                                  "—"}
                              </span>

                            </div>

                          </div>

                          <div className="mt-4">

                            <p className="text-xs text-green-400">
                              {
                                movie.availableShows
                                  .length
                              }{" "}
                              upcoming show
                              {movie.availableShows
                                .length ===
                              1
                                ? ""
                                : "s"}
                            </p>

                            {nextShow?.startTime && (
                              <p className="mt-1 text-xs text-zinc-600">
                                Next:{" "}
                                {formatTime(
                                  nextShow.startTime
                                )}
                              </p>
                            )}

                          </div>

                          <div className="mt-4 flex items-center justify-center rounded-lg bg-red-600 py-2.5 text-sm font-semibold">

                            <Ticket className="mr-2 h-4 w-4" />

                            View Shows

                          </div>

                        </div>

                      </button>
                    );
                  }
                )}

              </div>

            </>
          )}

        {/* ===========================================
            EMPTY
        ============================================ */}

        {!loading &&
          filteredMovies.length ===
            0 && (
            <div className="mt-10 rounded-xl border border-white/10 py-20 text-center">

              <Ticket className="mx-auto h-10 w-10 text-zinc-700" />

              <h2 className="mt-4 text-xl font-semibold">
                No movies scheduled
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                This cinema currently has no upcoming shows matching your filters.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/cinemas"
                  )
                }
                className="mt-6 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold"
              >
                Choose Another Cinema
              </button>

            </div>
          )}

      </div>

    </div>
  );
};

export default Movies;