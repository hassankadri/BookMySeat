
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";

import {
  deriveComingNext,
  deriveNowShowing,
  deriveWeek,
} from "./lib/schedule";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const KEY_THEATRE = "bookmyseat_theatre";
const KEY_THEATRE_NAME = "bookmyseat_theatre_name";
const KEY_CITY = "bookmyseat_city";

const readStore = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStore = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The URL still carries the cinema selection.
  }
};

// =====================================================
// MERGE TRAILERS FROM THE FULL MOVIE DATABASE
// =====================================================

const mergeMovieTrailers = (shows, movies) => {
  const movieMap = new Map(
    (Array.isArray(movies) ? movies : [])
      .filter((movie) => movie?._id)
      .map((movie) => [String(movie._id), movie])
  );

  return (Array.isArray(shows) ? shows : []).map(
    (show) => {
      const movie = show?.movie;

      if (!movie?._id) {
        return show;
      }

      const fullMovie = movieMap.get(
        String(movie._id)
      );

      if (!fullMovie) {
        return show;
      }

      const trailer =
        movie.trailer ||
        movie.trailerUrl ||
        fullMovie.trailer ||
        fullMovie.trailerUrl ||
        null;

      if (!trailer) {
        return show;
      }

      return {
        ...show,
        movie: {
          ...movie,
          trailer,
        },
      };
    }
  );
};

// =====================================================
// GODZILLA PRIORITY — NEW FIX
// =====================================================

// Keep Godzilla visible if it exists in the
// eligible scheduled movie list.
//
// Do not create fake movies or showtimes.
// Keep the existing maximum of 8 movies.

const HOME_LIST_LIMIT = 8;

const isGodzillaKong = (film) =>
  /\bgodzilla\b.*\b(?:x|vs|versus)\b.*\bkong\b/i.test(
    film?.title || ""
  );

const selectHomeFilms = (films) => {
  const visible = films.slice(0, HOME_LIST_LIMIT);

  const godzilla = films.find(isGodzillaKong);

  if (!godzilla) {
    return visible;
  }

  // Godzilla is already among the first 8.
  // Keep the existing order unchanged.
  if (
    visible.some(
      (film) =>
        String(film._id) === String(godzilla._id)
    )
  ) {
    return visible;
  }

  // Godzilla was beyond the first 8.
  // Move it into the visible selection.
  return [godzilla, ...visible].slice(
    0,
    HOME_LIST_LIMIT
  );
};

// =====================================================
// HOMEPAGE DATA
// =====================================================

