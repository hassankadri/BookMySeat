
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import axios from "axios";
import toast from "react-hot-toast";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  CalendarClock,
  IndianRupee,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import ShowQueueControls from "../../components/admin/ShowQueueControls";

const API = (
  process.env.REACT_APP_BACKEND_URL || ""
).replace(/\/+$/, "");

const ZONE = "Asia/Kolkata";

const INPUT =
  "w-full rounded-xl border border-white/10 bg-[#222227] px-4 py-3 text-sm text-white outline-none focus:border-[#D71935]/70 disabled:opacity-50";

const FORMATS = [
  "STANDARD",
  "3D",
  "IMAX",
  "IMAX_3D",
  "4DX",
  "DOLBY_CINEMA",
];

const idOf = (item) =>
  String(
    item && typeof item === "object"
      ? item._id || ""
      : item || ""
  );

const fresh = () => ({
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
});

const pad = (value) =>
  String(value).padStart(2, "0");

function dateKey(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: ZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).formatToParts(date);

  const find = (type) =>
    parts.find(
      (part) => part.type === type
    )?.value || "";

  return `${find("year")}-${find("month")}-${find("day")}`;
}

function dateHeading(value) {
  return new Intl.DateTimeFormat(
    "en-IN",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: ZONE,
    }
  ).format(
    new Date(`${value}T12:00:00+05:30`)
  );
}

function time(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone: ZONE,
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(new Date(value));
}

function inputDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function pricingFor(
  screen,
  previous = []
) {
  const types = [
    ...new Set(
      (screen?.seats || [])
        .filter(
          (seat) =>
            seat.isActive !== false
        )
        .map((seat) => seat.type)
        .filter(Boolean)
    ),
  ];

  return types.map((seatType) => ({
    seatType,

    price:
      previous.find(
        (item) =>
          item.seatType === seatType
      )?.price ?? "",
  }));
}

function priceFrom(show) {
  const values = (
    show.pricing || []
  )
    .map((item) =>
      Number(item.price)
    )
    .filter(
      (price) =>
        Number.isFinite(price) &&
        price >= 0
    );

  if (values.length) {
    return `₹${Math.min(
      ...values
    ).toLocaleString("en-IN")}`;
  }

  const oldPrice = Number(
    show.price
  );

  return show.price != null &&
    Number.isFinite(oldPrice)
    ? `₹${oldPrice.toLocaleString("en-IN")}`
    : "—";
}

// =====================================================
// STATUS
// =====================================================

