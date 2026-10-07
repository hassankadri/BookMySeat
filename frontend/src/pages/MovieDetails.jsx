import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  Calendar,
  Clock,
  Heart,
  MapPin,
  Play,
  Star,
  Ticket,
} from "lucide-react";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useAuth,
} from "../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

// =====================================================
// HELPERS
// =====================================================

const getLocalDateKey = (
  value
) => {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
};

const formatDay = (
  value
) => {
  const date =
    new Date(
      `${value}T00:00:00`
    );

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
    }
  ).format(date);
};

const formatTime = (
  value
) =>
  new Intl.DateTimeFormat(
    "en-IN",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );

const minimumPrice = (
  show
) => {
  if (
    Array.isArray(
      show.pricing
    ) &&
    show.pricing.length
  ) {
    return Math.min(
      ...show.pricing.map(
        (item) =>
          Number(
            item.price || 0
          )
      )
    );
  }

  return Number(
    show.price || 0
  );
};

// =====================================================
// PAGE
// =====================================================

const MovieDetails =
  () => {
    const {
      id,
    } =
      useParams();

    const navigate =
      useNavigate();

    const [
      searchParams,
    ] =
      useSearchParams();

    const {
      token,
      isAuthenticated,
    } =
      useAuth();

    const [
      movie,
      setMovie,
    ] =
      useState(null);

    const [
      shows,
      setShows,
    ] =
      useState([]);

    const [
      selectedDate,
      setSelectedDate,
    ] =
      useState("");

    const [
      loading,
      setLoading,
    ] =
      useState(true);

    const [
      isFavorite,
      setIsFavorite,
    ] =
      useState(false);

    // =================================================
    // THEATRE
    // =================================================

    const theatreFromUrl =
      searchParams.get(
        "theatre"
      );

    const selectedTheatre =
      theatreFromUrl ||
      localStorage.getItem(
        "bookmyseat_theatre"
      );

    const theatreName =
      localStorage.getItem(
        "bookmyseat_theatre_name"
      );

    // =================================================
    // LOAD MOVIE + SHOWS
    // =================================================

    useEffect(() => {
      const loadPage =
        async () => {
          if (
            !selectedTheatre
          ) {
            navigate(
              "/cinemas",
              {
                replace: true,
              }
            );

            return;
          }

          setLoading(true);

          try {
            const [
              movieResponse,
              showsResponse,
            ] =
              await Promise.all([
                axios.get(
                  `${API_URL}/api/movies/${id}`
                ),

                axios.get(
                  `${API_URL}/api/shows`,
                  {
                    params: {
                      movie:
                        id,

                      theatre:
                        selectedTheatre,

                      status:
                        "SCHEDULED",
                    },
                  }
                ),
              ]);

            setMovie(
              movieResponse.data
                .movie
            );

            const now =
              new Date();

            const upcomingShows =
              (
                showsResponse.data
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
                  (a, b) =>
                    new Date(
                      a.startTime
                    ) -
                    new Date(
                      b.startTime
                    )
                );

            setShows(
              upcomingShows
            );

            if (
              upcomingShows.length >
              0
            ) {
              setSelectedDate(
                getLocalDateKey(
                  upcomingShows[0]
                    .startTime
                )
              );
            }
          } catch (error) {
            console.error(
              "Movie details error:",
              error
            );

            toast.error(
              error.response
                ?.data
                ?.message ||
                "Failed to load movie."
            );
          } finally {
            setLoading(
              false
            );
          }
        };

      loadPage();
    }, [
      id,
      selectedTheatre,
      navigate,
    ]);

    // =================================================
    // AVAILABLE DATES
    // =================================================

    const dates =
      useMemo(() => {
        return [
          ...new Set(
            shows.map(
              (show) =>
                getLocalDateKey(
                  show.startTime
                )
            )
          ),
        ].filter(Boolean);
      }, [shows]);

    // =================================================
    // SHOWS FOR SELECTED DAY
    // =================================================

    const dayShows =
      useMemo(() => {
        return shows.filter(
          (show) =>
            getLocalDateKey(
              show.startTime
            ) === selectedDate
        );
      }, [
        shows,
        selectedDate,
      ]);

    // =================================================
    // FAVORITES
    // =================================================

    const handleFavorite =
      async () => {
        if (
          !isAuthenticated
        ) {
          toast.error(
            "Please login to add favorites."
          );

          navigate(
            "/auth"
          );

          return;
        }

        try {
          const response =
            await axios.post(
              `${API_URL}/api/movies/${id}/favorite`,

              {},

              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          setIsFavorite(
            response.data
              .isFavorite
          );

          toast.success(
            response.data
              .message
          );
        } catch (error) {
          toast.error(
            "Failed to update favorites."
          );
        }
      };

    // =================================================
    // TRAILER
    // =================================================

    const handleTrailer =
      () => {
        if (
          movie?.trailer
        ) {
          window.open(
            movie.trailer,
            "_blank",
            "noopener,noreferrer"
          );
        }
      };

    // =================================================
    // SELECT REAL SHOW
    // =================================================

    const selectShow =
      (show) => {
        localStorage.setItem(
          "bookmyseat_show",
          show._id
        );

        localStorage.setItem(
          "bookmyseat_theatre",
          selectedTheatre
        );

        // Important:
        // real Show ID is now passed forward.
        navigate(
          `/booking/${id}?show=${show._id}&theatre=${selectedTheatre}`
        );
      };

    // =================================================
    // LOADING
    // =================================================

    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center pt-20">
          <p className="text-zinc-500">
            Loading movie...
          </p>
        </div>
      );
    }

    if (!movie) {
      return (
        <div className="flex min-h-screen items-center justify-center pt-20">

          <div className="text-center">

            <p className="text-xl font-semibold">
              Movie not found
            </p>

            <button
              onClick={() =>
                navigate(
                  "/movies"
                )
              }
              className="mt-5 text-red-500"
            >
              Back to Movies
            </button>

          </div>

        </div>
      );
    }

    return (
      <div className="min-h-screen pb-20 pt-24">

        {/* =============================================
            MOVIE INFORMATION
        ============================================== */}

        <section>

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            <div className="grid gap-8 md:grid-cols-[260px_1fr]">

              {/* POSTER */}

              <div>

                <img
                  src={
                    movie.poster
                  }
                  alt={
                    movie.title
                  }
                  className="w-full rounded-xl object-cover"
                />

              </div>

              {/* DETAILS */}

              <div>

                <h1 className="text-4xl font-bold sm:text-5xl">
                  {
                    movie.title
                  }
                </h1>

                <div className="mt-5 flex flex-wrap gap-5 text-sm text-zinc-400">

                  {movie.avgRating && (
                    <div className="flex items-center gap-2">

                      <Star className="h-4 w-4 text-yellow-500" />

                      {
                        movie.avgRating
                      }/5

                    </div>
                  )}

                  {movie.duration && (
                    <div className="flex items-center gap-2">

                      <Clock className="h-4 w-4" />

                      {
                        movie.duration
                      }

                    </div>
                  )}

                  {movie.releaseYear && (
                    <div className="flex items-center gap-2">

                      <Calendar className="h-4 w-4" />

                      {
                        movie.releaseYear
                      }

                    </div>
                  )}

                </div>

                {/* GENRES */}

                {movie.genre && (
                  <div className="mt-5 flex flex-wrap gap-2">

                    {String(
                      movie.genre
                    )
                      .split(",")
                      .map(
                        (
                          genre
                        ) => (
                          <span
                            key={
                              genre
                            }
                            className="rounded-md bg-white/5 px-3 py-1 text-sm text-zinc-400"
                          >
                            {genre.trim()}
                          </span>
                        )
                      )}

                  </div>
                )}

                <p className="mt-6 max-w-3xl leading-7 text-zinc-400">
                  {
                    movie.description
                  }
                </p>

                {/* CREW */}

                <div className="mt-6 flex flex-wrap gap-10">

                  {movie.director && (
                    <div>

                      <p className="text-xs text-zinc-600">
                        Director
                      </p>

                      <p className="mt-1 font-medium">
                        {
                          movie.director
                        }
                      </p>

                    </div>
                  )}

                  {movie.producer && (
                    <div>

                      <p className="text-xs text-zinc-600">
                        Producer
                      </p>

                      <p className="mt-1 font-medium">
                        {
                          movie.producer
                        }
                      </p>

                    </div>
                  )}

                </div>

                {/* MOVIE ACTIONS */}

                <div className="mt-7 flex gap-3">

                  {movie.trailer && (
                    <button
                      onClick={
                        handleTrailer
                      }
                      className="flex items-center gap-2 rounded-lg border border-white/10 px-5 py-3"
                    >

                      <Play className="h-4 w-4" />

                      Trailer

                    </button>
                  )}

                  <button
                    onClick={
                      handleFavorite
                    }
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-5 py-3"
                  >

                    <Heart
                      className={`h-4 w-4 ${
                        isFavorite
                          ? "fill-red-500 text-red-500"
                          : ""
                      }`}
                    />

                    Favorite

                  </button>

                </div>

              </div>

            </div>

          </div>

        </section>

        {/* =============================================
            SHOWTIMES
        ============================================== */}

        <section className="mt-16 border-t border-white/10 pt-10">

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            {/* THEATRE */}

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

              <div>

                <p className="text-sm text-zinc-500">
                  Showing at
                </p>

                <div className="mt-1 flex items-center gap-2">

                  <MapPin className="h-4 w-4 text-red-500" />

                  <h2 className="text-xl font-semibold">
                    {theatreName ||
                      shows[0]
                        ?.theatre
                        ?.name ||
                      "Selected Cinema"}
                  </h2>

                </div>

              </div>

              <button
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

            {/* NO SHOWS */}

            {shows.length ===
            0 ? (
              <div className="mt-8 rounded-xl border border-white/10 p-10 text-center">

                <Ticket className="mx-auto h-9 w-9 text-zinc-700" />

                <h3 className="mt-4 text-lg font-semibold">
                  No upcoming shows
                </h3>

                <p className="mt-2 text-sm text-zinc-500">
                  This movie is not currently scheduled at this cinema.
                </p>

                <button
                  onClick={() =>
                    navigate(
                      "/cinemas"
                    )
                  }
                  className="mt-5 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold"
                >
                  Choose Another Cinema
                </button>

              </div>
            ) : (
              <>

                {/* =====================================
                    DATE SELECTOR
                ====================================== */}

                <div className="mt-8">

                  <h3 className="mb-4 font-semibold">
                    Select Date
                  </h3>

                  <div className="flex gap-3 overflow-x-auto pb-2">

                    {dates.map(
                      (date) => (
                        <button
                          key={
                            date
                          }
                          onClick={() =>
                            setSelectedDate(
                              date
                            )
                          }
                          className={`min-w-[120px] rounded-lg border px-4 py-3 text-sm ${
                            selectedDate ===
                            date
                              ? "border-red-500 bg-red-600 text-white"
                              : "border-white/10 bg-zinc-900 text-zinc-400"
                          }`}
                        >
                          {formatDay(
                            date
                          )}
                        </button>
                      )
                    )}

                  </div>

                </div>

                {/* =====================================
                    SHOW TIMES
                ====================================== */}

                <div className="mt-8">

                  <h3 className="mb-4 font-semibold">
                    Select Showtime
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

                    {dayShows.map(
                      (show) => (
                        <button
                          key={
                            show._id
                          }
                          onClick={() =>
                            selectShow(
                              show
                            )
                          }
                          className="rounded-xl border border-white/10 bg-zinc-900 p-5 text-left"
                        >

                          <div className="flex items-center justify-between">

                            <div className="flex items-center gap-2">

                              <Clock className="h-5 w-5 text-red-500" />

                              <span className="text-lg font-semibold">
                                {formatTime(
                                  show.startTime
                                )}
                              </span>

                            </div>

                            <span className="text-sm font-medium text-green-400">
                              ₹
                              {minimumPrice(
                                show
                              )}
                              +
                            </span>

                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">

                            <span className="rounded bg-white/5 px-2 py-1 text-xs text-zinc-400">
                              {
                                show.language
                              }
                            </span>

                            <span className="rounded bg-white/5 px-2 py-1 text-xs text-zinc-400">
                              {
                                show.format
                              }
                            </span>

                            {show.screen
                              ?.name && (
                              <span className="rounded bg-white/5 px-2 py-1 text-xs text-zinc-400">
                                {
                                  show.screen
                                    .name
                                }
                              </span>
                            )}

                          </div>

                          <p className="mt-4 text-xs text-zinc-600">
                            Select to choose seats
                          </p>

                        </button>
                      )
                    )}

                  </div>

                </div>

              </>
            )}

          </div>

        </section>

        {/* =============================================
            CAST
        ============================================== */}

        {Array.isArray(
          movie.cast
        ) &&
          movie.cast.length >
            0 && (
            <section className="mt-16 border-t border-white/10 pt-10">

              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                <h2 className="text-2xl font-bold">
                  Cast
                </h2>

                <div className="mt-6 flex gap-6 overflow-x-auto pb-3">

                  {movie.cast.map(
                    (
                      actor,
                      index
                    ) => (
                      <div
                        key={
                          `${actor.name}-${index}`
                        }
                        className="w-28 shrink-0 text-center"
                      >

                        {actor.image && (
                          <img
                            src={
                              actor.image
                            }
                            alt={
                              actor.name
                            }
                            className="mx-auto h-24 w-24 rounded-full object-cover"
                          />
                        )}

                        <p className="mt-3 text-sm font-medium">
                          {
                            actor.name
                          }
                        </p>

                        <p className="mt-1 text-xs text-zinc-600">
                          {
                            actor.role
                          }
                        </p>

                      </div>
                    )
                  )}

                </div>

              </div>

            </section>
          )}

      </div>
    );
  };

export default MovieDetails;