
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";
import toast from "react-hot-toast";

import {
  ArrowLeft,
  ArrowRight,
  Armchair,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clapperboard,
  Clock3,
  IndianRupee,
  Loader2,
  MonitorPlay,
  ShieldCheck,
} from "lucide-react";

import {
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  Link,
  Navigate,
} from "react-router-dom";

import {
  useAuth,
} from "../../context/AuthContext";

// =====================================================
// CONFIG
// =====================================================

const API_URL = (
  process.env.REACT_APP_BACKEND_URL || ""
).replace(/\/+$/, "");

const PARTNER_API =
  `${API_URL}/api/partner/theatres`;

const INPUT =
  "w-full rounded-xl border border-white/10 bg-[#1c1c21] px-4 py-3.5 text-sm text-white outline-none transition-colors focus:border-[#D71935] disabled:cursor-not-allowed disabled:opacity-45";

const PANEL =
  "rounded-[24px] border border-white/10 bg-[#121215]";

const IST_OFFSET_MINUTES = 330;

function todayInIndia() {
  return new Date(
    Date.now() +
      IST_OFFSET_MINUTES * 60000
  )
    .toISOString()
    .slice(0, 10);
}

function getError(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function idOf(value) {
  return String(
    typeof value === "object" && value
      ? value._id || ""
      : value || ""
  );
}

function friendly(value) {
  return String(value || "STANDARD")
    .replace(/_/g, " ");
}

function formatMoney(value) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }
  ).format(Number(value) || 0);
}

function formatIndiaDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function getMovieLanguages(movie) {
  const raw = movie?.language || "";

  return String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTimeRange(date, startTime, endTime) {
  if (!date || !startTime || !endTime) {
    return null;
  }

  // All screenings are entered as Indian Standard Time.
  // The explicit offset avoids browser timezone errors.

  const start = new Date(
    `${date}T${startTime}:00+05:30`
  );

  const end = new Date(
    `${date}T${endTime}:00+05:30`
  );

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime())
  ) {
    return null;
  }

  // A show ending after midnight continues into
  // the following calendar day.

  if (end <= start) {
    end.setTime(
      end.getTime() + 86400000
    );
  }

  return {
    start,
    end,
    durationHours:
      (end.getTime() - start.getTime()) /
      3600000,
  };
}

function FieldTitle({
  number,
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D71935]/30 bg-[#D71935]/10">
        <Icon
          size={19}
          className="text-[#f0788b]"
        />
      </span>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f0788b]">
          Step {number}
        </p>

        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          {title}
        </h2>

        <p className="mt-2 text-xs leading-6 text-white/45">
          {description}
        </p>
      </div>
    </div>
  );
}

// =====================================================
// PAGE
// =====================================================

