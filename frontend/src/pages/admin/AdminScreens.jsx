
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Armchair, ArrowRight, Building2, CheckCircle2,
  MonitorPlay, Pencil, Plus, RefreshCw, Search,
  ShieldAlert, Trash2, X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const INPUT = "w-full rounded-xl border border-white/10 bg-[#222227] px-4 py-3 text-sm text-white outline-none focus:border-[#D71935]/70";
const FORMATS = ["STANDARD", "3D", "IMAX", "IMAX_3D", "4DX", "DOLBY_CINEMA"];
const TYPES = ["REGULAR", "PREMIUM", "RECLINER", "LOUNGER", "WHEELCHAIR"];

const COLORS = {
  REGULAR: "border-[#797982] bg-[#383840] text-[#d1d1d6]",
  PREMIUM: "border-[#d29b54] bg-[#d29b54]/20 text-[#f0c28b]",
  RECLINER: "border-[#996cba] bg-[#996cba]/20 text-[#d5b8eb]",
  LOUNGER: "border-[#4c9fba] bg-[#4c9fba]/20 text-[#9bdcee]",
  WHEELCHAIR: "border-[#4ba887] bg-[#4ba887]/20 text-[#a8e4ca]",
};

const idOf = (value) =>
  String(value && typeof value === "object" ? value._id || "" : value || "");

const freshForm = () => ({
  theatre: "",
  name: "",
  screenNumber: "",
  format: "STANDARD",
  audio: "DOLBY_ATMOS",
  isActive: true,
});

const freshRows = () => [
  { label: "A", count: "8", type: "REGULAR" },
  { label: "B", count: "8", type: "PREMIUM" },
  { label: "C", count: "8", type: "RECLINER" },
];

function makeSeats(rows) {
  return rows.flatMap((row) => {
    const count = Math.min(30, Math.max(0, Number(row.count) || 0));

    return Array.from({ length: count }, (_, index) => ({
      seatId: `${row.label}${index + 1}`,
      row: row.label,
      number: index + 1,
      column: index + 1 > Math.ceil(count / 2) ? index + 2 : index + 1,
      type: row.type,
      isActive: true,
    }));
  });
}

