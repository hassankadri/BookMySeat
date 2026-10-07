import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  IndianRupee,
  Loader2,
  X,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SHOW_FORMATS = [
  "STANDARD",
  "3D",
  "IMAX",
  "IMAX_3D",
  "4DX",
  "DOLBY_CINEMA",
];

const formatLabel = (value) =>
  String(value || "").replaceAll(
    "_",
    " "
  );

const localDateKey = () => {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
};

const getTheatreId = (
  screen
) => {
  if (
    !screen?.theatre
  ) {
    return "";
  }

  return typeof screen.theatre ===
    "object"
    ? screen.theatre._id ||
        ""
    : String(
        screen.theatre
      );
};

const getSeatTypes = (
  screen
) => {
  if (
    !Array.isArray(
      screen?.seats
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      screen.seats
        .filter(
          (seat) =>
            seat?.isActive !==
            false
        )
        .map(
          (seat) =>
            seat?.type
        )
        .filter(Boolean)
    ),
  ];
};

const buildLocalDateTime =
  (
    date,
    time
  ) => {
    const value =
      new Date(
        `${date}T${time}:00`
      );

    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  };

const AddShow = () => {
  const {
    token,
  } = useAuth();

  const [
    movies,
    setMovies,
  ] = useState([]);

  const [
    theatres,
    setTheatres,
  ] = useState([]);

  const [
    screens,
    setScreens,
  ] = useState([]);

  const [
    selectedMovie,
    setSelectedMovie,
  ] = useState(null);

  const [
    selectedTheatreId,
    setSelectedTheatreId,
  ] = useState("");

  const [
    selectedScreen,
    setSelectedScreen,
  ] = useState(null);

  const [
    language,
    setLanguage,
  ] = useState("");

  const [
    format,
    setFormat,
  ] = useState(
    "STANDARD"
  );

  const [
    pricing,
    setPricing,
  ] = useState({});

  const [
    showSlots,
    setShowSlots,
  ] = useState([]);

  const [
    newSlot,
    setNewSlot,
  ] = useState({
    date: "",
    startTime: "",
    endTime: "",
  });

  const [
    loadingData,
    setLoadingData,
  ] = useState(true);

  const [
    loadingScreens,
    setLoadingScreens,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const authConfig =
    useMemo(
      () => ({
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }),
      [token]
    );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled =
      false;

    const loadInitialData =
      async () => {
        setLoadingData(
          true
        );

        const [
          movieResult,
          theatreResult,
        ] =
          await Promise.allSettled(
            [
              axios.get(
                `${API_URL}/api/movies/admin/all`,
                authConfig
              ),

              axios.get(
                `${API_URL}/api/admin/theatres`,
                authConfig
              ),
            ]
          );

        if (cancelled) {
          return;
        }

        if (
          movieResult.status ===
          "fulfilled"
        ) {
          setMovies(
            movieResult.value
              .data.movies ||
              []
          );
        } else {
          console.error(
            "Movie load error:",
            movieResult.reason
          );

          toast.error(
            movieResult.reason
              ?.response
              ?.data
              ?.error ||
              movieResult
                .reason
                ?.response
                ?.data
                ?.message ||
              "Failed to load movies"
          );
        }

        if (
          theatreResult.status ===
          "fulfilled"
        ) {
          setTheatres(
            (
              theatreResult
                .value.data
                .theatres || []
            ).filter(
              (theatre) =>
                theatre.isActive !==
                false
            )
          );
        } else {
          console.error(
            "Theatre load error:",
            theatreResult.reason
          );

          toast.error(
            theatreResult
              .reason
              ?.response
              ?.data
              ?.error ||
              theatreResult
                .reason
                ?.response
                ?.data
                ?.message ||
              "Failed to load theatres"
          );
        }

        setLoadingData(
          false
        );
      };

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    authConfig,
  ]);

  useEffect(() => {
    if (
      !selectedTheatreId ||
      !token
    ) {
      setScreens([]);

      setSelectedScreen(
        null
      );

      setPricing({});

      return;
    }

    let cancelled =
      false;

    const loadScreens =
      async () => {
        setLoadingScreens(
          true
        );

        setSelectedScreen(
          null
        );

        setPricing({});

        try {
          const response =
            await axios.get(
              `${API_URL}/api/screens`,
              {
                ...authConfig,

                params: {
                  theatre:
                    selectedTheatreId,
                },
              }
            );

          if (cancelled) {
            return;
          }

          const allScreens =
            Array.isArray(
              response.data
            )
              ? response.data
              : response
                  .data
                  .screens ||
                [];

          const matchingScreens =
            allScreens.filter(
              (
                screen
              ) => {
                const belongsToTheatre =
                  getTheatreId(
                    screen
                  ) ===
                  selectedTheatreId;

                return (
                  belongsToTheatre &&
                  screen.isActive !==
                    false
                );
              }
            );

          setScreens(
            matchingScreens
          );
        } catch (error) {
          if (cancelled) {
            return;
          }

          console.error(
            "Screen load error:",
            error
          );

          toast.error(
            error.response
              ?.data
              ?.error ||
              error.response
                ?.data
                ?.message ||
              "Failed to load screens"
          );
        } finally {
          if (
            !cancelled
          ) {
            setLoadingScreens(
              false
            );
          }
        }
      };

    loadScreens();

    return () => {
      cancelled = true;
    };
  }, [
    selectedTheatreId,
    token,
    authConfig,
  ]);

  const seatTypes =
    useMemo(
      () =>
        getSeatTypes(
          selectedScreen
        ),
      [selectedScreen]
    );

  const handleMovieSelect =
    (
      movie
    ) => {
      setSelectedMovie(
        movie
      );

      const firstLanguage =
        String(
          movie.language ||
            ""
        )
          .split(",")[0]
          .trim();

      setLanguage(
        firstLanguage
      );
    };

  const handleScreenChange =
    async (
      event
    ) => {
      const screenId =
        event.target.value;

      if (!screenId) {
        setSelectedScreen(
          null
        );

        setPricing({});

        return;
      }

      let screen =
        screens.find(
          (
            item
          ) =>
            item._id ===
            screenId
        ) || null;

      try {
        // Some list endpoints omit the full seat map.
        // Fetch one screen when needed.
        if (
          !Array.isArray(
            screen?.seats
          ) ||
          screen.seats
            .length === 0
        ) {
          const response =
            await axios.get(
              `${API_URL}/api/screens/${screenId}`,
              authConfig
            );

          screen =
            response.data
              .screen ||
            response.data;
        }

        setSelectedScreen(
          screen
        );

        setFormat(
          screen?.format ||
            "STANDARD"
        );

        const nextPricing =
          {};

        getSeatTypes(
          screen
        ).forEach(
          (
            seatType
          ) => {
            nextPricing[
              seatType
            ] = "";
          }
        );

        setPricing(
          nextPricing
        );
      } catch (error) {
        console.error(
          "Screen detail error:",
          error
        );

        toast.error(
          error.response
            ?.data
            ?.error ||
            error.response
              ?.data
              ?.message ||
            "Could not load the selected screen"
        );
      }
    };

  const addShowSlot =
    () => {
      const {
        date,
        startTime,
        endTime,
      } = newSlot;

      if (
        !date ||
        !startTime ||
        !endTime
      ) {
        toast.error(
          "Please select date, start time and end time"
        );

        return;
      }

      const start =
        buildLocalDateTime(
          date,
          startTime
        );

      let end =
        buildLocalDateTime(
          date,
          endTime
        );

      if (
        !start ||
        !end
      ) {
        toast.error(
          "Invalid show date or time"
        );

        return;
      }

      // A show can cross midnight.
      // Example:
      // 11:30 PM -> 2:00 AM
      if (
        end <= start
      ) {
        end =
          new Date(
            end.getTime() +
              24 *
                60 *
                60 *
                1000
          );
      }

      if (
        start <=
        new Date()
      ) {
        toast.error(
          "Show start time must be in the future"
        );

        return;
      }

      const duplicate =
        showSlots.some(
          (
            slot
          ) =>
            slot.startTimeIso ===
            start.toISOString()
        );

      if (duplicate) {
        toast.error(
          "That show slot is already added"
        );

        return;
      }

      setShowSlots(
        (
          current
        ) => [
          ...current,

          {
            date,
            startTime,
            endTime,

            startTimeIso:
              start.toISOString(),

            endTimeIso:
              end.toISOString(),
          },
        ]
      );

      setNewSlot({
        date: "",
        startTime: "",
        endTime: "",
      });
    };

  const removeShowSlot =
    (
      index
    ) => {
      setShowSlots(
        (
          current
        ) =>
          current.filter(
            (
              _,
              idx
            ) =>
              idx !==
              index
          )
      );
    };

  const validateBeforeSubmit =
    () => {
      if (
        !selectedMovie
      ) {
        return "Please select a movie";
      }

      if (
        !selectedTheatreId
      ) {
        return "Please select a theatre";
      }

      if (
        !selectedScreen
      ) {
        return "Please select a screen";
      }

      if (
        !language.trim()
      ) {
        return "Please enter the show language";
      }

      if (
        showSlots.length ===
        0
      ) {
        return "Please add at least one show slot";
      }

      if (
        seatTypes.length ===
        0
      ) {
        return "The selected screen has no active seats";
      }

      for (
        const seatType of
        seatTypes
      ) {
        const value =
          Number(
            pricing[
              seatType
            ]
          );

        if (
          !Number.isFinite(
            value
          ) ||
          value <= 0
        ) {
          return `Please enter a valid price for ${formatLabel(
            seatType
          )} seats`;
        }
      }

      return null;
    };

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (submitting) {
        return;
      }

      const validationError =
        validateBeforeSubmit();

      if (
        validationError
      ) {
        toast.error(
          validationError
        );

        return;
      }

      setSubmitting(
        true
      );

      const priceList =
        seatTypes.map(
          (
            seatType
          ) => ({
            seatType,

            price:
              Number(
                pricing[
                  seatType
                ]
              ),
          })
        );

      const results =
        await Promise.allSettled(
          showSlots.map(
            (
              slot
            ) =>
              axios.post(
                `${API_URL}/api/shows`,

                {
                  movie:
                    selectedMovie._id,

                  theatre:
                    selectedTheatreId,

                  screen:
                    selectedScreen._id,

                  startTime:
                    slot.startTimeIso,

                  endTime:
                    slot.endTimeIso,

                  language:
                    language.trim(),

                  format,

                  pricing:
                    priceList,
                },

                authConfig
              )
          )
        );

      const failedIndexes =
        [];

      let firstError =
        "";

      results.forEach(
        (
          result,
          index
        ) => {
          if (
            result.status ===
            "rejected"
          ) {
            failedIndexes.push(
              index
            );

            if (
              !firstError
            ) {
              firstError =
                result
                  .reason
                  ?.response
                  ?.data
                  ?.error ||
                result
                  .reason
                  ?.response
                  ?.data
                  ?.message ||
                "Failed to create one or more shows";
            }
          }
        }
      );

      const successCount =
        results.length -
        failedIndexes.length;

      if (
        failedIndexes.length ===
        0
      ) {
        toast.success(
          `${successCount} show${
            successCount ===
            1
              ? ""
              : "s"
          } added successfully!`
        );

        setShowSlots(
          []
        );
      } else {
        setShowSlots(
          (
            current
          ) =>
            current.filter(
              (
                _,
                index
              ) =>
                failedIndexes.includes(
                  index
                )
            )
        );

        toast.error(
          `${successCount} created, ${failedIndexes.length} failed. ${firstError}`
        );
      }

      setSubmitting(
        false
      );
    };

  if (
    loadingData
  ) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-500">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />

        Loading show data...
      </div>
    );
  }

  return (
    <div data-testid="add-show-page">
      <h1
        className="mb-8 text-4xl font-bold"
        data-testid="add-show-title"
      >
        Add Shows
      </h1>

      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-8"
      >
        <div>
          <h2 className="mb-4 text-2xl font-semibold">
            Select Movie
          </h2>

          {movies.length ===
          0 ? (
            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-6 text-zinc-500">
              No movies are available. Add a movie first.
            </div>
          ) : (
            <div
              className="flex space-x-4 overflow-x-auto pb-4"
              data-testid="movie-selection"
            >
              {movies.map(
                (
                  movie
                ) => (
                  <button
                    key={
                      movie._id
                    }
                    type="button"
                    onClick={() =>
                      handleMovieSelect(
                        movie
                      )
                    }
                    className={`w-40 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                      selectedMovie?._id ===
                      movie._id
                        ? "border-red-600"
                        : "border-white/10 hover:border-red-500"
                    }`}
                    data-testid={`movie-select-${movie._id}`}
                  >
                    <img
                      src={
                        movie.poster
                      }
                      alt={
                        movie.title
                      }
                      className="h-56 w-full object-cover"
                    />

                    <div className="bg-zinc-900 p-3">
                      <p className="line-clamp-1 text-sm font-semibold">
                        {
                          movie.title
                        }
                      </p>
                    </div>
                  </button>
                )
              )}
            </div>
          )}

          {selectedMovie && (
            <div className="mt-4 rounded-lg border border-white/10 bg-zinc-900/50 p-4">
              <p className="text-zinc-400">
                Selected:{" "}
                <span className="font-semibold text-white">
                  {
                    selectedMovie.title
                  }
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Theatre
            </label>

            <select
              value={
                selectedTheatreId
              }
              onChange={(
                event
              ) =>
                setSelectedTheatreId(
                  event
                    .target
                    .value
                )
              }
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            >
              <option value="">
                Select theatre
              </option>

              {theatres.map(
                (
                  theatre
                ) => (
                  <option
                    key={
                      theatre._id
                    }
                    value={
                      theatre._id
                    }
                  >
                    {
                      theatre.name
                    }{" "}
                    {theatre.city
                      ? `- ${theatre.city}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Screen
            </label>

            <select
              value={
                selectedScreen?._id ||
                ""
              }
              onChange={
                handleScreenChange
              }
              disabled={
                !selectedTheatreId ||
                loadingScreens
              }
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {loadingScreens
                  ? "Loading screens..."
                  : "Select screen"}
              </option>

              {screens.map(
                (
                  screen
                ) => (
                  <option
                    key={
                      screen._id
                    }
                    value={
                      screen._id
                    }
                  >
                    {screen.name ||
                      `Screen ${
                        screen.screenNumber ||
                        ""
                      }`}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Language
            </label>

            <input
              value={
                language
              }
              onChange={(
                event
              ) =>
                setLanguage(
                  event
                    .target
                    .value
                )
              }
              placeholder="Hindi"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Format
            </label>

            <select
              value={
                format
              }
              onChange={(
                event
              ) =>
                setFormat(
                  event
                    .target
                    .value
                )
              }
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            >
              {SHOW_FORMATS.map(
                (
                  item
                ) => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {
                      formatLabel(
                        item
                      )
                    }
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">
            Seat Pricing
          </h2>

          {!selectedScreen ? (
            <p className="text-sm text-zinc-500">
              Select a screen first.
            </p>
          ) : seatTypes.length ===
            0 ? (
            <p className="text-sm text-red-400">
              This screen has no active seats. Configure its seat layout first.
            </p>
          ) : (
            <div className="grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {seatTypes.map(
                (
                  seatType
                ) => (
                  <div
                    key={
                      seatType
                    }
                  >
                    <label className="mb-2 block text-sm text-zinc-400">
                      {
                        formatLabel(
                          seatType
                        )
                      }
                    </label>

                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={
                          pricing[
                            seatType
                          ] ??
                          ""
                        }
                        onChange={(
                          event
                        ) =>
                          setPricing(
                            (
                              current
                            ) => ({
                              ...current,

                              [seatType]:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                        placeholder="Price"
                        className="w-full rounded-lg border border-white/10 bg-zinc-900 py-3 pl-10 pr-4 outline-none focus:border-red-500"
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">
            Add Show Timings
          </h2>

          <div className="mb-4 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-4">
            <input
              type="date"
              min={
                localDateKey()
              }
              value={
                newSlot.date
              }
              onChange={(
                event
              ) =>
                setNewSlot(
                  (
                    current
                  ) => ({
                    ...current,

                    date:
                      event
                        .target
                        .value,
                  })
                )
              }
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
              data-testid="date-input"
            />

            <input
              type="time"
              value={
                newSlot.startTime
              }
              onChange={(
                event
              ) =>
                setNewSlot(
                  (
                    current
                  ) => ({
                    ...current,

                    startTime:
                      event
                        .target
                        .value,
                  })
                )
              }
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
              data-testid="start-time-input"
            />

            <input
              type="time"
              value={
                newSlot.endTime
              }
              onChange={(
                event
              ) =>
                setNewSlot(
                  (
                    current
                  ) => ({
                    ...current,

                    endTime:
                      event
                        .target
                        .value,
                  })
                )
              }
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
              data-testid="end-time-input"
            />

            <button
              type="button"
              onClick={
                addShowSlot
              }
              className="rounded-lg bg-red-600 px-6 py-3 font-semibold transition hover:bg-red-500 active:scale-95"
              data-testid="add-slot-button"
            >
              Add Slot
            </button>
          </div>

          <p className="mb-4 text-xs text-zinc-600">
            If the end time is earlier than the start time, BookMySeat treats it as the next day.
          </p>

          {showSlots.length >
            0 && (
            <div
              className="space-y-2"
              data-testid="show-slots-list"
            >
              <h3 className="mb-2 font-semibold">
                Added Slots:
              </h3>

              {showSlots.map(
                (
                  slot,
                  index
                ) => (
                  <div
                    key={`${slot.startTimeIso}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 p-4"
                    data-testid={`show-slot-${index}`}
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <Calendar className="h-5 w-5 text-red-500" />

                      <span>
                        {new Date(
                          `${slot.date}T00:00:00`
                        ).toLocaleDateString(
                          "en-IN",
                          {
                            year:
                              "numeric",

                            month:
                              "long",

                            day:
                              "numeric",
                          }
                        )}
                      </span>

                      <span className="text-zinc-400">
                        {
                          slot.startTime
                        }
                      </span>

                      <span className="text-zinc-600">
                        →
                      </span>

                      <span className="font-semibold">
                        {
                          slot.endTime
                        }
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeShowSlot(
                          index
                        )
                      }
                      className="text-red-500 hover:text-red-400"
                      data-testid={`remove-slot-${index}`}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={
            submitting
          }
          className="rounded-lg bg-red-600 px-8 py-3 font-semibold transition hover:bg-red-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="submit-shows-button"
        >
          {submitting
            ? "Adding Shows..."
            : "Add Shows"}
        </button>
      </form>
    </div>
  );
};

export default AddShow;