export default function PartnerShowtimeCreate() {
  const {
    user,
    token,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const reducedMotion = useReducedMotion();

  const isPartner =
    isAuthenticated &&
    user?.role === "partner";

  const [movies, setMovies] = useState([]);
  const [theatres, setTheatres] = useState([]);
  const [screens, setScreens] = useState([]);
  const [categories, setCategories] =
    useState([]);

  const [
    selectedScreen,
    setSelectedScreen,
  ] = useState(null);

  const [prices, setPrices] =
    useState({});

  const [form, setForm] = useState({
    movieId: "",
    theatreId: "",
    screenId: "",
    language: "",
    date: todayInIndia(),
    startTime: "",
    endTime: "",
  });

  const [loading, setLoading] =
    useState(true);

  const [
    screensLoading,
    setScreensLoading,
  ] = useState(false);

  const [
    categoriesLoading,
    setCategoriesLoading,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [error, setError] = useState("");
  const [screenError, setScreenError] =
    useState("");
  const [
    categoryError,
    setCategoryError,
  ] = useState("");

  const [createdShow, setCreatedShow] =
    useState(null);

  // =====================================================
  // INITIAL MOVIES AND ASSIGNED THEATRES
  // =====================================================

  useEffect(() => {
    if (!isPartner || !token) {
      setLoading(false);
      return undefined;
    }

    const controller =
      new AbortController();

    setLoading(true);
    setError("");

    const config = {
      signal: controller.signal,
      timeout: 15000,
    };

    Promise.all([
      axios.get(
        `${API_URL}/api/movies`,
        {
          ...config,
          params: {
            status: "ACTIVE",
          },
        }
      ),

      axios.get(
        PARTNER_API,
        {
          ...config,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      ),
    ])
      .then(([movieResponse, theatreResponse]) => {
        if (controller.signal.aborted) {
          return;
        }

        if (
          !Array.isArray(
            movieResponse.data?.movies
          ) ||
          !Array.isArray(
            theatreResponse.data?.theatres
          )
        ) {
          throw new Error(
            "Invalid scheduling data received."
          );
        }

        const activeMovies =
          movieResponse.data.movies.filter(
            (movie) =>
              movie.listingStatus === "ACTIVE"
          );

        const assignedTheatres =
          theatreResponse.data.theatres;

        setMovies(activeMovies);
        setTheatres(assignedTheatres);

        setForm((current) => ({
          ...current,
          theatreId:
            assignedTheatres.some(
              (theatre) =>
                theatre._id ===
                current.theatreId
            )
              ? current.theatreId
              : assignedTheatres[0]?._id || "",
        }));
      })
      .catch((requestError) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          getError(
            requestError,
            "Could not load scheduling information."
          )
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [isPartner, token]);

  // =====================================================
  // LOAD SCREENS FOR SELECTED THEATRE
  // =====================================================

  useEffect(() => {
    if (
      !isPartner ||
      !token ||
      !form.theatreId
    ) {
      setScreens([]);
      setScreensLoading(false);
      return undefined;
    }

    const controller =
      new AbortController();

    setScreensLoading(true);
    setScreenError("");

    axios
      .get(
        `${PARTNER_API}/${form.theatreId}/screens`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
          timeout: 15000,
        }
      )
      .then(({ data }) => {
        if (
          !data?.success ||
          !Array.isArray(data.screens)
        ) {
          throw new Error(
            "Invalid screen inventory."
          );
        }

        const activeScreens =
          data.screens.filter(
            (screen) => screen.isActive !== false
          );

        setScreens(activeScreens);

        setForm((current) => ({
          ...current,

          screenId:
            activeScreens.some(
              (screen) =>
                screen._id === current.screenId
            )
              ? current.screenId
              : activeScreens[0]?._id || "",
        }));
      })
      .catch((requestError) => {
        if (controller.signal.aborted) {
          return;
        }

        setScreens([]);

        setScreenError(
          getError(
            requestError,
            "Could not load cinema screens."
          )
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setScreensLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    isPartner,
    token,
    form.theatreId,
  ]);

  // =====================================================
  // LOAD VERIFIED SCREEN SEAT CATEGORIES
  // =====================================================

  useEffect(() => {
    if (
      !isPartner ||
      !token ||
      !form.theatreId ||
      !form.screenId
    ) {
      setSelectedScreen(null);
      setCategories([]);
      setPrices({});
      setCategoriesLoading(false);
      return undefined;
    }

    const controller =
      new AbortController();

    setSelectedScreen(null);
    setCategories([]);
    setPrices({});
    setCategoriesLoading(true);
    setCategoryError("");

    axios
      .get(
        `${PARTNER_API}/${form.theatreId}/screens/${form.screenId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
          timeout: 15000,
        }
      )
      .then(({ data }) => {
        if (
          !data?.success ||
          !data.screen ||
          !Array.isArray(data.categories)
        ) {
          throw new Error(
            "Invalid screen seat categories."
          );
        }

        if (
          idOf(data.screen.theatre) !==
          form.theatreId
        ) {
          throw new Error(
            "This screen does not belong to the selected cinema."
          );
        }

        setSelectedScreen(data.screen);
        setCategories(data.categories);

        setPrices(
          Object.fromEntries(
            data.categories.map(
              (category) => [
                category.seatType,
                "",
              ]
            )
          )
        );
      })
      .catch((requestError) => {
        if (controller.signal.aborted) {
          return;
        }

        setCategoryError(
          getError(
            requestError,
            "Could not read screen seat categories."
          )
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCategoriesLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    isPartner,
    token,
    form.theatreId,
    form.screenId,
  ]);

  // =====================================================
  // DERIVED DATA
  // =====================================================

  const selectedTheatre = useMemo(
    () =>
      theatres.find(
        (theatre) =>
          theatre._id === form.theatreId
      ) || null,
    [theatres, form.theatreId]
  );

  const selectedMovie = useMemo(
    () =>
      movies.find(
        (movie) =>
          movie._id === form.movieId
      ) || null,
    [movies, form.movieId]
  );

  const timeRange = useMemo(
    () =>
      buildTimeRange(
        form.date,
        form.startTime,
        form.endTime
      ),
    [
      form.date,
      form.startTime,
      form.endTime,
    ]
  );

  const seatCount = categories.reduce(
    (sum, category) =>
      sum + Number(category.count || 0),
    0
  );

  const pricingReady =
    categories.length > 0 &&
    categories.every((category) => {
      const raw = prices[category.seatType];
      const value = Number(raw);

      return (
        raw !== "" &&
        Number.isFinite(value) &&
        value > 0 &&
        value <= 100000
      );
    });

  const validTimeRange =
    timeRange &&
    timeRange.start.getTime() > Date.now() &&
    timeRange.durationHours > 0 &&
    timeRange.durationHours <= 12;

  const ready =
    !loading &&
    !screensLoading &&
    !categoriesLoading &&
    !submitting &&
    selectedMovie &&
    selectedTheatre &&
    selectedScreen &&
    form.language.trim().length >= 2 &&
    form.language.trim().length <= 60 &&
    pricingReady &&
    validTimeRange;

  const potentialRevenue = categories.reduce(
    (sum, category) =>
      sum +
      category.count *
        (Number(prices[category.seatType]) || 0),
    0
  );

  // =====================================================
  // EVENT HANDLERS
  // =====================================================

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setCreatedShow(null);
  };

  const changeMovie = (movieId) => {
    const movie = movies.find(
      (item) => item._id === movieId
    );

    const firstLanguage =
      getMovieLanguages(movie)[0] || "";

    setForm((current) => ({
      ...current,
      movieId,
      language: firstLanguage,
    }));

    setCreatedShow(null);
  };

  const changeTheatre = (theatreId) => {
    setScreens([]);
    setSelectedScreen(null);
    setCategories([]);
    setPrices({});

    setForm((current) => ({
      ...current,
      theatreId,
      screenId: "",
    }));

    setCreatedShow(null);
  };

  const changeScreen = (screenId) => {
    setSelectedScreen(null);
    setCategories([]);
    setPrices({});

    updateForm("screenId", screenId);
  };

  // =====================================================
  // CREATE SHOWTIME
  // =====================================================

  const submit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    if (!ready) {
      toast.error(
        "Complete the film, cinema, screen, pricing and time fields."
      );
      return;
    }

    const range = buildTimeRange(
      form.date,
      form.startTime,
      form.endTime
    );

    if (
      !range ||
      range.start <= new Date() ||
      range.durationHours > 12
    ) {
      toast.error(
        "Choose a valid future screening lasting no more than 12 hours."
      );
      return;
    }

    const pricing = categories.map(
      (category) => ({
        seatType: category.seatType,
        price: Number(
          prices[category.seatType]
        ),
      })
    );

    setSubmitting(true);
    setError("");
    setCreatedShow(null);

    try {
      const { data } = await axios.post(
        `${PARTNER_API}/${form.theatreId}/shows`,
        {
          movie: selectedMovie._id,
          screen: selectedScreen._id,
          language: form.language.trim(),
          format:
            selectedScreen.format ||
            "STANDARD",
          pricing,
          startTime:
            range.start.toISOString(),
          endTime:
            range.end.toISOString(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        }
      );

      if (!data?.success || !data.show) {
        throw new Error(
          "Scheduling was not confirmed by the server."
        );
      }

      setCreatedShow(data.show);

      setForm((current) => ({
        ...current,
        startTime: "",
        endTime: "",
      }));

      toast.success(
        "Showtime created successfully."
      );
    } catch (requestError) {
      const message = getError(
        requestError,
        "Could not schedule this showtime."
      );

      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // AUTHORIZATION
  // =====================================================

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] text-white/60">
        <Loader2
          size={22}
          className="mr-3 animate-spin text-[#D71935]"
        />

        Verifying partner access...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth"
        replace
      />
    );
  }

  if (!isPartner) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="min-h-screen bg-[#09090b] pt-16 text-white">
      <main className="mx-auto max-w-[1400px] px-5 pb-24 pt-12 sm:px-8 lg:px-12">
        <motion.header
          initial={
            reducedMotion
              ? false
              : {
                  opacity: 0,
                  y: 20,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
          }}
        >
          <Link
            to="/partner"
            className="inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Partner portal
          </Link>

          <div className="mt-8 flex items-center gap-3">
            <span className="h-px w-8 bg-[#D71935]" />

            <p className="text-[11px] font-semibold uppercase tracking-[0.23em] text-[#f27890]">
              Cinema programming
            </p>
          </div>

          <h1 className="mt-5 text-[clamp(2.5rem,5vw,4.75rem)] font-semibold leading-none tracking-[-0.07em]">
            Schedule a show
            <span className="text-[#D71935]">.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/50">
            Create a screening at one of your assigned
            cinemas. Ticket categories are taken directly
            from the selected auditorium.
          </p>
        </motion.header>

        {error && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {createdShow && (
          <div
            role="status"
            className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-6"
          >
            <CheckCircle2
              size={24}
              className="text-emerald-400"
            />

            <div className="flex-1">
              <p className="font-semibold">
                Showtime scheduled
              </p>

              <p className="mt-1 text-sm text-white/55">
                {createdShow.movie?.title ||
                  selectedMovie?.title ||
                  "Screening"}
                {" · "}
                {formatIndiaDate(
                  createdShow.startTime
                )}
              </p>
            </div>

            <Link
              to="/partner"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white"
            >
              View portal
              <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {loading ? (
          <div className="mt-12 flex items-center gap-3 text-sm text-white/50">
            <Loader2
              size={20}
              className="animate-spin text-[#D71935]"
            />
            Loading cinema information...
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="mt-10 grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.8fr)]"
          >
            <div className="space-y-5">
              {/* ================================== */}
              {/* MOVIE */}
              {/* ================================== */}

              <section className={`${PANEL} p-6 sm:p-8`}>
                <FieldTitle
                  number="01"
                  icon={Clapperboard}
                  title="Choose a film"
                  description="Only actively listed movies can be scheduled."
                />

                <label className="mt-6 block">
                  <span className="mb-2 block text-xs text-white/55">
                    Movie
                  </span>

                  <select
                    value={form.movieId}
                    required
                    onChange={(event) =>
                      changeMovie(event.target.value)
                    }
                    className={INPUT}
                  >
                    <option value="">
                      Select an active movie
                    </option>

                    {movies.map((movie) => (
                      <option
                        key={movie._id}
                        value={movie._id}
                      >
                        {movie.title}
                      </option>
                    ))}
                  </select>
                </label>

                {movies.length === 0 && (
                  <p className="mt-3 text-xs text-white/40">
                    No active movies are available.
                    Ask an administrator to update the catalogue.
                  </p>
                )}

                <label className="mt-5 block">
                  <span className="mb-2 block text-xs text-white/55">
                    Screening language
                  </span>

                  <input
                    type="text"
                    value={form.language}
                    onChange={(event) =>
                      updateForm(
                        "language",
                        event.target.value
                      )
                    }
                    maxLength={60}
                    placeholder="For example, English"
                    required
                    className={INPUT}
                  />
                </label>
              </section>

              {/* ================================== */}
              {/* CINEMA AND SCREEN */}
              {/* ================================== */}

              <section className={`${PANEL} p-6 sm:p-8`}>
                <FieldTitle
                  number="02"
                  icon={Building2}
                  title="Choose a cinema and screen"
                  description="You can schedule only at cinemas assigned to your account."
                />

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs text-white/55">
                      Assigned cinema
                    </span>

                    <select
                      value={form.theatreId}
                      onChange={(event) =>
                        changeTheatre(
                          event.target.value
                        )
                      }
                      required
                      className={INPUT}
                    >
                      <option value="">
                        Select cinema
                      </option>

                      {theatres.map((theatre) => (
                        <option
                          key={theatre._id}
                          value={theatre._id}
                        >
                          {theatre.name}
                          {theatre.city
                            ? ` — ${theatre.city}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs text-white/55">
                      Auditorium
                    </span>

                    <select
                      value={form.screenId}
                      onChange={(event) =>
                        changeScreen(
                          event.target.value
                        )
                      }
                      disabled={
                        !form.theatreId ||
                        screensLoading
                      }
                      required
                      className={INPUT}
                    >
                      <option value="">
                        {screensLoading
                          ? "Loading screens..."
                          : "Select screen"}
                      </option>

                      {screens.map((screen) => (
                        <option
                          key={screen._id}
                          value={screen._id}
                        >
                          {screen.name} — Screen{" "}
                          {screen.screenNumber}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {screenError && (
                  <p
                    role="alert"
                    className="mt-4 text-sm text-red-300"
                  >
                    {screenError}
                  </p>
                )}

                {selectedScreen && (
                  <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <MonitorPlay
                      size={19}
                      className="text-[#f0788b]"
                    />

                    <span className="text-sm text-white/75">
                      {friendly(
                        selectedScreen.format
                      )}
                    </span>

                    <span className="text-white/20">
                      /
                    </span>

                    <span className="text-sm text-white/75">
                      {seatCount} active seats
                    </span>
                  </div>
                )}
              </section>

              {/* ================================== */}
              {/* SEAT CATEGORY PRICING */}
              {/* ================================== */}

              <section className={`${PANEL} p-6 sm:p-8`}>
                <FieldTitle
                  number="03"
                  icon={Armchair}
                  title="Set ticket prices"
                  description="Each active seat category must have a valid ticket price."
                />

                {categoriesLoading ? (
                  <div className="mt-7 flex items-center gap-3 text-sm text-white/45">
                    <Loader2
                      size={17}
                      className="animate-spin text-[#D71935]"
                    />
                    Reading auditorium configuration...
                  </div>
                ) : categoryError ? (
                  <p
                    role="alert"
                    className="mt-6 text-sm text-red-300"
                  >
                    {categoryError}
                  </p>
                ) : categories.length === 0 ? (
                  <p className="mt-6 text-sm leading-6 text-white/45">
                    Select a screen with active seats to
                    configure ticket prices.
                  </p>
                ) : (
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {categories.map((category) => (
                      <label
                        key={category.seatType}
                        className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">
                            {friendly(
                              category.seatType
                            )}
                          </span>

                          <span className="text-[11px] text-white/40">
                            {category.count} seats
                          </span>
                        </span>

                        <span className="relative mt-4 block">
                          <IndianRupee
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                          />

                          <input
                            type="number"
                            inputMode="decimal"
                            min="0.01"
                            max="100000"
                            step="0.01"
                            required
                            value={
                              prices[
                                category.seatType
                              ] ?? ""
                            }
                            onChange={(event) =>
                              setPrices(
                                (current) => ({
                                  ...current,
                                  [category.seatType]:
                                    event.target.value,
                                })
                              )
                            }
                            placeholder="Ticket price"
                            aria-label={`${friendly(
                              category.seatType
                            )} ticket price`}
                            className={`${INPUT} pl-9`}
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              {/* ================================== */}
              {/* SCREENING DATE AND TIME */}
              {/* ================================== */}

              <section className={`${PANEL} p-6 sm:p-8`}>
                <FieldTitle
                  number="04"
                  icon={CalendarDays}
                  title="Set the screening time"
                  description="All dates and times below use Indian Standard Time."
                />

                <div className="mt-7 grid gap-5 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-xs text-white/55">
                      Screening date
                    </span>

                    <input
                      type="date"
                      required
                      min={todayInIndia()}
                      value={form.date}
                      onChange={(event) =>
                        updateForm(
                          "date",
                          event.target.value
                        )
                      }
                      className={INPUT}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs text-white/55">
                      Starts at
                    </span>

                    <input
                      type="time"
                      required
                      value={form.startTime}
                      onChange={(event) =>
                        updateForm(
                          "startTime",
                          event.target.value
                        )
                      }
                      className={INPUT}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs text-white/55">
                      Ends at
                    </span>

                    <input
                      type="time"
                      required
                      value={form.endTime}
                      onChange={(event) =>
                        updateForm(
                          "endTime",
                          event.target.value
                        )
                      }
                      className={INPUT}
                    />
                  </label>
                </div>

                {timeRange && (
                  <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/45">
                    <Clock3 size={15} />

                    <span>
                      {formatIndiaDate(
                        timeRange.start
                      )}
                    </span>

                    <ArrowRight size={13} />

                    <span>
                      {formatIndiaDate(
                        timeRange.end
                      )}
                    </span>
                  </div>
                )}

                {timeRange &&
                  !validTimeRange && (
                    <p className="mt-3 text-xs text-red-300">
                      The show must start in the future
                      and last no longer than 12 hours.
                    </p>
                  )}
              </section>
            </div>

            {/* ==================================== */}
            {/* SUMMARY AND SUBMISSION */}
            {/* ==================================== */}

            <aside className="xl:sticky xl:top-24">
              <div className={`${PANEL} p-6 sm:p-7`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ef7187]">
                  Programme summary
                </p>

                <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                  Screening details
                </h2>

                <div className="mt-8 space-y-5">
                  <div>
                    <p className="text-xs text-white/35">
                      Film
                    </p>

                    <p className="mt-2 text-sm font-medium">
                      {selectedMovie?.title ||
                        "Not selected"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/35">
                      Cinema
                    </p>

                    <p className="mt-2 text-sm font-medium">
                      {selectedTheatre?.name ||
                        "Not selected"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/35">
                      Auditorium
                    </p>

                    <p className="mt-2 text-sm font-medium">
                      {selectedScreen?.name ||
                        "Not selected"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/35">
                      Showtime (IST)
                    </p>

                    <p className="mt-2 text-sm font-medium">
                      {timeRange
                        ? formatIndiaDate(
                            timeRange.start
                          )
                        : "Not selected"}
                    </p>
                  </div>

                  <div className="border-t border-white/10 pt-5">
                    <p className="text-xs text-white/35">
                      Available seats
                    </p>

                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {seatCount}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/35">
                      Maximum gross ticket value
                    </p>

                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {formatMoney(
                        potentialRevenue
                      )}
                    </p>

                    <p className="mt-2 text-[11px] leading-5 text-white/35">
                      Theoretical full-capacity ticket
                      value, before fees or adjustments.
                      Not actual revenue.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!ready}
                  className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#D71935] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#ed2948] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {submitting ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <CalendarDays
                      size={18}
                    />
                  )}

                  {submitting
                    ? "Scheduling..."
                    : "Create showtime"}
                </button>

                <div className="mt-6 flex items-start gap-3 border-t border-white/10 pt-5">
                  <ShieldCheck
                    size={17}
                    className="mt-0.5 shrink-0 text-white/45"
                  />

                  <p className="text-xs leading-6 text-white/45">
                    Cinema ownership, seat-category
                    pricing and schedule conflicts
                    are checked by the server before
                    a showtime is created.
                  </p>
                </div>
              </div>
            </aside>
          </form>
        )}
      </main>
    </div>
  );
}
