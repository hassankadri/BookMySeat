import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  Clock,
  Film,
  IndianRupee,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useAuth,
} from "../../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const FORMATS = [
  "STANDARD",
  "3D",
  "IMAX",
  "IMAX_3D",
  "4DX",
  "DOLBY_CINEMA",
];

const emptyForm = {
  movie: "",
  theatre: "",
  screen: "",
  language: "",
  format: "STANDARD",

  startTime: "",
  endTime: "",

  bookingOpensAt: "",
  bookingClosesAt: "",

  pricing: [],
};

// =====================================================
// HELPERS
// =====================================================

const toInputDateTime = (
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

  const pad = (
    number
  ) =>
    String(number).padStart(
      2,
      "0"
    );

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(
    date.getDate()
  )}T${pad(
    date.getHours()
  )}:${pad(
    date.getMinutes()
  )}`;
};

const toIso = (
  value
) => {
  if (!value) {
    return null;
  }

  return new Date(
    value
  ).toISOString();
};

const formatDateTime = (
  value
) => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    }
  ).format(date);
};

const statusStyle = (
  status
) => {
  switch (status) {
    case "SCHEDULED":
      return "bg-green-500/10 text-green-400";

    case "CANCELLED":
      return "bg-red-500/10 text-red-400";

    case "COMPLETED":
      return "bg-blue-500/10 text-blue-400";

    default:
      return "bg-zinc-800 text-zinc-400";
  }
};

// =====================================================
// PAGE
// =====================================================

const AdminShows = () => {
  const {
    token,
  } = useAuth();

  const [
    shows,
    setShows,
  ] = useState([]);

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
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingShow,
    setEditingShow,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState(
    emptyForm
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  // ===================================================
  // LOAD EVERYTHING
  // ===================================================

  const fetchData =
    async () => {
      setLoading(true);

      try {
        const [
          showResponse,
          movieResponse,
          theatreResponse,
          screenResponse,
        ] =
          await Promise.all([
            axios.get(
              `${API_URL}/api/admin/shows`,
              {
                params: {
                  limit: 100,
                },

                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            ),

            axios.get(
              `${API_URL}/api/admin/movies`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            ),

            axios.get(
              `${API_URL}/api/admin/theatres`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            ),

            axios.get(
              `${API_URL}/api/admin/screens`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            ),
          ]);

        setShows(
          showResponse.data
            .shows || []
        );

        setMovies(
          movieResponse.data
            .movies || []
        );

        setTheatres(
          theatreResponse.data
            .theatres || []
        );

        setScreens(
          screenResponse.data
            .screens || []
        );
      } catch (error) {
        console.error(
          "Shows load error:",
          error
        );

        toast.error(
          "Could not load show management."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, [token]);

  // ===================================================
  // FILTER SCREENS BY THEATRE
  // ===================================================

  const availableScreens =
    useMemo(() => {
      if (
        !form.theatre
      ) {
        return [];
      }

      return screens.filter(
        (screen) => {
          const theatreId =
            screen.theatre
              ?._id ||
            screen.theatre;

          return (
            String(
              theatreId
            ) ===
              String(
                form.theatre
              ) &&
            screen.isActive !==
              false
          );
        }
      );
    }, [
      screens,
      form.theatre,
    ]);

  // ===================================================
  // SEARCH LIST
  // ===================================================

  const filteredShows =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return shows;
      }

      return shows.filter(
        (show) =>
          show.movie?.title
            ?.toLowerCase()
            .includes(query) ||
          show.theatre?.name
            ?.toLowerCase()
            .includes(query) ||
          show.screen?.name
            ?.toLowerCase()
            .includes(query) ||
          show.language
            ?.toLowerCase()
            .includes(query) ||
          show.format
            ?.toLowerCase()
            .includes(query)
      );
    }, [
      shows,
      search,
    ]);

  // ===================================================
  // CREATE PRICING FROM PHYSICAL SCREEN
  // ===================================================

  const createPricingForScreen =
    (
      screenId,
      existing = []
    ) => {
      const screen =
        screens.find(
          (item) =>
            String(
              item._id
            ) ===
            String(
              screenId
            )
        );

      if (
        !screen ||
        !Array.isArray(
          screen.seats
        )
      ) {
        return [];
      }

      const seatTypes = [
        ...new Set(
          screen.seats
            .filter(
              (seat) =>
                seat.isActive !==
                false
            )
            .map(
              (seat) =>
                seat.type
            )
        ),
      ];

      return seatTypes.map(
        (seatType) => {
          const previous =
            existing.find(
              (item) =>
                item.seatType ===
                seatType
            );

          return {
            seatType,

            price:
              previous?.price ??
              "",
          };
        }
      );
    };

  // ===================================================
  // ADD SHOW
  // ===================================================

  const openAdd =
    () => {
      setEditingShow(
        null
      );

      setForm({
        ...emptyForm,
        pricing: [],
      });

      setModalOpen(true);
    };

  // ===================================================
  // EDIT SHOW
  // ===================================================

  const openEdit =
    (show) => {
      const theatreId =
        show.theatre?._id ||
        show.theatre ||
        "";

      const screenId =
        show.screen?._id ||
        show.screen ||
        "";

      setEditingShow(
        show
      );

      setForm({
        movie:
          show.movie?._id ||
          show.movie ||
          "",

        theatre:
          theatreId,

        screen:
          screenId,

        language:
          show.language || "",

        format:
          show.format ||
          "STANDARD",

        startTime:
          toInputDateTime(
            show.startTime
          ),

        endTime:
          toInputDateTime(
            show.endTime
          ),

        bookingOpensAt:
          toInputDateTime(
            show.bookingOpensAt
          ),

        bookingClosesAt:
          toInputDateTime(
            show.bookingClosesAt
          ),

        pricing:
          createPricingForScreen(
            screenId,
            show.pricing ||
              []
          ),
      });

      setModalOpen(true);
    };

  // ===================================================
  // INPUT
  // ===================================================

  const handleChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      // Theatre changed:
      // reset screen because screens belong to theatres.
      if (
        name ===
        "theatre"
      ) {
        setForm(
          (current) => ({
            ...current,

            theatre:
              value,

            screen: "",

            pricing: [],
          })
        );

        return;
      }

      // Screen changed:
      // automatically detect its physical seat categories.
      if (
        name ===
        "screen"
      ) {
        const screen =
          screens.find(
            (item) =>
              String(
                item._id
              ) ===
              String(value)
          );

        setForm(
          (current) => ({
            ...current,

            screen:
              value,

            format:
              screen?.format ||
              current.format,

            pricing:
              createPricingForScreen(
                value
              ),
          })
        );

        return;
      }

      setForm(
        (current) => ({
          ...current,

          [name]:
            value,
        })
      );
    };

  // ===================================================
  // UPDATE PRICE
  // ===================================================

  const updatePrice =
    (
      seatType,
      value
    ) => {
      setForm(
        (current) => ({
          ...current,

          pricing:
            current.pricing.map(
              (item) =>
                item.seatType ===
                seatType
                  ? {
                      ...item,

                      price:
                        value,
                    }
                  : item
            ),
        })
      );
    };

  // ===================================================
  // SAVE SHOW
  // ===================================================

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        form.pricing.length ===
        0
      ) {
        toast.error(
          "Selected screen has no active seat categories."
        );

        return;
      }

      const invalidPrice =
        form.pricing.some(
          (item) =>
            item.price ===
              "" ||
            Number(
              item.price
            ) < 0
        );

      if (
        invalidPrice
      ) {
        toast.error(
          "Enter a valid price for every seat type."
        );

        return;
      }

      if (
        new Date(
          form.endTime
        ) <=
        new Date(
          form.startTime
        )
      ) {
        toast.error(
          "End time must be after start time."
        );

        return;
      }

      setSaving(true);

      try {
        const payload = {
          movie:
            form.movie,

          theatre:
            form.theatre,

          screen:
            form.screen,

          language:
            form.language.trim(),

          format:
            form.format,

          startTime:
            toIso(
              form.startTime
            ),

          endTime:
            toIso(
              form.endTime
            ),

          pricing:
            form.pricing.map(
              (item) => ({
                seatType:
                  item.seatType,

                price:
                  Number(
                    item.price
                  ),
              })
            ),

          bookingOpensAt:
            form.bookingOpensAt
              ? toIso(
                  form.bookingOpensAt
                )
              : null,

          bookingClosesAt:
            form.bookingClosesAt
              ? toIso(
                  form.bookingClosesAt
                )
              : null,
        };

        if (
          editingShow
        ) {
          await axios.put(
            `${API_URL}/api/shows/${editingShow._id}`,

            payload,

            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

          toast.success(
            "Show updated."
          );
        } else {
          await axios.post(
            `${API_URL}/api/shows`,

            payload,

            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

          toast.success(
            "Show created."
          );
        }

        setModalOpen(false);

        setEditingShow(
          null
        );

        await fetchData();
      } catch (error) {
        console.error(
          "Save show error:",
          error
        );

        toast.error(
          error.response
            ?.data
            ?.message ||
            error.response
              ?.data
              ?.error ||
            "Could not save show."
        );
      } finally {
        setSaving(false);
      }
    };

  // ===================================================
  // CANCEL
  // ===================================================

  const cancelShow =
    async (
      show
    ) => {
      const confirmed =
        window.confirm(
          `Cancel ${show.movie?.title || "this show"} at ${formatDateTime(
            show.startTime
          )}?`
        );

      if (!confirmed) {
        return;
      }

      try {
        await axios.delete(
          `${API_URL}/api/shows/${show._id}`,

          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        toast.success(
          "Show cancelled."
        );

        await fetchData();
      } catch (error) {
        toast.error(
          error.response
            ?.data
            ?.message ||
            "Could not cancel show."
        );
      }
    };

  // ===================================================
  // UI
  // ===================================================

  return (
    <div>

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

        <div>

          <p className="text-sm uppercase tracking-[0.3em] text-red-500">
            Scheduling
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Shows
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Schedule screenings, control pricing and manage show timings.
          </p>

        </div>

        <motion.button
          whileHover={{
            scale: 1.02,
          }}
          whileTap={{
            scale: 0.97,
          }}
          onClick={
            openAdd
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold hover:bg-red-500"
        >
          <Plus className="h-5 w-5" />

          Add Show
        </motion.button>

      </div>

      {/* SEARCH */}

      <div className="relative mt-8 max-w-md">

        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

        <input
          value={search}
          onChange={(
            event
          ) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search movie, theatre, screen..."
          className="w-full rounded-xl border border-white/10 bg-zinc-900 py-3 pl-11 pr-4 text-sm outline-none focus:border-red-500"
        />

      </div>

      {/* LIST */}

      {loading ? (
        <div className="py-24 text-center text-zinc-500">
          Loading shows...
        </div>
      ) : filteredShows.length ===
        0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 py-24 text-center">

          <CalendarDays className="mx-auto h-10 w-10 text-zinc-700" />

          <p className="mt-4 text-zinc-500">
            No shows found.
          </p>

        </div>
      ) : (
        <div className="mt-8 space-y-4">

          {filteredShows.map(
            (
              show,
              index
            ) => (
              <motion.div
                key={
                  show._id
                }
                initial={{
                  opacity: 0,
                  y: 15,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay:
                    Math.min(
                      index *
                        0.025,
                      0.25
                    ),
                }}
                className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 transition hover:border-red-500/20"
              >

                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                  {/* MOVIE */}

                  <div className="flex min-w-0 items-center gap-4">

                    {show.movie
                      ?.poster ? (
                      <img
                        src={
                          show.movie
                            .poster
                        }
                        alt={
                          show.movie
                            .title
                        }
                        className="h-20 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-14 items-center justify-center rounded-lg bg-black/30">
                        <Film className="h-5 w-5 text-zinc-700" />
                      </div>
                    )}

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <h2 className="font-semibold">
                          {show.movie
                            ?.title ||
                            "Unknown Movie"}
                        </h2>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${statusStyle(
                            show.status
                          )}`}
                        >
                          {show.status}
                        </span>

                      </div>

                      <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">

                        <MapPin className="h-4 w-4 text-red-500" />

                        <span>
                          {show.theatre
                            ?.name ||
                            "Unknown Theatre"}

                          {" • "}

                          {show.screen
                            ?.name ||
                            "Unknown Screen"}
                        </span>

                      </div>

                    </div>

                  </div>

                  {/* DETAILS */}

                  <div className="grid gap-3 sm:grid-cols-4 xl:min-w-[620px]">

                    <div className="rounded-xl bg-black/20 p-3">

                      <p className="text-xs text-zinc-600">
                        Starts
                      </p>

                      <p className="mt-1 text-xs font-medium sm:text-sm">
                        {formatDateTime(
                          show.startTime
                        )}
                      </p>

                    </div>

                    <div className="rounded-xl bg-black/20 p-3">

                      <p className="text-xs text-zinc-600">
                        Language
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        {
                          show.language
                        }
                      </p>

                    </div>

                    <div className="rounded-xl bg-black/20 p-3">

                      <p className="text-xs text-zinc-600">
                        Format
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        {
                          show.format
                        }
                      </p>

                    </div>

                    <div className="rounded-xl bg-black/20 p-3">

                      <p className="text-xs text-zinc-600">
                        From
                      </p>

                      <p className="mt-1 flex items-center gap-1 text-sm font-medium">

                        <IndianRupee className="h-3.5 w-3.5" />

                        {Math.min(
                          ...(
                            show.pricing ||
                            []
                          ).map(
                            (
                              item
                            ) =>
                              item.price
                          ),
                          show.price ||
                            0
                        )}

                      </p>

                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="flex gap-2">

                    <button
                      disabled={
                        show.status ===
                        "CANCELLED"
                      }
                      onClick={() =>
                        openEdit(
                          show
                        )
                      }
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Pencil className="h-4 w-4" />

                      Edit
                    </button>

                    <button
                      disabled={
                        show.status ===
                        "CANCELLED"
                      }
                      onClick={() =>
                        cancelShow(
                          show
                        )
                      }
                      className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />

                      Cancel
                    </button>

                  </div>

                </div>

              </motion.div>
            )
          )}

        </div>
      )}

      {/* ===============================================
          MODAL
      ================================================ */}

      <AnimatePresence>

        {modalOpen && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >

            <motion.div
              initial={{
                opacity: 0,
                scale: 0.96,
                y: 20,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
              }}
              className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111113]"
            >

              {/* MODAL HEADER */}

              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#111113]/95 px-6 py-5 backdrop-blur-xl">

                <div>

                  <p className="text-xs uppercase tracking-[0.25em] text-red-500">
                    Show Management
                  </p>

                  <h2 className="mt-1 text-xl font-bold">
                    {editingShow
                      ? "Edit Show"
                      : "Schedule New Show"}
                  </h2>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(
                      false
                    )
                  }
                  className="rounded-xl border border-white/10 p-2 text-zinc-500 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-8 p-6"
              >

                {/* MOVIE */}

                <div>

                  <label className="mb-2 block text-sm text-zinc-400">
                    Movie
                  </label>

                  <select
                    name="movie"
                    value={
                      form.movie
                    }
                    onChange={
                      handleChange
                    }
                    required
                    className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
                  >

                    <option value="">
                      Select movie
                    </option>

                    {movies.map(
                      (movie) => (
                        <option
                          key={
                            movie._id
                          }
                          value={
                            movie._id
                          }
                        >
                          {
                            movie.title
                          }
                        </option>
                      )
                    )}

                  </select>

                </div>

                {/* THEATRE + SCREEN */}

                <div className="grid gap-5 md:grid-cols-2">

                  <div>

                    <label className="mb-2 block text-sm text-zinc-400">
                      Theatre
                    </label>

                    <select
                      name="theatre"
                      value={
                        form.theatre
                      }
                      onChange={
                        handleChange
                      }
                      required
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
                    >

                      <option value="">
                        Select theatre
                      </option>

                      {theatres
                        .filter(
                          (
                            theatre
                          ) =>
                            theatre.isActive !==
                            false
                        )
                        .map(
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
                              —{" "}
                              {
                                theatre.city
                              }
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
                      name="screen"
                      value={
                        form.screen
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        !form.theatre
                      }
                      required
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500 disabled:opacity-40"
                    >

                      <option value="">
                        Select screen
                      </option>

                      {availableScreens.map(
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
                            {
                              screen.name
                            }{" "}
                            —{" "}
                            {
                              screen.format
                            }{" "}
                            —{" "}
                            {
                              screen.totalSeats
                            } seats
                          </option>
                        )
                      )}

                    </select>

                  </div>

                </div>

                {/* LANGUAGE + FORMAT */}

                <div className="grid gap-5 md:grid-cols-2">

                  <div>

                    <label className="mb-2 block text-sm text-zinc-400">
                      Language
                    </label>

                    <input
                      name="language"
                      value={
                        form.language
                      }
                      onChange={
                        handleChange
                      }
                      required
                      placeholder="Hindi"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-red-500"
                    />

                  </div>

                  <div>

                    <label className="mb-2 block text-sm text-zinc-400">
                      Format
                    </label>

                    <select
                      name="format"
                      value={
                        form.format
                      }
                      onChange={
                        handleChange
                      }
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
                    >

                      {FORMATS.map(
                        (
                          format
                        ) => (
                          <option
                            key={
                              format
                            }
                            value={
                              format
                            }
                          >
                            {
                              format
                            }
                          </option>
                        )
                      )}

                    </select>

                  </div>

                </div>

                {/* SHOW TIME */}

                <div>

                  <div className="mb-4">

                    <h3 className="font-semibold">
                      Show Timing
                    </h3>

                    <p className="mt-1 text-xs text-zinc-600">
                      Overlapping shows on the same screen are automatically rejected.
                    </p>

                  </div>

                  <div className="grid gap-5 md:grid-cols-2">

                    <div>

                      <label className="mb-2 block text-sm text-zinc-400">
                        Start Time
                      </label>

                      <input
                        type="datetime-local"
                        name="startTime"
                        value={
                          form.startTime
                        }
                        onChange={
                          handleChange
                        }
                        required
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-red-500"
                      />

                    </div>

                    <div>

                      <label className="mb-2 block text-sm text-zinc-400">
                        End Time
                      </label>

                      <input
                        type="datetime-local"
                        name="endTime"
                        value={
                          form.endTime
                        }
                        onChange={
                          handleChange
                        }
                        required
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-red-500"
                      />

                    </div>

                  </div>

                </div>

                {/* PRICING */}

                <div className="border-t border-white/10 pt-7">

                  <h3 className="font-semibold">
                    Seat Pricing
                  </h3>

                  <p className="mt-1 text-sm text-zinc-600">
                    Prices are generated from the physical seat types in the selected screen.
                  </p>

                  {!form.screen ? (
                    <div className="mt-5 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-600">
                      Select a screen first.
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">

                      {form.pricing.map(
                        (
                          price
                        ) => (
                          <div
                            key={
                              price.seatType
                            }
                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                          >

                            <label className="text-xs font-medium text-zinc-500">
                              {
                                price.seatType
                              }
                            </label>

                            <div className="relative mt-2">

                              <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

                              <input
                                type="number"
                                min="0"
                                value={
                                  price.price
                                }
                                onChange={(
                                  event
                                ) =>
                                  updatePrice(
                                    price.seatType,
                                    event
                                      .target
                                      .value
                                  )
                                }
                                required
                                placeholder="250"
                                className="w-full rounded-lg border border-white/10 bg-zinc-900 py-3 pl-9 pr-3 outline-none focus:border-red-500"
                              />

                            </div>

                          </div>
                        )
                      )}

                    </div>
                  )}

                </div>

                {/* BOOKING WINDOW */}

                <div className="border-t border-white/10 pt-7">

                  <div className="mb-4">

                    <h3 className="font-semibold">
                      Booking Window
                    </h3>

                    <p className="mt-1 text-xs text-zinc-600">
                      Optional. Leave empty to use the normal booking availability.
                    </p>

                  </div>

                  <div className="grid gap-5 md:grid-cols-2">

                    <div>

                      <label className="mb-2 block text-sm text-zinc-400">
                        Booking Opens
                      </label>

                      <input
                        type="datetime-local"
                        name="bookingOpensAt"
                        value={
                          form.bookingOpensAt
                        }
                        onChange={
                          handleChange
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-red-500"
                      />

                    </div>

                    <div>

                      <label className="mb-2 block text-sm text-zinc-400">
                        Booking Closes
                      </label>

                      <input
                        type="datetime-local"
                        name="bookingClosesAt"
                        value={
                          form.bookingClosesAt
                        }
                        onChange={
                          handleChange
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-red-500"
                      />

                    </div>

                  </div>

                </div>

                {/* SAVE */}

                <div className="flex justify-end gap-3 border-t border-white/10 pt-6">

                  <button
                    type="button"
                    onClick={() =>
                      setModalOpen(
                        false
                      )
                    }
                    className="rounded-xl border border-white/10 px-6 py-3 text-sm text-zinc-400 hover:bg-white/5"
                  >
                    Cancel
                  </button>

                  <motion.button
                    whileTap={{
                      scale: 0.97,
                    }}
                    disabled={
                      saving
                    }
                    type="submit"
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
                  >

                    <Save className="h-4 w-4" />

                    {saving
                      ? "Saving..."
                      : editingShow
                      ? "Save Changes"
                      : "Create Show"}

                  </motion.button>

                </div>

              </form>

            </motion.div>

          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
};

export default AdminShows;