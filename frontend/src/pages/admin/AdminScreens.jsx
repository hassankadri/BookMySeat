
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Armchair,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  MonitorPlay,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const EASE = [0.22, 1, 0.36, 1];
const FORMATS = ["STANDARD", "3D", "IMAX", "IMAX_3D", "4DX", "DOLBY_CINEMA"];
const TYPES = ["REGULAR", "PREMIUM", "RECLINER", "LOUNGER", "WHEELCHAIR"];
const COLORS = {
  REGULAR: "border-[#777780] bg-[#34343d] text-[#e0dfe3]",
  PREMIUM: "border-[#c79452] bg-[#c79452]/20 text-[#f4c88e]",
  RECLINER: "border-[#9c71b7] bg-[#9c71b7]/20 text-[#e1bef6]",
  LOUNGER: "border-[#4c9fba] bg-[#4c9fba]/20 text-[#a3e4f5]",
  WHEELCHAIR: "border-[#4ba887] bg-[#4ba887]/20 text-[#b6ecd4]",
};
const INPUT = "w-full min-w-0 rounded-xl border border-white/10 bg-[#18181d] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 transition-colors duration-200 focus:border-[#D71935]/70 disabled:cursor-not-allowed disabled:opacity-60";
const SURFACE = "rounded-[22px] border border-white/10 bg-[#111114]/90";
const idOf = (value) => String(value && typeof value === "object" ? value._id || "" : value || "");
const freshForm = () => ({
  theatre: "", name: "", screenNumber: "", format: "STANDARD",
  audio: "DOLBY_ATMOS", isActive: true,
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

function Eyebrow({ children, index }) {
  return (
    <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff5874]">
      <span className="h-px w-7 shrink-0 bg-[#D71935]" />
      <span>{children}</span>
      {index && <span className="text-zinc-600">/ {index}</span>}
    </p>
  );
}

function Field({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function SeatMap({ seats = [], selectedSeat, onSelect }) {
  const byRow = useMemo(() => {
    const map = new Map();
    for (const seat of seats) {
      const row = seat.row || String(seat.seatId || "").replace(/\d/g, "") || "?";
      if (!map.has(row)) map.set(row, []);
      map.get(row).push(seat);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([row, values]) => [
      row,
      [...values].sort((a, b) => Number(a.column || a.number || 0) - Number(b.column || b.number || 0)),
    ]);
  }, [seats]);

  return (
    <section className={`${SURFACE} min-w-0 overflow-hidden p-5 sm:p-7`} aria-label="Screen seating plan">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow index="SEATING">Projection view</Eyebrow>
          <h3 className="cine-head mt-3 text-[22px] text-white">Seat layout<span className="text-[#ff5874]">.</span></h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-zinc-400">
          {seats.length} seats
        </span>
      </div>
      <div className="mx-auto mt-10 max-w-[620px] text-center">
        <div className="h-8 rounded-[50%_50%_0_0/100%_100%_0_0] border-t-[3px] border-[#f06a82] bg-gradient-to-b from-[#D71935]/20 to-transparent shadow-[0_-12px_75px_rgba(215,25,53,.17)]" />
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.29em] text-zinc-500">Screen</p>
      </div>
      {byRow.length ? (
        <div className="mt-9 overflow-x-auto pb-5" tabIndex={0} aria-label="Seat rows; scroll horizontally if needed">
          <div className="mx-auto w-max space-y-3">
            {byRow.map(([label, row]) => {
              const columns = row.map((seat) => Number(seat.column || seat.number || 0));
              return (
                <div key={label} className="flex items-center gap-4 sm:gap-5">
                  <span className="w-6 shrink-0 text-center font-mono text-xs text-zinc-500">{label}</span>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {row.map((seat, index) => {
                      const seatId = String(seat.seatId || `${label}${seat.number}`);
                      const inactive = seat.isActive === false;
                      const aisle = index > 0 && columns[index] - columns[index - 1] > 1;
                      const selected = selectedSeat?.seatId === seatId;
                      return (
                        <React.Fragment key={seatId}>
                          {aisle && <span aria-hidden="true" className="w-4" />}
                          <button
                            type="button"
                            aria-label={`Seat ${seatId}, ${seat.type || "REGULAR"}${inactive ? ", inactive" : ""}`}
                            aria-pressed={selected}
                            title={`${seatId} · ${seat.type || "REGULAR"}${inactive ? " · inactive" : ""}`}
                            onClick={() => onSelect?.(seat)}
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-t-lg rounded-b border text-[10px] font-semibold transition-all duration-200 sm:h-9 sm:w-9 ${
                              inactive ? "border-zinc-800 bg-zinc-950 text-zinc-700 line-through" : COLORS[seat.type] || COLORS.REGULAR
                            } ${selected ? "ring-2 ring-[#ff5874] ring-offset-2 ring-offset-[#111114]" : "hover:brightness-125"}`}
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
      ) : (
        <p className="py-16 text-center text-sm text-zinc-500">No seat layout available for this screen.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 border-t border-white/10 pt-6">
        {TYPES.map((type) => (
          <span key={type} className="flex items-center gap-2 text-[10px] text-zinc-400">
            <span className={`h-3 w-3 rounded border ${COLORS[type]}`} />
            {type.replaceAll("_", " ")}
          </span>
        ))}
      </div>
    </section>
  );
}

function ScreenEditor({ screen, theatres, token, onClose, onSaved }) {
  const editing = Boolean(screen?._id);
  const reduced = useReducedMotion();
  const [form, setForm] = useState(() => editing ? {
    theatre: idOf(screen.theatre),
    name: screen.name || "",
    screenNumber: String(screen.screenNumber ?? ""),
    format: screen.format || "STANDARD",
    audio: screen.audio || "",
    isActive: screen.isActive !== false,
  } : freshForm());
  const [rows, setRows] = useState(freshRows);
  const [tab, setTab] = useState("identity");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const preview = useMemo(() => editing ? screen.seats || [] : makeSeats(rows), [editing, rows, screen]);
  const change = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
  };
  const updateRow = (index, key, value) => setRows((previous) =>
    previous.map((row, i) => i === index ? { ...row, [key]: value } : row)
  );

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event) => {
      if (event.key === "Escape" && !saveLock.current) onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    if (saveLock.current) return;
    const screenNumber = Number(form.screenNumber);
    if (!form.theatre || !form.name.trim() || !Number.isInteger(screenNumber) || screenNumber < 1) {
      toast.error("Select a cinema, enter a screen name and a valid screen number.");
      setTab("identity");
      return;
    }
    if (!editing && (rows.length === 0 || rows.some((row) =>
      !Number.isInteger(Number(row.count)) || Number(row.count) < 1 || Number(row.count) > 30 || !TYPES.includes(row.type)
    ))) {
      toast.error("Each row must have 1–30 seats and a valid category.");
      setTab("layout");
      return;
    }
    if (editing && !Array.isArray(screen.seats)) {
      toast.error("Seat records are unavailable. Screen changes were blocked.");
      return;
    }

    const payload = {
      theatre: form.theatre,
      name: form.name.trim(),
      screenNumber,
      format: form.format,
      audio: form.audio.trim(),
      isActive: form.isActive,
      seats: preview,
      totalSeats: preview.length,
    };
    saveLock.current = true;
    setSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (editing) await axios.put(`${API}/api/screens/${screen._id}`, payload, config);
      else await axios.post(`${API}/api/screens`, payload, config);
      toast.success(editing ? "Screen updated; existing seat map preserved." : "Screen created.");
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.message || "Could not save screen.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[115] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button aria-label="Close editor" type="button" disabled={saving} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.aside
        role="dialog" aria-modal="true" aria-label={editing ? "Edit screen" : "Create screen"}
        initial={reduced ? false : { x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ duration: reduced ? 0 : 0.36, ease: EASE }}
        className="relative flex h-full w-full max-w-[860px] flex-col border-l border-white/10 bg-[#111115] text-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-8">
          <div>
            <Eyebrow index="EDITOR">Projection engineering</Eyebrow>
            <h2 className="cine-head mt-3 text-2xl sm:text-3xl">
              {editing ? "Edit screen" : "Design a screen"}<span className="text-[#ff5874]">.</span>
            </h2>
          </div>
          <button type="button" aria-label="Close editor" disabled={saving} onClick={onClose} className="rounded-full border border-white/15 p-2.5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-40"><X size={18} /></button>
        </header>
        <div role="tablist" aria-label="Screen editor sections" className="flex shrink-0 gap-3 border-b border-white/10 px-5 sm:px-8">
          {[["identity", "01 / Configuration"], ["layout", "02 / Seat map"]].map(([key, label]) => (
            <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`border-b-2 px-2 py-4 text-xs font-semibold transition-colors ${tab === key ? "border-[#D71935] text-white" : "border-transparent text-zinc-500 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>
        <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8">
            {tab === "identity" ? (
              <section className="grid gap-5 sm:grid-cols-2">
                <Field label="Cinema">
                  <select name="theatre" required disabled={editing} value={form.theatre} onChange={change} className={INPUT}>
                    <option value="">Select cinema</option>
                    {theatres.filter((theatre) => theatre.isActive !== false || theatre._id === form.theatre).map((theatre) => (
                      <option key={theatre._id} value={theatre._id}>{theatre.name} — {theatre.city}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Screen name">
                  <input name="name" required maxLength={120} value={form.name} onChange={change} className={INPUT} placeholder="e.g. Screen 01" />
                </Field>
                <Field label="Screen number">
                  <input name="screenNumber" required type="number" min="1" value={form.screenNumber} onChange={change} className={INPUT} />
                </Field>
                <Field label="Projection format">
                  <select name="format" value={form.format} onChange={change} className={INPUT}>
                    {FORMATS.map((format) => <option key={format} value={format}>{format.replaceAll("_", " ")}</option>)}
                  </select>
                </Field>
                <Field label="Sound system">
                  <input name="audio" value={form.audio} onChange={change} className={INPUT} />
                </Field>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <span><span className="block text-sm font-semibold text-white">Active for scheduling</span><span className="mt-1 block text-xs text-zinc-500">Allow new showtimes in this room</span></span>
                  <input name="isActive" type="checkbox" checked={form.isActive} onChange={change} className="h-5 w-5 shrink-0 accent-[#D71935]" />
                </label>
              </section>
            ) : (
              <section>
                {editing ? (
                  <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-xs leading-6 text-amber-200">
                    <ShieldAlert size={19} className="mt-0.5 shrink-0" />
                    <p>Existing seat IDs, positions and statuses are read-only. Scheduled shows and sold tickets may reference them. Create a new screen if you need a different layout.</p>
                  </div>
                ) : (
                  <div className="mb-7 space-y-3">
                    <p className="mb-4 text-xs leading-6 text-zinc-400">Configure rows before creating this screen. Each row has one seat category and supports up to 30 seats.</p>
                    {rows.map((row, index) => (
                      <div key={row.label} className="grid grid-cols-[32px_minmax(76px,1fr)_minmax(112px,1.3fr)_30px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 sm:gap-3">
                        <span className="text-center font-mono text-xs text-[#ff7189]">{row.label}</span>
                        <input type="number" min="1" max="30" value={row.count} aria-label={`Seats in row ${row.label}`} onChange={(event) => updateRow(index, "count", event.target.value)} className={INPUT} />
                        <select value={row.type} aria-label={`Seat category row ${row.label}`} onChange={(event) => updateRow(index, "type", event.target.value)} className={INPUT}>
                          {TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                        </select>
                        <button type="button" disabled={rows.length <= 1} aria-label={`Remove row ${row.label}`}
                          onClick={() => setRows((previous) => previous.filter((_, i) => i !== index).map((item, i) => ({ ...item, label: String.fromCharCode(65 + i) })))}
                          className="text-zinc-500 transition-colors hover:text-[#ff7189] disabled:opacity-25"><Trash2 size={17} /></button>
                      </div>
                    ))}
                    <button type="button" disabled={rows.length >= 26}
                      onClick={() => setRows((previous) => [...previous, { label: String.fromCharCode(65 + previous.length), count: "8", type: "REGULAR" }])}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-[#D71935]/65 hover:bg-[#D71935]/10 disabled:opacity-40">
                      <Plus size={15} /> Add seating row
                    </button>
                  </div>
                )}
                <SeatMap seats={preview} />
              </section>
            )}
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#111115] px-5 py-4 sm:px-8">
            <p className="text-xs text-zinc-500">{preview.length} seats · {editing ? "existing map protected" : "planned capacity"}</p>
            <button type="submit" disabled={saving} className="rounded-full bg-[#D71935] px-6 py-3 text-xs font-semibold text-white transition-colors hover:bg-[#ed304d] disabled:cursor-wait disabled:opacity-50 sm:text-sm">
              {saving ? "Saving..." : editing ? "Save screen details" : "Create screen"}
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
  const [refreshNotice, setRefreshNotice] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [theatreFilter, setTheatreFilter] = useState("ALL");
  const [focusedId, setFocusedId] = useState("");
  const [fullScreen, setFullScreen] = useState(null);
  const [seatDetail, setSeatDetail] = useState(null);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const refreshController = useRef(null);

  const load = useCallback(async (signal) => {
    if (!token) return false;
    setError("");
    try {
      const config = { headers: { Authorization: `Bearer ${token}` }, signal };
      const [screenResult, theatreResult] = await Promise.all([
        axios.get(`${API}/api/admin/screens`, config),
        axios.get(`${API}/api/admin/theatres`, config),
      ]);
      if (signal?.aborted) return false;
      setScreens(Array.isArray(screenResult.data?.screens) ? screenResult.data.screens : []);
      setTheatres(Array.isArray(theatreResult.data?.theatres) ? theatreResult.data.theatres : []);
      return true;
    } catch (problem) {
      if (signal?.aborted || axios.isCancel(problem)) return false;
      setError(problem.response?.data?.error || "Screen management could not be loaded.");
      return false;
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);
  useEffect(() => () => refreshController.current?.abort(), []);
  useEffect(() => {
    if (!refreshNotice) return undefined;
    const timer = window.setTimeout(() => setRefreshNotice(false), 5000);
    return () => window.clearTimeout(timer);
  }, [refreshNotice]);

  async function handleRefresh() {
    if (loading || refreshing) return;
    const controller = new AbortController();
    refreshController.current = controller;
    setRefreshing(true);
    setRefreshNotice(false);
    try {
      const [success] = await Promise.all([
        load(controller.signal),
        new Promise((resolve) => window.setTimeout(resolve, 750)),
      ]);
      if (controller.signal.aborted) return;
      if (success) {
        setRefreshNotice(true);
        setFullScreen(null);
        setSeatDetail(null);
      } else {
        toast.error("Could not refresh screen data.");
      }
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
      if (refreshController.current === controller) refreshController.current = null;
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return screens.filter((screen) =>
      (theatreFilter === "ALL" || idOf(screen.theatre) === theatreFilter) &&
      (!query || [screen.name, screen.theatre?.name, screen.format, screen.audio, screen.screenNumber]
        .filter(Boolean).join(" ").toLowerCase().includes(query))
    );
  }, [screens, search, theatreFilter]);
  const focused = filtered.find((screen) => screen._id === focusedId) || filtered[0] || null;
  const displayScreen = fullScreen?._id === focused?._id ? fullScreen : focused;
  const visibleSeats = Array.isArray(displayScreen?.seats) ? displayScreen.seats : [];
  const activeCount = screens.filter((screen) => screen.isActive !== false).length;
  const totalCapacity = screens.reduce((sum, screen) => sum + Number(screen.totalSeats || screen.seats?.length || 0), 0);

  useEffect(() => {
    setSeatDetail(null);
    setFullScreen(null);
    if (!focused?._id || (Array.isArray(focused.seats) && focused.seats.length)) return undefined;
    const controller = new AbortController();
    axios.get(`${API}/api/screens/${focused._id}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    }).then(({ data }) => {
      if (!controller.signal.aborted) setFullScreen(data.screen || data);
    }).catch((problem) => {
      if (!controller.signal.aborted) console.warn("Seat details unavailable:", problem);
    });
    return () => controller.abort();
  }, [focused?._id, focused?.seats, token]);

  function chooseScreen(id) {
    setFocusedId(id);
    setFullScreen(null);
    setSeatDetail(null);
  }

  async function editScreen(screen) {
    if (!screen || busy) return;
    if (Array.isArray(screen.seats)) { setEditor(screen); return; }
    setBusy(true);
    try {
      const { data } = await axios.get(`${API}/api/screens/${screen._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const details = data.screen || data;
      if (!Array.isArray(details.seats)) throw new Error("Seat records unavailable");
      setEditor(details);
    } catch {
      toast.error("Cannot safely edit without complete seat data.");
    } finally { setBusy(false); }
  }

  async function updateActive(screen) {
    if (!screen || busy) return;
    const active = screen.isActive !== false;
    if (!window.confirm(`${active ? "Deactivate" : "Reactivate"} ${screen.name}?`)) return;
    setBusy(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (active) await axios.delete(`${API}/api/screens/${screen._id}`, config);
      else await axios.put(`${API}/api/screens/${screen._id}`, { isActive: true }, config);
      toast.success(active ? "Screen deactivated." : "Screen reactivated.");
      await load();
    } catch (problem) {
      toast.error(problem.response?.data?.error || "Screen status update failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-[1460px] text-white">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-7">
        <div>
          <Eyebrow index="05">Projection engineering</Eyebrow>
          <h1 className="cine-display mt-5 text-[clamp(2.6rem,4.7vw,4.6rem)] leading-[.95]">
            The seating <span className="text-[#ff4562]">lab.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">Configure projection rooms, inspect saved layouts and manage cinema capacity.</p>
        </div>
        <button type="button" onClick={() => setEditor({})}
          className="group inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold transition-colors hover:bg-[#ee304d]">
          <Plus size={17} /> New screen <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </button>
      </header>

      <section aria-label="Screen network overview" className="mt-7 grid grid-cols-3 gap-3 sm:gap-4">
        {[
          ["Screen rooms", screens.length, MonitorPlay],
          ["Active rooms", activeCount, CheckCircle2],
          ["Seat capacity", totalCapacity, Armchair],
        ].map(([label, value, Icon]) => (
          <div key={label} className={`${SURFACE} min-w-0 p-4 transition-colors duration-300 hover:border-[#D71935]/30 sm:p-6`}>
            <div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 sm:text-xs">{label}</p><Icon size={16} className="hidden shrink-0 text-[#ff5874] sm:block" /></div>
            <p className="cine-head mt-4 break-words text-2xl tabular-nums sm:text-3xl">{Number(value).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </section>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" aria-label="Search screens" placeholder="Search a screen, cinema or format..." className={`${INPUT} pl-11`} />
        </div>
        <select value={theatreFilter} onChange={(event) => setTheatreFilter(event.target.value)} aria-label="Filter by cinema" className={`${INPUT} w-full sm:w-[195px]`}>
          <option value="ALL">All cinemas</option>
          {theatres.map((theatre) => <option key={theatre._id} value={theatre._id}>{theatre.name}</option>)}
        </select>
        <button type="button" disabled={loading || refreshing} aria-busy={refreshing} onClick={handleRefresh}
          className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.035] px-5 py-3 text-xs font-semibold text-zinc-200 transition-colors duration-300 hover:border-[#D71935]/60 hover:bg-[#D71935]/10 disabled:cursor-wait disabled:opacity-50">
          <motion.span className="inline-flex text-[#ff5874]" animate={refreshing && !reduced ? { rotate: 360 } : { rotate: 0 }}
            transition={refreshing && !reduced ? { duration: 1.15, repeat: Infinity, ease: "linear" } : { duration: 0.2 }}>
            <RefreshCw size={16} />
          </motion.span>
          {refreshing ? "Refreshing..." : "Refresh screens"}
        </button>
      </div>
      <div className="mt-2 min-h-[23px]" aria-live="polite" aria-atomic="true">
        <AnimatePresence>
          {refreshNotice && (
            <motion.p key="updated" role="status" initial={reduced ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="inline-flex items-center gap-2 text-xs font-medium text-emerald-300">
              <CheckCircle2 size={15} /> Screen data updated
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
      {loading && screens.length === 0 ? (
        <div className="mt-7 h-[350px] animate-pulse rounded-[22px] bg-white/[0.05]" role="status" aria-label="Loading screens" />
      ) : filtered.length === 0 ? (
        <div className={`${SURFACE} mt-7 px-6 py-20 text-center`}>
          <MonitorPlay size={32} className="mx-auto text-zinc-600" />
          <h2 className="cine-head mt-4 text-2xl">No screens found.</h2>
          <p className="mt-2 text-sm text-zinc-500">Try another filter or create a screen for your cinema.</p>
        </div>
      ) : (
        <div className="mt-7 grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className={`${SURFACE} min-w-0 overflow-hidden xl:sticky xl:top-24`} aria-label="Screen directory">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
              <h2 className="cine-head text-lg">Screen directory</h2>
              <span className="text-xs text-zinc-500">{filtered.length} rooms</span>
            </div>
            <div className="max-h-[610px] space-y-1 overflow-y-auto p-2">
              {filtered.map((screen, index) => (
                <button key={screen._id} type="button" aria-pressed={focused?._id === screen._id} onClick={() => chooseScreen(screen._id)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors duration-200 ${focused?._id === screen._id ? "bg-[#D71935]/[0.13]" : "hover:bg-white/[0.045]"}`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${focused?._id === screen._id ? "border-[#D71935]/45 bg-[#D71935]/10 text-[#ff5874]" : "border-white/10 text-zinc-500"}`}><MonitorPlay size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] tabular-nums text-[#ff5874]">{String(index + 1).padStart(2, "0")}</span>
                    <span className="cine-head mt-1 block truncate text-sm">{screen.name}</span>
                    <span className="mt-1 block truncate text-[11px] text-zinc-500">{screen.theatre?.name || "Cinema"} · {screen.format}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[#ff5874]" />
                </button>
              ))}
            </div>
          </aside>
          <section className="min-w-0 space-y-5" aria-label="Selected screen details">
            <motion.div key={focused._id} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}
              className={`${SURFACE} relative overflow-hidden p-5 sm:p-7`}>
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_at_top_right,rgba(215,25,53,.16),transparent_70%)]" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Eyebrow index="ROOM">Selected projection room</Eyebrow>
                  <h2 className="cine-head mt-4 break-words text-[clamp(1.65rem,3vw,2.6rem)]">{focused.name}</h2>
                  <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400"><Building2 size={15} className="text-[#ff5874]" />{focused.theatre?.name || "Cinema"}</p>
                </div>
                <span className={`relative rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${focused.isActive !== false ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-300" : "border-white/15 bg-white/[0.04] text-zinc-400"}`}>
                  {focused.isActive !== false ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
                {[["Projection", focused.format?.replaceAll("_", " ")], ["Sound", focused.audio || "—"], ["Capacity", `${displayScreen?.totalSeats || visibleSeats.length || 0} seats`]].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
                    <p className="cine-head mt-3 break-words text-lg text-white">{value || "—"}</p>
                  </div>
                ))}
              </div>
            </motion.div>
            <SeatMap seats={visibleSeats} selectedSeat={seatDetail} onSelect={setSeatDetail} />
            <div className={`${SURFACE} flex flex-wrap items-center justify-between gap-4 p-5`}>
              <div className="flex min-w-0 items-center gap-3">
                {seatDetail ? <CheckCircle2 size={18} className="shrink-0 text-[#ff5874]" /> : <Armchair size={18} className="shrink-0 text-zinc-500" />}
                <p className="break-words text-xs leading-6 text-zinc-300 sm:text-sm">
                  {seatDetail ? `${seatDetail.seatId} · ${seatDetail.type || "REGULAR"} · ${seatDetail.isActive === false ? "Inactive" : "Active"}` : "Select a seat to inspect its saved configuration."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => editScreen(displayScreen)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-5 py-3 text-xs font-semibold text-white transition-colors hover:bg-[#ed304d] disabled:opacity-40"><Pencil size={15} /> Edit screen</button>
                <button type="button" disabled={busy} onClick={() => updateActive(focused)}
                  className="rounded-full border border-white/20 px-5 py-3 text-xs font-semibold text-zinc-200 transition-colors hover:border-[#D71935]/60 hover:bg-[#D71935]/10 disabled:opacity-40">
                  {focused.isActive !== false ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      <AnimatePresence>
        {editor !== null && (
          <ScreenEditor key={editor._id || "new"} screen={editor} theatres={theatres} token={token} onClose={() => setEditor(null)} onSaved={load} />
        )}
      </AnimatePresence>
    </div>
  );
}