function Status({ value }) {
  const classes = {
    SCHEDULED:
      "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",

    CANCELLED:
      "border-red-400/25 bg-red-400/10 text-red-300",

    COMPLETED:
      "border-sky-400/25 bg-sky-400/10 text-sky-300",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em] ${
        classes[value] ||
        "border-white/10 text-zinc-400"
      }`}
    >
      {value || "SCHEDULED"}
    </span>
  );
}

function Field({
  title,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[.13em] text-zinc-400">
        {title}
      </span>

      {children}
    </label>
  );
}

// =====================================================
// EXISTING SHOW EDITOR
// =====================================================

function ShowEditor({
  show,
  token,
  movies,
  theatres,
  screens,
  onClose,
  onSaved,
}) {
  const editing = Boolean(
    show?._id
  );

  const [form, setForm] =
    useState(fresh);

  const [saving, setSaving] =
    useState(false);

  const [
    screenLoading,
    setScreenLoading,
  ] = useState(false);

  const [step, setStep] =
    useState("screening");

  const [
    fullScreen,
    setFullScreen,
  ] = useState(null);

  const availableScreens = useMemo(
    () =>
      screens.filter(
        (screen) =>
          idOf(screen.theatre) ===
            form.theatre &&
          (
            screen.isActive !== false ||
            idOf(screen) === form.screen
          )
      ),
    [
      screens,
      form.theatre,
      form.screen,
    ]
  );

  const auth = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    [token]
  );

  const fetchFullScreen = useCallback(
    async (id) => {
      const found = screens.find(
        (item) => item._id === id
      );

      if (
        Array.isArray(found?.seats) &&
        found.seats.length > 0
      ) {
        return found;
      }

      const { data } = await axios.get(
        `${API}/api/screens/${id}`,
        auth
      );

      return data.screen || data;
    },
    [screens, auth]
  );

  useEffect(() => {
    if (!show) return;

    const next = editing
      ? {
          movie: idOf(show.movie),
          theatre: idOf(show.theatre),
          screen: idOf(show.screen),
          language:
            show.language || "",
          format:
            show.format || "STANDARD",
          startTime:
            inputDateTime(
              show.startTime
            ),
          endTime:
            inputDateTime(
              show.endTime
            ),
          bookingOpensAt:
            inputDateTime(
              show.bookingOpensAt
            ),
          bookingClosesAt:
            inputDateTime(
              show.bookingClosesAt
            ),
          pricing: (
            show.pricing || []
          ).map(
            ({
              seatType,
              price,
            }) => ({
              seatType,
              price,
            })
          ),
        }
      : fresh();

    setForm(next);
    setStep("screening");
    setFullScreen(null);

    if (
      !editing ||
      !next.screen
    ) {
      return;
    }

    let current = true;

    setScreenLoading(true);

    fetchFullScreen(next.screen)
      .then((screen) => {
        if (current) {
          setFullScreen(screen);

          setForm((before) =>
            before.screen === next.screen
              ? {
                  ...before,
                  pricing: pricingFor(
                    screen,
                    next.pricing
                  ),
                }
              : before
          );
        }
      })
      .catch(() => {
        if (current) {
          toast.error(
            "Could not load saved seat categories."
          );
        }
      })
      .finally(() => {
        if (current) {
          setScreenLoading(false);
        }
      });

    return () => {
      current = false;
    };
  }, [
    show,
    editing,
    fetchFullScreen,
  ]);

  useEffect(() => {
    const before =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const onKey = (event) => {
      if (
        event.key === "Escape" &&
        !saving
      ) {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      onKey
    );

    return () => {
      document.body.style.overflow =
        before;

      document.removeEventListener(
        "keydown",
        onKey
      );
    };
  }, [
    saving,
    onClose,
  ]);

  const change = (event) => {
    const {
      name,
      value,
    } = event.target;

    if (name === "theatre") {
      setFullScreen(null);

      setForm((previous) => ({
        ...previous,
        theatre: value,
        screen: "",
        pricing: [],
      }));

      return;
    }

    if (name === "screen") {
      setForm((previous) => ({
        ...previous,
        screen: value,
        pricing: [],
      }));

      setFullScreen(null);

      if (!value) return;

      setScreenLoading(true);

      fetchFullScreen(value)
        .then((screen) => {
          setFullScreen(screen);

          setForm((previous) =>
            previous.screen === value
              ? {
                  ...previous,
                  format:
                    screen.format ||
                    previous.format,
                  pricing:
                    pricingFor(screen),
                }
              : previous
          );
        })
        .catch(() =>
          toast.error(
            "Unable to load screen seating."
          )
        )
        .finally(() =>
          setScreenLoading(false)
        );

      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const save = async (event) => {
    event.preventDefault();

    if (
      saving ||
      screenLoading
    ) {
      return;
    }

    if (
      !form.movie ||
      !form.theatre ||
      !form.screen ||
      !form.language.trim()
    ) {
      toast.error(
        "Complete the movie, theatre, screen and language."
      );

      setStep("screening");
      return;
    }

    const start = new Date(
      form.startTime
    );

    const end = new Date(
      form.endTime
    );

    if (
      !form.startTime ||
      !form.endTime ||
      !Number.isFinite(
        start.getTime()
      ) ||
      !Number.isFinite(
        end.getTime()
      ) ||
      start >= end
    ) {
      toast.error(
        "Enter valid screening start and end times."
      );

      setStep("timing");
      return;
    }

    if (
      !editing &&
      start.getTime() <= Date.now()
    ) {
      toast.error(
        "New screenings must be in the future."
      );

      setStep("timing");
      return;
    }

    const open = form.bookingOpensAt
      ? new Date(
          form.bookingOpensAt
        )
      : null;

    const close =
      form.bookingClosesAt
        ? new Date(
            form.bookingClosesAt
          )
        : null;

    if (
      (
        open &&
        !Number.isFinite(
          open.getTime()
        )
      ) ||
      (
        close &&
        !Number.isFinite(
          close.getTime()
        )
      ) ||
      (
        open &&
        close &&
        open >= close
      ) ||
      (
        open &&
        open > start
      ) ||
      (
        close &&
        close > start
      )
    ) {
      toast.error(
        "Booking window must finish before the screening."
      );

      setStep("timing");
      return;
    }

    if (
      !form.pricing.length ||
      form.pricing.some(
        (item) =>
          item.price === "" ||
          !Number.isFinite(
            Number(item.price)
          ) ||
          Number(item.price) <= 0
      )
    ) {
      toast.error(
        "Every active seat type needs a valid price."
      );

      setStep("pricing");
      return;
    }

    if (
      editing &&
      !window.confirm(
        "Save changes to this scheduled show? Changing times or prices may affect existing bookings. The backend must validate this update."
      )
    ) {
      return;
    }

    const payload = {
      movie: form.movie,
      theatre: form.theatre,
      screen: form.screen,
      language:
        form.language.trim(),
      format: form.format,
      startTime:
        start.toISOString(),
      endTime:
        end.toISOString(),
      bookingOpensAt:
        open
          ? open.toISOString()
          : null,
      bookingClosesAt:
        close
          ? close.toISOString()
          : null,
      pricing:
        form.pricing.map(
          (item) => ({
            seatType:
              item.seatType,
            price:
              Number(item.price),
          })
        ),
    };

    setSaving(true);

    try {
      if (editing) {
        await axios.put(
          `${API}/api/shows/${show._id}`,
          payload,
          auth
        );
      } else {
        await axios.post(
          `${API}/api/shows`,
          payload,
          auth
        );
      }

      toast.success(
        editing
          ? "Screening updated."
          : "Screening created."
      );

      await onSaved();
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Could not save screening."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
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
      className="fixed inset-0 z-[115] flex justify-end"
    >
      <button
        aria-label="Close screening editor"
        type="button"
        disabled={saving}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={
          editing
            ? "Edit show"
            : "Create show"
        }
        initial={{
          x: "100%",
        }}
        animate={{
          x: 0,
        }}
        exit={{
          x: "100%",
        }}
        transition={{
          duration: 0.36,
        }}
        className="relative flex h-full w-full max-w-[780px] flex-col border-l border-white/10 bg-[#141417] text-white"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5 sm:px-9">
          <div>
            <p className="text-[10px] uppercase tracking-[.21em] text-[#ff617a]">
              Programming desk / Editor
            </p>

            <h2 className="mt-1 text-2xl font-semibold">
              {editing
                ? "Edit a screening"
                : "Schedule a screening"}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
            className="rounded-full border border-white/15 p-3"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="flex shrink-0 gap-1 border-b border-white/10 px-6 sm:px-9"
          role="tablist"
          aria-label="Show editor sections"
        >
          {[
            [
              "screening",
              "01  Film & cinema",
            ],
            [
              "timing",
              "02  Timings",
            ],
            [
              "pricing",
              "03  Pricing",
            ],
          ].map(
            ([
              key,
              name,
            ]) => (
              <button
                type="button"
                key={key}
                role="tab"
                aria-selected={
                  step === key
                }
                onClick={() =>
                  setStep(key)
                }
                className={`border-b-2 px-3 py-4 text-[11px] font-semibold ${
                  step === key
                    ? "border-[#D71935] text-white"
                    : "border-transparent text-zinc-500"
                }`}
              >
                {name}
              </button>
            )
          )}
        </div>

        <form
          noValidate
          onSubmit={save}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-9">
            {/* SCREENING */}

            <div
              hidden={
                step !== "screening"
              }
              className="space-y-5"
            >
              <Field title="Movie">
                <select
                  name="movie"
                  required
                  disabled={editing}
                  value={form.movie}
                  onChange={change}
                  className={INPUT}
                >
                  <option value="">
                    Choose movie
                  </option>

                  {movies
                    .filter(
                      (movie) =>
                        movie.listingStatus !==
                          "HIDDEN" ||
                        movie._id ===
                          form.movie
                    )
                    .map(
                      (movie) => (
                        <option
                          key={
                            movie._id
                          }
                          value={
                            movie._id
                          }
                        >
                          {movie.title}
                        </option>
                      )
                    )}
                </select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field title="Cinema">
                  <select
                    required
                    name="theatre"
                    disabled={editing}
                    value={form.theatre}
                    onChange={change}
                    className={INPUT}
                  >
                    <option value="">
                      Choose cinema
                    </option>

                    {theatres
                      .filter(
                        (theatre) =>
                          theatre.isActive !==
                            false ||
                          theatre._id ===
                            form.theatre
                      )
                      .map(
                        (theatre) => (
                          <option
                            key={
                              theatre._id
                            }
                            value={
                              theatre._id
                            }
                          >
                            {theatre.name}
                          </option>
                        )
                      )}
                  </select>
                </Field>

                <Field title="Screen">
                  <select
                    required
                    name="screen"
                    disabled={
                      editing ||
                      !form.theatre ||
                      screenLoading
                    }
                    value={form.screen}
                    onChange={change}
                    className={INPUT}
                  >
                    <option value="">
                      {screenLoading
                        ? "Loading seats..."
                        : "Choose screen"}
                    </option>

                    {availableScreens.map(
                      (screen) => (
                        <option
                          key={
                            screen._id
                          }
                          value={
                            screen._id
                          }
                        >
                          {screen.name}
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field title="Language">
                  <input
                    required
                    name="language"
                    value={form.language}
                    onChange={change}
                    className={INPUT}
                    placeholder="Hindi"
                  />
                </Field>

                <Field title="Projection">
                  <select
                    name="format"
                    value={form.format}
                    onChange={change}
                    className={INPUT}
                  >
                    {FORMATS.map(
                      (format) => (
                        <option
                          key={format}
                          value={format}
                        >
                          {format.replaceAll(
                            "_",
                            " "
                          )}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </div>

              {editing && (
                <p className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-xs leading-5 text-zinc-400">
                  The film, cinema and screen
                  are locked for existing shows
                  to avoid moving already-sold
                  tickets to another room.
                </p>
              )}
            </div>

            {/* TIMING */}

            <div
              hidden={
                step !== "timing"
              }
              className="space-y-6"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field title="Starts">
                  <input
                    required
                    name="startTime"
                    type="datetime-local"
                    value={
                      form.startTime
                    }
                    onChange={change}
                    className={INPUT}
                  />
                </Field>

                <Field title="Ends">
                  <input
                    required
                    name="endTime"
                    type="datetime-local"
                    value={
                      form.endTime
                    }
                    onChange={change}
                    className={INPUT}
                  />
                </Field>
              </div>

              <div className="border-t border-white/10 pt-6">
                <p className="mb-4 text-sm font-semibold">
                  Booking window{" "}

                  <span className="text-xs font-normal text-zinc-500">
                    (optional)
                  </span>
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field title="Booking opens">
                    <input
                      name="bookingOpensAt"
                      type="datetime-local"
                      value={
                        form.bookingOpensAt
                      }
                      onChange={
                        change
                      }
                      className={
                        INPUT
                      }
                    />
                  </Field>

                  <Field title="Booking closes">
                    <input
                      name="bookingClosesAt"
                      type="datetime-local"
                      value={
                        form.bookingClosesAt
                      }
                      onChange={
                        change
                      }
                      className={
                        INPUT
                      }
                    />
                  </Field>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-4 text-xs leading-6 text-amber-200">
                <ShieldAlert
                  className="shrink-0"
                  size={18}
                />

                Changing a scheduled show can affect
                customer bookings. Backend validation
                remains authoritative.
              </div>
            </div>

            {/* PRICING */}

            <div
              hidden={
                step !== "pricing"
              }
              className="space-y-4"
            >
              <p className="text-sm leading-6 text-zinc-400">
                Ticket rates are determined by the
                selected screen's real, active seat
                categories.

                {fullScreen?.name
                  ? ` ${fullScreen.name} · ${
                      (
                        fullScreen.seats ||
                        []
                      ).length
                    } seats.`
                  : ""}
              </p>

              {form.pricing.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {form.pricing.map(
                    (item) => (
                      <Field
                        key={
                          item.seatType
                        }
                        title={item.seatType.replaceAll(
                          "_",
                          " "
                        )}
                      >
                        <div className="relative">
                          <IndianRupee
                            size={15}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                          />

                          <input
                            aria-label={`${item.seatType} price`}
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={
                              item.price
                            }
                            onChange={(
                              event
                            ) =>
                              setForm(
                                (
                                  previous
                                ) => ({
                                  ...previous,

                                  pricing:
                                    previous.pricing.map(
                                      (
                                        price
                                      ) =>
                                        price.seatType ===
                                        item.seatType
                                          ? {
                                              ...price,
                                              price:
                                                event
                                                  .target
                                                  .value,
                                            }
                                          : price
                                    ),
                                })
                              )
                            }
                            className={`${INPUT} pl-10`}
                          />
                        </div>
                      </Field>
                    )
                  )}
                </div>
              ) : (
                <p className="rounded-xl border border-white/10 p-6 text-xs text-zinc-500">
                  {screenLoading
                    ? "Loading screen configuration..."
                    : "Select a screen with active seating first."}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-between gap-3 border-t border-white/10 p-5 sm:px-9">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-white/15 px-6 py-3 text-xs font-semibold text-zinc-300"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                screenLoading
              }
              className="rounded-full bg-[#D71935] px-7 py-3 text-xs font-semibold hover:bg-[#e82a49] disabled:opacity-40"
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save screening"
                  : "Create screening"}
            </button>
          </div>
        </form>
      </motion.aside>
    </motion.div>
  );
}

// =====================================================
// ADMIN SHOWTIMES
// =====================================================

export default function AdminShows() {
  const { token } = useAuth();
  const reduced = useReducedMotion();

  const [shows, setShows] =
    useState([]);

  const [movies, setMovies] =
    useState([]);

  const [theatres, setTheatres] =
    useState([]);

  const [screens, setScreens] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    refreshFeedback,
    setRefreshFeedback,
  ] = useState("");

  useEffect(() => {
    if (!refreshFeedback) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => setRefreshFeedback(""),
      5000
    );

    return () =>
      window.clearTimeout(timer);
  }, [refreshFeedback]);

  const refreshController =
    useRef(null);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("UPCOMING");

  const [theatreId, setTheatreId] =
    useState("ALL");

  const [editor, setEditor] =
    useState(null);

  const [busyId, setBusyId] =
    useState(null);

  // =====================================================
  // LOAD EXISTING ADMIN DATA
  // =====================================================

  const load = useCallback(
    async (signal) => {
      if (!token) return false;

      setLoading(true);
      setError("");

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      };

      try {
        const [
          showResult,
          movieResult,
          theatreResult,
          screenResult,
        ] = await Promise.all([
          axios.get(
            `${API}/api/admin/shows`,
            {
              ...config,
              params: {
                limit: 100,
              },
            }
          ),

          axios.get(
            `${API}/api/movies/admin/all`,
            config
          ),

          axios.get(
            `${API}/api/admin/theatres`,
            config
          ),

          axios.get(
            `${API}/api/admin/screens`,
            config
          ),
        ]);

        if (signal?.aborted) {
          return false;
        }

        setShows(
          showResult.data.shows ||
            []
        );

        setMovies(
          movieResult.data.movies ||
            []
        );

        setTheatres(
          theatreResult.data.theatres ||
            []
        );

        setScreens(
          screenResult.data.screens ||
            []
        );

        return true;
      } catch (requestError) {
        if (
          signal?.aborted ||
          axios.isCancel(
            requestError
          )
        ) {
          return false;
        }

        setError(
          requestError.response
            ?.data?.error ||
            "Could not load screening schedule."
        );

        return false;
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    const controller =
      new AbortController();

    load(controller.signal);

    return () =>
      controller.abort();
  }, [load]);

  useEffect(
    () => () =>
      refreshController.current?.abort(),
    []
  );

  const handleRefresh = async () => {
    if (
      loading ||
      refreshing
    ) {
      return;
    }

    const controller =
      new AbortController();

    refreshController.current =
      controller;

    setRefreshing(true);
    setRefreshFeedback("");

    try {
      const [success] =
        await Promise.all([
          load(
            controller.signal
          ),

          new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                1200
              )
          ),
        ]);

      if (
        controller.signal.aborted
      ) {
        return;
      }

      if (success) {
        const confirmation =
          "Showtimes refreshed successfully.";

        setRefreshFeedback(
          confirmation
        );

        toast.success(
          confirmation
        );
      } else {
        toast.error(
          "Could not refresh showtimes."
        );
      }
    } finally {
      if (
        !controller.signal.aborted
      ) {
        setRefreshing(false);
      }

      if (
        refreshController.current ===
        controller
      ) {
        refreshController.current =
          null;
      }
    }
  };

  // =====================================================
  // COUNTS AND FILTERS
  // =====================================================

  const counts = useMemo(
    () => ({
      total: shows.length,

      upcoming:
        shows.filter(
          (show) =>
            show.status !==
              "CANCELLED" &&
            new Date(
              show.startTime
            ).getTime() >
              Date.now()
        ).length,

      cancelled:
        shows.filter(
          (show) =>
            show.status ===
            "CANCELLED"
        ).length,
    }),
    [shows]
  );

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return [...shows]
      .filter((show) => {
        const matchesText =
          !query ||
          [
            show.movie?.title,
            show.theatre?.name,
            show.screen?.name,
            show.language,
            show.format,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);

        const matchesVenue =
          theatreId === "ALL" ||
          idOf(show.theatre) ===
            theatreId;

        const when = new Date(
          show.startTime
        ).getTime();

        const matchesStatus =
          status === "ALL" ||
          (
            status === "CANCELLED" &&
            show.status ===
              "CANCELLED"
          ) ||
          (
            status === "UPCOMING" &&
            show.status !==
              "CANCELLED" &&
            when > Date.now()
          ) ||
          (
            status === "PAST" &&
            when <= Date.now()
          );

        return (
          matchesText &&
          matchesVenue &&
          matchesStatus
        );
      })
      .sort(
        (a, b) =>
          new Date(
            a.startTime
          ).getTime() -
          new Date(
            b.startTime
          ).getTime()
      );
  }, [
    shows,
    search,
    status,
    theatreId,
  ]);

  const grouped = useMemo(() => {
    const groupedMap =
      new Map();

    filtered.forEach((show) => {
      const day =
        dateKey(show.startTime) ||
        "Unknown date";

      if (
        !groupedMap.has(day)
      ) {
        groupedMap.set(
          day,
          []
        );
      }

      groupedMap.get(day).push(show);
    });

    return [
      ...groupedMap.entries(),
    ];
  }, [filtered]);

  // =====================================================
  // EXISTING CANCELLATION FLOW
  // =====================================================

  const cancel = async (show) => {
    if (
      !window.confirm(
        `Cancel ${
          show.movie?.title ||
          "this screening"
        } at ${time(show.startTime)}? Check existing customer bookings and the cancellation/refund workflow first.`
      )
    ) {
      return;
    }

    setBusyId(
      show._id
    );

    try {
      await axios.delete(
        `${API}/api/shows/${show._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success(
        "Show cancellation submitted."
      );

      await load();
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.error ||
        requestError.response?.data?.message ||
        "Cannot cancel screening."
      );
    } finally {
      setBusyId(null);
    }
  };

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="mx-auto max-w-[1600px] text-white">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.25em] text-[#ff637d]">
            <span className="h-px w-8 bg-[#D71935]" />
            Programming / 06
          </p>

          <h1 className="mt-4 text-[clamp(2.25rem,3.8vw,4rem)] font-semibold leading-none tracking-[-.075em] text-[#f2f0ed]">
            The showtime{" "}

            <span className="text-[#df3b56]">
              board.
            </span>
          </h1>

          <p className="mt-5 text-sm text-zinc-400">
            A living schedule for every screen
            in your network.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setEditor({})
          }
          className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold transition hover:bg-[#ec2a47]"
        >
          <Plus size={18} />
          New screening
        </button>
      </header>

      {/* DASHBOARD SUMMARY */}

      <div className="mt-9 grid gap-3 sm:grid-cols-3">
        {[
          [
            "Loaded screenings",
            counts.total,
          ],
          [
            "Upcoming",
            counts.upcoming,
          ],
          [
            "Cancelled",
            counts.cancelled,
          ],
        ].map(
          ([
            name,
            value,
          ], index) => (
            <div
              key={name}
              className="rounded-[20px] border border-white/[.09] bg-[#151518] p-5"
            >
              <p className="text-xs text-zinc-500">
                {name}
              </p>

              <p
                className={`mt-2 text-3xl font-semibold tabular-nums ${
                  index === 1
                    ? "text-[#ff617a]"
                    : "text-white"
                }`}
              >
                {value}
              </p>
            </div>
          )
        )}
      </div>

      {/* SEARCH AND FILTERS */}

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-48 flex-1">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Film, screen, cinema..."
            aria-label="Search screenings"
            className={`${INPUT} pl-11`}
          />
        </div>

        <select
          value={theatreId}
          onChange={(event) =>
            setTheatreId(
              event.target.value
            )
          }
          aria-label="Filter cinema"
          className={`${INPUT} w-auto min-w-36`}
        >
          <option value="ALL">
            All cinemas
          </option>

          {theatres.map(
            (item) => (
              <option
                key={
                  item._id
                }
                value={
                  item._id
                }
              >
                {item.name}
              </option>
            )
          )}
        </select>

        <button
          type="button"
          disabled={
            loading ||
            refreshing
          }
          aria-busy={
            refreshing
          }
          onClick={
            handleRefresh
          }
          className="inline-flex shrink-0 items-center justify-center gap-3 self-start rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-[#ededed] transition-colors duration-300 hover:border-[#D71935] hover:bg-[#D71935]/10 disabled:cursor-wait disabled:opacity-60"
        >
          <motion.span
            className="inline-flex h-4 w-4 items-center justify-center"
            animate={
              refreshing
                ? {
                    rotate: 360,
                  }
                : {
                    rotate: 0,
                  }
            }
            transition={
              refreshing
                ? {
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "linear",
                  }
                : {
                    duration: 0.25,
                    ease: "easeOut",
                  }
            }
          >
            <RefreshCw size={16} />
          </motion.span>

          {refreshing
            ? "Refreshing..."
            : "Refresh data"}
        </button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-4 text-xs text-emerald-300"
      >
        {refreshFeedback}
      </p>

      <div
        className="mt-5 flex flex-wrap gap-2"
        role="group"
        aria-label="Schedule window"
      >
        {[
          [
            "UPCOMING",
            "Upcoming",
          ],
          [
            "PAST",
            "Past",
          ],
          [
            "CANCELLED",
            "Cancelled",
          ],
          [
            "ALL",
            "All shows",
          ],
        ].map(
          ([
            key,
            name,
          ]) => (
            <button
              type="button"
              key={key}
              aria-pressed={
                status === key
              }
              onClick={() =>
                setStatus(key)
              }
              className={`rounded-full border px-5 py-2.5 text-xs font-semibold transition ${
                status === key
                  ? "border-[#D71935] bg-[#D71935]"
                  : "border-white/10 text-zinc-400 hover:border-white/30 hover:text-white"
              }`}
            >
              {name}
            </button>
          )
        )}
      </div>

      <p className="mt-4 text-xs text-zinc-600">
        Showing {filtered.length} screenings
        from the first{" "}
        {shows.length} results returned
        by the admin API (limit 100).
      </p>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      {/* SHOWTIME SCHEDULE */}

      {loading &&
      shows.length === 0 ? (
        <div
          className="mt-8 h-96 animate-pulse rounded-3xl bg-white/5"
          role="status"
        />
      ) : grouped.length === 0 ? (
        <div className="mt-8 rounded-[26px] border border-dashed border-white/15 py-20 text-center text-zinc-400">
          <CalendarClock
            size={34}
            className="mx-auto text-zinc-600"
          />

          <p className="mt-4 font-semibold">
            No screenings in this view.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {grouped.map(
            ([
              day,
              entries,
            ]) => (
              <section
                key={day}
                className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]"
              >
                <div className="lg:sticky lg:top-40 lg:self-start">
                  <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ff617c]">
                    Programme date
                  </p>

                  <h2 className="mt-2 text-xl font-semibold leading-tight text-white">
                    {day ===
                    "Unknown date"
                      ? day
                      : dateHeading(day)}
                  </h2>

                  <p className="mt-3 text-xs text-zinc-500">
                    {entries.length} screenings
                  </p>
                </div>

                <div className="relative space-y-3 border-l border-white/10 pl-5 sm:pl-8">
                  {entries.map(
                    (
                      show,
                      index
                    ) => (
                      <motion.article
                        key={
                          show._id
                        }
                        initial={
                          reduced
                            ? false
                            : {
                                opacity: 0,
                                x: 14,
                              }
                        }
                        animate={{
                          opacity: 1,
                          x: 0,
                        }}
                        transition={{
                          delay:
                            Math.min(
                              index *
                                0.04,
                              0.2
                            ),
                        }}
                        className="group relative rounded-[22px] border border-white/10 bg-[#151518] p-5 transition hover:border-[#D71935]/45 sm:p-6"
                      >
                        <span className="absolute -left-[26px] top-8 h-3 w-3 rounded-full border-[3px] border-[#D71935] bg-[#151518] sm:-left-[38px]" />

                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <p className="w-24 shrink-0 text-[clamp(1.25rem,2vw,1.8rem)] font-semibold leading-tight tracking-tight text-white tabular-nums">
                              {time(
                                show.startTime
                              )}
                            </p>

                            <div className="h-10 w-px shrink-0 bg-white/10" />

                            <div>
                              <div className="flex flex-wrap items-center gap-3">
                                <h3 className="text-lg font-semibold tracking-tight text-white">
                                  {show.movie?.title ||
                                    "Film unavailable"}
                                </h3>

                                <Status
                                  value={
                                    show.status
                                  }
                                />
                              </div>

                              <p className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                                <MapPin size={13} />

                                {show.theatre?.name ||
                                  "Cinema"}
                                {" · "}
                                {show.screen?.name ||
                                  "Screen"}
                              </p>

                              <p className="mt-2 text-xs text-zinc-500">
                                Ends{" "}
                                {time(
                                  show.endTime
                                )}
                                {" · "}
                                {show.language ||
                                  "—"}
                                {" · "}
                                {show.format ||
                                  "STANDARD"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300">
                              From{" "}
                              {priceFrom(show)}
                            </span>

                            {/* FEATURE 8 — QUEUE CONTROLS */}

                            <ShowQueueControls
                              show={show}
                              token={token}
                            />

                            {/* EXISTING SHOW EDITING */}

                            <button
                              type="button"
                              disabled={
                                show.status ===
                                  "CANCELLED" ||
                                busyId ===
                                  show._id
                              }
                              onClick={() =>
                                setEditor(show)
                              }
                              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold hover:border-[#D71935] disabled:opacity-30"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>

                            {/* EXISTING CANCELLATION */}

                            <button
                              type="button"
                              aria-label={`Cancel screening for ${
                                show.movie?.title ||
                                "film"
                              }`}
                              disabled={
                                show.status ===
                                  "CANCELLED" ||
                                busyId ===
                                  show._id
                              }
                              onClick={() =>
                                cancel(show)
                              }
                              className="rounded-full border border-red-500/20 p-2 text-red-300 hover:bg-red-500/10 disabled:opacity-30"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </motion.article>
                    )
                  )}
                </div>
              </section>
            )
          )}
        </div>
      )}

      {/* EXISTING EDITOR */}

      <AnimatePresence>
        {editor !== null && (
          <ShowEditor
            show={editor}
            token={token}
            movies={movies}
            theatres={theatres}
            screens={screens}
            onClose={() =>
              setEditor(null)
            }
            onSaved={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