function SeatMap({ seats, selectedSeat, onSelect }) {
  const byRow = useMemo(() => {
    const map = new Map();

    for (const seat of seats || []) {
      const key =
        seat.row ||
        String(seat.seatId || "").replace(/\d/g, "") ||
        "?";

      if (!map.has(key)) map.set(key, []);
      map.get(key).push(seat);
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => [
        key,
        values.sort(
          (a, b) =>
            Number(a.column || a.number || 0) -
            Number(b.column || b.number || 0)
        ),
      ]);
  }, [seats]);

  return (
    <div className="min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#101014] p-5 sm:p-8">
      <div className="mx-auto max-w-xl text-center">
        <div className="h-9 rounded-[50%_50%_0_0/100%_100%_0_0] border-t-[3px] border-[#ee7185] bg-gradient-to-b from-[#D71935]/20 to-transparent shadow-[0_-20px_75px_rgba(215,25,53,.25)]" />
        <p className="mt-2 text-[10px] uppercase tracking-[.3em] text-[#9b9ba6]">
          Screen
        </p>
      </div>

      {byRow.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          No seat map available.
        </p>
      ) : (
        <div className="mt-10 overflow-x-auto pb-3">
          <div className="mx-auto w-max space-y-3">
            {byRow.map(([key, row]) => {
              const columns = row.map((seat) =>
                Number(seat.column || seat.number || 0)
              );
              const mid =
                columns.length > 1
                  ? Math.floor(columns.length / 2)
                  : -1;

              return (
                <div key={key} className="flex items-center gap-5">
                  <span className="w-6 shrink-0 text-center font-mono text-xs text-[#92929d]">
                    {key}
                  </span>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {row.map((seat, index) => {
                      const sid = String(
                        seat.seatId || `${key}${seat.number}`
                      );
                      const inactive = seat.isActive === false;
                      const gapBefore =
                        index > 0 &&
                        (
                          columns[index] - columns[index - 1] > 1 ||
                          (
                            index === mid + 1 &&
                            columns.every((c) => c === 0)
                          )
                        );

                      return (
                        <React.Fragment key={sid}>
                          {gapBefore && (
                            <span className="w-4" aria-hidden="true" />
                          )}

                          <button
                            type="button"
                            aria-label={`Seat ${sid}, ${
                              seat.type || "REGULAR"
                            }${inactive ? ", inactive" : ""}`}
                            aria-pressed={selectedSeat?.seatId === sid}
                            onClick={() => onSelect?.(seat)}
                            title={`${sid} · ${
                              seat.type || "REGULAR"
                            }${inactive ? " · inactive" : ""}`}
                            className={`flex h-8 w-8 items-center justify-center rounded-t-lg rounded-b border text-[10px] font-semibold transition sm:h-9 sm:w-9 ${
                              inactive
                                ? "border-zinc-800 bg-zinc-950 text-zinc-700 line-through"
                                : COLORS[seat.type] || COLORS.REGULAR
                            } ${
                              selectedSeat?.seatId === sid
                                ? "ring-2 ring-white ring-offset-2 ring-offset-[#101014]"
                                : "hover:brightness-125"
                            }`}
                          >
                            {seat.number || index + 1}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 border-t border-white/10 pt-6">
        {TYPES.map((type) => (
          <div
            key={type}
            className="flex items-center gap-2 text-[10px] text-zinc-400"
          >
            <span className={`h-3 w-3 rounded border ${COLORS[type]}`} />
            {type.replaceAll("_", " ")}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ title, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-zinc-400">
        {title}
      </span>
      {children}
    </label>
  );
}

function ScreenEditor({ screen, theatres, token, onClose, onSaved }) {
  const editing = Boolean(screen?._id);
  const [form, setForm] = useState(freshForm);
  const [rows, setRows] = useState(freshRows);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("identity");

  const preview = useMemo(
    () => (editing ? screen?.seats || [] : makeSeats(rows)),
    [editing, screen, rows]
  );

  useEffect(() => {
    if (!screen) return;

    setForm(
      editing
        ? {
            theatre: idOf(screen.theatre),
            name: screen.name || "",
            screenNumber: String(screen.screenNumber ?? ""),
            format: screen.format || "STANDARD",
            audio: screen.audio || "",
            isActive: screen.isActive !== false,
          }
        : freshForm()
    );

    setRows(freshRows());
    setActiveTab("identity");
  }, [screen, editing]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, saving]);

  const change = (event) => {
    const { name, value, checked, type } = event.target;

    setForm((before) => ({
      ...before,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const updateRow = (index, key, value) => {
    setRows((before) =>
      before.map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      )
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const number = Number(form.screenNumber);

    if (
      !form.theatre ||
      !form.name.trim() ||
      !Number.isInteger(number) ||
      number < 1
    ) {
      toast.error("Enter a theatre, screen name and valid screen number.");
      return;
    }

    if (
      !editing &&
      (
        rows.length === 0 ||
        rows.some(
          (row) =>
            !Number.isInteger(Number(row.count)) ||
            Number(row.count) < 1 ||
            Number(row.count) > 30 ||
            !TYPES.includes(row.type)
        )
      )
    ) {
      toast.error("Each row must have 1–30 seats and a valid category.");
      setActiveTab("layout");
      return;
    }

    if (editing && !Array.isArray(screen.seats)) {
      toast.error("Full seat data is unavailable. Screen was not changed.");
      return;
    }

    const seats = preview;

    const payload = {
      theatre: form.theatre,
      name: form.name.trim(),
      screenNumber: number,
      format: form.format,
      audio: form.audio.trim(),
      isActive: form.isActive,
      seats,
      totalSeats: seats.length,
    };

    setSaving(true);

    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      if (editing) {
        await axios.put(
          `${API}/api/screens/${screen._id}`,
          payload,
          config
        );
      } else {
        await axios.post(`${API}/api/screens`, payload, config);
      }

      toast.success(
        editing
          ? "Screen updated; seat map preserved."
          : "Screen created."
      );

      await onSaved();
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Could not save screen."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[115] flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        aria-label="Close screen editor"
        type="button"
        disabled={saving}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit screen" : "Create screen"}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.36 }}
        className="relative flex h-full w-full max-w-[870px] flex-col border-l border-white/10 bg-[#141417]"
      >
        <header className="flex items-center justify-between border-b border-white/10 p-6 sm:px-9">
          <div>
            <p className="text-[10px] uppercase tracking-[.21em] text-[#ff647e]">
              Projection engineering
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {editing ? "Edit screen details" : "Design a new screen"}
            </h2>
          </div>

          <button
            type="button"
            disabled={saving}
            aria-label="Close"
            onClick={onClose}
            className="rounded-full border border-white/15 p-3 text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div
          className="flex shrink-0 gap-2 border-b border-white/10 px-6 sm:px-9"
          role="tablist"
          aria-label="Screen editor sections"
        >
          {[
            ["identity", "01 / Configuration"],
            ["layout", "02 / Seat map"],
          ].map(([key, value]) => (
            <button
              type="button"
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`border-b-2 px-4 py-4 text-xs font-semibold ${
                activeTab === key
                  ? "border-[#D71935] text-white"
                  : "border-transparent text-zinc-500"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <form
          noValidate
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-9">
            {activeTab === "identity" ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field title="Theatre">
                  <select
                    name="theatre"
                    required
                    value={form.theatre}
                    onChange={change}
                    disabled={editing}
                    className={`${INPUT} disabled:opacity-60`}
                  >
                    <option value="">Select cinema</option>
                    {theatres
                      .filter(
                        (theatre) =>
                          theatre.isActive !== false ||
                          theatre._id === form.theatre
                      )
                      .map((theatre) => (
                        <option key={theatre._id} value={theatre._id}>
                          {theatre.name} — {theatre.city}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field title="Screen name">
                  <input
                    name="name"
                    required
                    value={form.name}
                    onChange={change}
                    className={INPUT}
                  />
                </Field>

                <Field title="Screen number">
                  <input
                    name="screenNumber"
                    required
                    type="number"
                    min="1"
                    value={form.screenNumber}
                    onChange={change}
                    className={INPUT}
                  />
                </Field>

                <Field title="Projection format">
                  <select
                    name="format"
                    value={form.format}
                    onChange={change}
                    className={INPUT}
                  >
                    {FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {format.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field title="Sound system">
                  <input
                    name="audio"
                    value={form.audio}
                    onChange={change}
                    className={INPUT}
                  />
                </Field>

                <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4">
                  <span className="text-sm text-white">
                    Active for scheduling
                  </span>
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={change}
                    className="h-5 w-5 accent-[#D71935]"
                  />
                </label>
              </div>
            ) : (
              <div>
                {editing ? (
                  <div className="mb-6 flex gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[.06] p-4 text-xs leading-6 text-amber-200">
                    <ShieldAlert size={20} className="shrink-0" />
                    <p>
                      This screen already exists. Its saved seat IDs,
                      positions and statuses are read-only here, because
                      scheduled shows and sold tickets may reference them.
                      Use a new screen for a different layout; do not
                      overwrite an existing seat map.
                    </p>
                  </div>
                ) : (
                  <div className="mb-6 space-y-3">
                    {rows.map((row, index) => (
                      <div
                        key={row.label}
                        className="grid grid-cols-[60px_1fr_1fr_40px] items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3"
                      >
                        <span className="text-center font-mono text-[#ff7189]">
                          {row.label}
                        </span>

                        <input
                          type="number"
                          min="1"
                          max="30"
                          aria-label={`Seats in row ${row.label}`}
                          value={row.count}
                          onChange={(event) =>
                            updateRow(index, "count", event.target.value)
                          }
                          className={INPUT}
                        />

                        <select
                          aria-label={`Seat type row ${row.label}`}
                          value={row.type}
                          onChange={(event) =>
                            updateRow(index, "type", event.target.value)
                          }
                          className={INPUT}
                        >
                          {TYPES.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </select>

                        <button
                          disabled={rows.length <= 1}
                          type="button"
                          aria-label={`Remove row ${row.label}`}
                          onClick={() =>
                            setRows((previous) =>
                              previous
                                .filter((_, i) => i !== index)
                                .map((item, i) => ({
                                  ...item,
                                  label: String.fromCharCode(65 + i),
                                }))
                            )
                          }
                          className="text-zinc-400 hover:text-red-300 disabled:opacity-25"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      disabled={rows.length >= 26}
                      onClick={() =>
                        setRows((before) => [
                          ...before,
                          {
                            label: String.fromCharCode(
                              65 + before.length
                            ),
                            count: "8",
                            type: "REGULAR",
                          },
                        ])
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2 text-xs font-semibold text-white hover:border-[#D71935] disabled:opacity-30"
                    >
                      <Plus size={16} />
                      Add seating row
                    </button>
                  </div>
                )}

                <SeatMap seats={preview} />
              </div>
            )}
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#141417] p-5 sm:px-9">
            <span className="text-xs text-zinc-400">
              {preview.length} seats{" "}
              {editing
                ? "· existing map protected"
                : "· planned capacity"}
            </span>

            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#D71935] px-7 py-3 text-sm font-semibold text-white hover:bg-[#ea2a47] disabled:opacity-40"
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save details"
                  : "Create screen"}
            </button>
          </footer>
        </form>
      </motion.aside>
    </motion.div>
  );
}

export default function AdminScreens() {
  const { token } = useAuth();
  const reduced = useReducedMotion();

  const [screens, setScreens] = useState([]);
  const [theatres, setTheatres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState("");

  // Success text disappears five seconds after a successful refresh.
  useEffect(() => {
    if (!refreshFeedback) return undefined;

    const timer = window.setTimeout(
      () => setRefreshFeedback(""),
      5000
    );

    return () => window.clearTimeout(timer);
  }, [refreshFeedback]);

  const refreshController = useRef(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [theatreFilter, setTheatreFilter] = useState("ALL");
  const [focusedId, setFocusedId] = useState("");
  const [fullScreen, setFullScreen] = useState(null);
  const [seatDetail, setSeatDetail] = useState(null);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal) => {
    if (!token) return false;

    setLoading(true);
    setError("");

    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      };

      const [screenResult, theatreResult] = await Promise.all([
        axios.get(`${API}/api/admin/screens`, config),
        axios.get(`${API}/api/admin/theatres`, config),
      ]);

      if (signal?.aborted) return false;

      setScreens(screenResult.data.screens || []);
      setTheatres(theatreResult.data.theatres || []);
      return true;
    } catch (error) {
      if (signal?.aborted || axios.isCancel(error)) return false;

      setError(
        error.response?.data?.error ||
        "Screen management could not be loaded."
      );
      return false;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);

    return () => controller.abort();
  }, [load]);

  useEffect(
    () => () => refreshController.current?.abort(),
    []
  );

  const handleRefresh = async () => {
    if (loading || refreshing) return;

    const controller = new AbortController();
    refreshController.current = controller;

    setRefreshing(true);
    setRefreshFeedback("");

    try {
      const [success] = await Promise.all([
        load(controller.signal),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);

      if (controller.signal.aborted) return;

      if (success) {
        const confirmation =
          "Screen data refreshed successfully.";

        setRefreshFeedback(confirmation);
        toast.success(confirmation);
        setSeatDetail(null);
        setFullScreen(null);
      } else {
        toast.error("Could not refresh screen data.");
      }
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);

      if (refreshController.current === controller) {
        refreshController.current = null;
      }
    }
  };

  const filtered = useMemo(() => {
    return screens.filter((screen) => {
      const matchesTheatre =
        theatreFilter === "ALL" ||
        idOf(screen.theatre) === theatreFilter;

      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        [
          screen.name,
          screen.theatre?.name,
          screen.format,
          screen.audio,
          screen.screenNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesTheatre && matchesSearch;
    });
  }, [screens, search, theatreFilter]);

  const focused =
    filtered.find((screen) => screen._id === focusedId) ||
    filtered[0] ||
    null;

  const displayScreen =
    fullScreen?._id === focused?._id
      ? fullScreen
      : focused;

  const visibleSeats = displayScreen?.seats || [];

  useEffect(() => {
    setSeatDetail(null);
    setFullScreen(null);

    if (
      !focused?._id ||
      (Array.isArray(focused.seats) && focused.seats.length)
    ) {
      return undefined;
    }

    const controller = new AbortController();

    axios.get(`${API}/api/screens/${focused._id}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setFullScreen(data.screen || data);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn("Screen seat detail unavailable:", error);
        }
      });

    return () => controller.abort();
  }, [focused?._id, token, focused?.seats]);

  const chooseScreen = (id) => {
    setFocusedId(id);
    setFullScreen(null);
    setSeatDetail(null);
  };

  const edit = async (screen) => {
    if (!screen) return;

    if (Array.isArray(screen.seats)) {
      setEditor(screen);
      return;
    }

    setBusy(true);

    try {
      const response = await axios.get(
        `${API}/api/screens/${screen._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const details = response.data.screen || response.data;

      if (!Array.isArray(details.seats)) {
        throw new Error("Seat records unavailable");
      }

      setEditor(details);
    } catch {
      toast.error(
        "Cannot safely edit without complete seat data."
      );
    } finally {
      setBusy(false);
    }
  };

  const updateActive = async (screen) => {
    const active = screen.isActive !== false;

    if (
      !window.confirm(
        `${active ? "Deactivate" : "Reactivate"} ${screen.name}?`
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      if (active) {
        await axios.delete(
          `${API}/api/screens/${screen._id}`,
          config
        );
      } else {
        await axios.put(
          `${API}/api/screens/${screen._id}`,
          { isActive: true },
          config
        );
      }

      toast.success(
        active
          ? "Screen deactivated."
          : "Screen reactivated."
      );

      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
        "Screen status update failed."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1550px] text-white">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.25em] text-[#ff657d]">
            <span className="h-px w-8 bg-[#D71935]" />
            Engineering / 05
          </p>

          <h1 className="mt-4 text-[clamp(2.25rem,3.8vw,4rem)] font-semibold leading-none tracking-[-.075em] text-[#f2f0ed]">
            The seating{" "}
            <span className="text-[#dc3a55]">lab.</span>
          </h1>

          <p className="mt-5 text-sm text-zinc-400">
            Every screen. Every row. Every seat in the right place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditor({})}
          className="flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold hover:bg-[#e72b48]"
        >
          <Plus size={18} />
          New screen
        </button>
      </header>

      <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={17}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search screens"
            placeholder="Screen, cinema, format..."
            className={`${INPUT} pl-11`}
          />
        </div>

        <select
          value={theatreFilter}
          onChange={(event) =>
            setTheatreFilter(event.target.value)
          }
          aria-label="Filter by theatre"
          className={`${INPUT} w-full lg:w-[190px]`}
        >
          <option value="ALL">All cinemas</option>
          {theatres.map((item) => (
            <option value={item._id} key={item._id}>
              {item.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          aria-busy={refreshing}
          className="inline-flex shrink-0 items-center justify-center gap-3 self-start rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-[#ededed] transition-colors duration-300 hover:border-[#D71935] hover:bg-[#D71935]/10 disabled:cursor-wait disabled:opacity-60 lg:self-auto"
        >
          <motion.span
            className="inline-flex h-4 w-4 items-center justify-center"
            animate={
              refreshing ? { rotate: 360 } : { rotate: 0 }
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

          {refreshing ? "Refreshing..." : "Refresh data"}
        </button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-4 text-xs text-emerald-300"
      >
        {refreshFeedback}
      </p>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      {loading && screens.length === 0 ? (
        <div
          role="status"
          className="mt-8 h-96 animate-pulse rounded-3xl bg-white/5"
        />
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-white/15 py-24 text-center text-zinc-400">
          No screens match the selected filters.
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[23px] border border-white/10 bg-[#141417] xl:sticky xl:top-40">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <p className="text-sm font-semibold">Screens</p>
              <span className="text-xs text-zinc-500">
                {filtered.length}
              </span>
            </div>

            <div className="max-h-[650px] space-y-1 overflow-y-auto p-2">
              {filtered.map((screen) => (
                <button
                  key={screen._id}
                  type="button"
                  onClick={() => chooseScreen(screen._id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-4 text-left transition ${
                    focused._id === screen._id
                      ? "bg-[#D71935]/15"
                      : "hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                      focused._id === screen._id
                        ? "border-[#D71935]/50 text-[#ff667f]"
                        : "border-white/10 text-zinc-500"
                    }`}
                  >
                    <MonitorPlay size={20} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {screen.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {screen.theatre?.name || "Cinema"} ·{" "}
                      {screen.format}
                    </p>
                  </div>

                  <ArrowRight
                    size={16}
                    className="text-zinc-600"
                  />
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0 space-y-5">
            <motion.div
              key={focused._id}
              initial={
                reduced
                  ? false
                  : { opacity: 0, y: 14 }
              }
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[25px] border border-white/10 bg-[#17171b] p-6 sm:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[.22em] text-[#ff617a]">
                    Selected projection room
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold tracking-[-.06em] sm:text-5xl">
                    {focused.name}
                  </h2>

                  <p className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
                    <Building2 size={16} />
                    {focused.theatre?.name || "Cinema"}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    focused.isActive !== false
                      ? "border-emerald-400/25 text-emerald-300"
                      : "border-white/15 text-zinc-400"
                  }`}
                >
                  {focused.isActive !== false
                    ? "Active"
                    : "Inactive"}
                </span>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  ["Projection", focused.format],
                  ["Sound", focused.audio || "—"],
                  [
                    "Capacity",
                    `${
                      displayScreen?.totalSeats ||
                      visibleSeats.length ||
                      0
                    } seats`,
                  ],
                ].map(([name, value]) => (
                  <div
                    key={name}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <p className="text-[10px] uppercase tracking-[.16em] text-zinc-500">
                      {name}
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            <SeatMap
              seats={visibleSeats}
              selectedSeat={seatDetail}
              onSelect={setSeatDetail}
            />

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#141417] p-5">
              <div className="flex items-center gap-3">
                {seatDetail ? (
                  <CheckCircle2
                    size={18}
                    className="text-[#ff607a]"
                  />
                ) : (
                  <Armchair
                    size={18}
                    className="text-zinc-500"
                  />
                )}

                <p className="text-sm text-zinc-300">
                  {seatDetail
                    ? `${seatDetail.seatId} · ${
                        seatDetail.type || "REGULAR"
                      } · ${
                        seatDetail.isActive === false
                          ? "Inactive"
                          : "Active"
                      }`
                    : "Select a seat to inspect its saved data"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => edit(displayScreen)}
                  className="flex items-center gap-2 rounded-full bg-[#D71935] px-5 py-2.5 text-sm font-semibold hover:bg-[#ed2c48] disabled:opacity-40"
                >
                  <Pencil size={15} />
                  Edit screen
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateActive(focused)}
                  className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-[#D71935] disabled:opacity-40"
                >
                  {focused.isActive !== false
                    ? "Deactivate"
                    : "Reactivate"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <AnimatePresence>
        {editor !== null && (
          <ScreenEditor
            screen={editor}
            theatres={theatres}
            token={token}
            onClose={() => setEditor(null)}
            onSaved={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