const useHomeData = () => {
  const navigate = useNavigate();

  const { isAuthenticated, token } = useAuth();

  const [shows, setShows] = useState([]);
  const [comingSoon, setComingSoon] = useState([]);
  const [theatres, setTheatres] = useState([]);

  const [loading, setLoading] = useState(true);

  const [failed, setFailed] = useState({
    shows: false,
    coming: false,
    theatres: false,
  });

  const [reloadTick, setReloadTick] = useState(0);

  const [city, setCity] = useState("");
  const [theatreId, setTheatreId] = useState("");
  const [scopeId, setScopeId] = useState(null);

  const [favIds, setFavIds] = useState(
    () => new Set()
  );

  // ===================================================
  // LOAD MOVIES, SHOWS AND CINEMAS
  // ===================================================

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);

      const [
        showsRes,
        soonRes,
        theatresRes,
        allMoviesRes,
      ] = await Promise.allSettled([
        axios.get(`${API_URL}/api/shows`, {
          params: {
            status: "SCHEDULED",
          },
        }),

        axios.get(`${API_URL}/api/movies`, {
          params: {
            status: "COMING_SOON",
          },
        }),

        axios.get(`${API_URL}/api/theatres`),

        axios.get(`${API_URL}/api/movies`),
      ]);

      if (!active) {
        return;
      }

      const rawShows =
        showsRes.status === "fulfilled"
          ? showsRes.value.data?.shows || []
          : [];

      const moviesData =
        allMoviesRes.status === "fulfilled"
          ? allMoviesRes.value.data
          : null;

      const allMovies = Array.isArray(moviesData)
        ? moviesData
        : moviesData?.movies ||
          moviesData?.data?.movies ||
          [];

      // Preserve scheduled shows while adding
      // missing trailer URLs from full movie records.
      setShows(
        mergeMovieTrailers(rawShows, allMovies)
      );

      setComingSoon(
        soonRes.status === "fulfilled"
          ? soonRes.value.data?.movies || []
          : []
      );

      setFailed({
        shows: showsRes.status === "rejected",
        coming: soonRes.status === "rejected",
        theatres:
          theatresRes.status === "rejected",
      });

      // ===============================================
      // EXISTING CINEMA SELECTION LOGIC
      // ===============================================

      if (theatresRes.status === "fulfilled") {
        const raw =
          theatresRes.value.data?.theatres ||
          theatresRes.value.data ||
          [];

        const list = Array.isArray(raw)
          ? raw.filter(
              (theatre) =>
                theatre.isActive !== false
            )
          : [];

        setTheatres(list);

        const cities = [
          ...new Set(
            list
              .map((theatre) => theatre.city)
              .filter(Boolean)
          ),
        ];

        const savedCity = readStore(KEY_CITY);

        const saved = list.find(
          (theatre) =>
            theatre._id === readStore(KEY_THEATRE)
        );

        const startCity =
          saved?.city ||
          (cities.includes(savedCity)
            ? savedCity
            : cities[0]) ||
          "";

        const inCity = list.filter(
          (theatre) =>
            !startCity ||
            theatre.city === startCity
        );

        setCity(startCity);

        setTheatreId(
          saved?._id ||
            inCity[0]?._id ||
            ""
        );
      } else {
        setTheatres([]);
      }

      setLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [reloadTick]);

  const reload = useCallback(
    () => setReloadTick((n) => n + 1),
    []
  );

  // ===================================================
  // FAVORITES
  // ===================================================

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setFavIds(new Set());
      return undefined;
    }

    let active = true;

    axios
      .get(
        `${API_URL}/api/movies/favorites/list`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .then((res) => {
        if (active) {
          setFavIds(
            new Set(
              (res.data?.favorites || []).map(
                (film) => film._id
              )
            )
          );
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isAuthenticated, token]);

  const toggleFavorite = useCallback(
    async (movieId) => {
      if (!isAuthenticated) {
        toast.error(
          "Please sign in to save favorites."
        );

        navigate("/auth");
        return;
      }

      const wasFav = favIds.has(movieId);

      const apply = (add) => {
        setFavIds((prev) => {
          const next = new Set(prev);

          if (add) {
            next.add(movieId);
          } else {
            next.delete(movieId);
          }

          return next;
        });
      };

      apply(!wasFav);

      try {
        await axios.post(
          `${API_URL}/api/movies/${movieId}/favorite`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        toast.success(
          wasFav
            ? "Removed from favorites"
            : "Saved to favorites"
        );
      } catch {
        apply(wasFav);

        toast.error(
          "Could not update favorites. Please try again."
        );
      }
    },
    [
      favIds,
      isAuthenticated,
      navigate,
      token,
    ]
  );

  // ===================================================
  // CINEMA SELECTION
  // ===================================================

  const cities = useMemo(
    () => [
      ...new Set(
        theatres
          .map((theatre) => theatre.city)
          .filter(Boolean)
      ),
    ],
    [theatres]
  );

  const cityTheatres = useMemo(
    () =>
      cities.length
        ? theatres.filter(
            (theatre) =>
              theatre.city === city
          )
        : theatres,
    [theatres, cities, city]
  );

  const selectedTheatre = useMemo(
    () =>
      theatres.find(
        (theatre) =>
          theatre._id === theatreId
      ) || null,
    [theatres, theatreId]
  );

  const scopeTheatre = useMemo(
    () =>
      theatres.find(
        (theatre) =>
          theatre._id === scopeId
      ) || null,
    [theatres, scopeId]
  );

  const chooseCinema = useCallback(
    (theatre = selectedTheatre) => {
      if (!theatre?._id) {
        toast.error(
          "Cinema information is incomplete."
        );

        return;
      }

      writeStore(
        KEY_THEATRE,
        theatre._id
      );

      writeStore(
        KEY_THEATRE_NAME,
        theatre.name || ""
      );

      writeStore(
        KEY_CITY,
        theatre.city || ""
      );

      navigate(
        `/movies?theatre=${theatre._id}&city=${encodeURIComponent(
          theatre.city || ""
        )}`
      );
    },
    [navigate, selectedTheatre]
  );

  const selectCity = useCallback(
    (value) => {
      setCity(value);

      const first = theatres.find(
        (theatre) =>
          theatre.city === value
      );

      setTheatreId(
        first?._id || ""
      );

      setScopeId(
        first?._id || null
      );
    },
    [theatres]
  );

  const selectTheatre = useCallback(
    (value) => {
      setTheatreId(value);
      setScopeId(value || null);
    },
    []
  );

  const clearScope = useCallback(
    () => setScopeId(null),
    []
  );

  // ===================================================
  // DERIVED HOMEPAGE DATA
  // ===================================================

  const allNowShowing = useMemo(
    () =>
      deriveNowShowing(shows, null),
    [shows]
  );

  const scoped = useMemo(
    () =>
      scopeId
        ? deriveNowShowing(
            shows,
            scopeId
          )
        : allNowShowing,
    [shows, scopeId, allNowShowing]
  );

  // ===================================================
  // FIX: KEEP GODZILLA VISIBLE
  // ===================================================

  const nowShowing = useMemo(
    () => selectHomeFilms(scoped),
    [scoped]
  );

  // ===================================================
  // OTHER HOMEPAGE DATA — PRESERVED
  // ===================================================

  const heroFilms = useMemo(
    () =>
      (
        scoped.length
          ? scoped
          : allNowShowing
      ).slice(0, 5),
    [scoped, allNowShowing]
  );

  const week = useMemo(
    () => deriveWeek(shows),
    [shows]
  );

  const comingNext = useMemo(
    () =>
      deriveComingNext(
        comingSoon,
        allNowShowing
      ).slice(0, 7),
    [comingSoon, allNowShowing]
  );

  return {
    loading,
    failed,
    reload,

    shows,
    comingSoon,
    theatres,

    cities,
    city,
    cityTheatres,
    theatreId,
    selectedTheatre,
    selectCity,
    selectTheatre,
    chooseCinema,

    scopeId,
    scopeTheatre,
    clearScope,

    allNowShowing,
    nowShowing,
    heroFilms,
    week,
    comingNext,

    favIds,
    toggleFavorite,
  };
};

export default useHomeData;
