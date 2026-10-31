
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownAZ, ArrowUpRight, CheckCircle2, ChevronRight, Eye, EyeOff,
  Film, ImageOff, Pencil, Plus, RefreshCw, Save, Search, Star, X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { formatDuration } from "../../utils/formatDuration";

const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const EASE = [0.22, 1, 0.36, 1];
const STATUS = ["ACTIVE", "COMING_SOON", "HIDDEN"];
const inputStyle = "w-full rounded-xl border border-white/10 bg-[#17171b] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 transition-colors focus:border-[#D71935]/70";
const statusLabel = (status) => ({ ACTIVE: "Listed", COMING_SOON: "Coming soon", HIDDEN: "Hidden" }[status] || "Listed");
const defaultForm = () => ({
  title: "", description: "", genre: "", duration: "", language: "",
  rating: "U/A", releaseYear: String(new Date().getFullYear()),
  releaseDate: "", avgRating: "", poster: "", banner: "", trailer: "",
  director: "", producer: "", listingStatus: "ACTIVE",
});
const dateInput = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

function Eyebrow({ children, index }) {
  return <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff526e]">
    <span className="h-px w-7 bg-[#D71935]" />{children}<span className="text-zinc-600">/ {index}</span>
  </p>;
}
function Poster({ movie, className = "" }) {
  const src = movie?.poster || movie?.banner;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className={`relative overflow-hidden bg-[#21191e] ${className}`}>
    {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      : <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(215,25,53,.16),transparent_70%)] text-zinc-600"><ImageOff size={28} strokeWidth={1.3} /></div>}
  </div>;
}
function Pill({ status }) {
  const styles = {
    ACTIVE: "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
    COMING_SOON: "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
    HIDDEN: "border-white/10 bg-white/[0.05] text-zinc-400",
  };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${styles[status] || styles.ACTIVE}`}>{statusLabel(status)}</span>;
}
function Field({ label, name, form, onChange, ...props }) {
  return <label className="block min-w-0">
    <span className="mb-2 block text-xs text-zinc-400">{label}</span>
    <input name={name} value={form[name]} onChange={onChange} className={inputStyle} {...props} />
  </label>;
}
function FilmEditor({ movie, token, onClose, onSaved }) {
  const reduced = useReducedMotion();
  const [form, setForm] = useState(() => movie ? {
  ...defaultForm(), ...movie,
  duration: formatDuration(movie.duration),
  releaseYear: String(movie.releaseYear ?? ""),
    releaseDate: dateInput(movie.releaseDate),
    avgRating: movie.avgRating == null ? "" : String(movie.avgRating),
  } : defaultForm());
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const update = (event) => setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));

  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => { if (event.key === "Escape" && !savingRef.current) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function save(event) {
    event.preventDefault();
    if (savingRef.current) return;
    if (![form.title, form.description, form.genre, form.duration, form.poster].every((item) => String(item || "").trim())) {
      toast.error("Title, synopsis, genre, duration and poster are required.");
      return;
    }
    const releaseYear = form.releaseYear ? Number(form.releaseYear) : undefined;
    const avgRating = form.avgRating === "" ? 0 : Number(form.avgRating);
    if (releaseYear !== undefined && (!Number.isInteger(releaseYear) || releaseYear < 1888 || releaseYear > 2100)) {
      toast.error("Enter a valid release year."); return;
    }
    if (!Number.isFinite(avgRating) || avgRating < 0 || avgRating > 5) {
      toast.error("Audience rating must be from 0 to 5."); return;
    }
    const payload = {
      ...form, title: form.title.trim(), description: form.description.trim(),
      genre: form.genre.trim(), duration: form.duration.trim(), poster: form.poster.trim(),
      releaseYear, releaseDate: form.releaseDate || null, avgRating,
    };
    savingRef.current = true;
    setSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (movie?._id) await axios.put(`${API}/api/movies/${movie._id}`, payload, config);
      else await axios.post(`${API}/api/movies`, payload, config);
      toast.success(movie ? "Film updated." : "Film added.");
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.message || "Could not save the film.");
    } finally { savingRef.current = false; setSaving(false); }
  }

  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[115] flex justify-end">
    <button type="button" disabled={saving} aria-label="Close film editor" onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
    <motion.aside role="dialog" aria-modal="true" aria-label={movie ? "Edit film" : "Add film"}
      initial={reduced ? false : { x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ duration: reduced ? 0 : 0.36, ease: EASE }}
      className="relative flex h-full w-full max-w-[760px] flex-col border-l border-white/10 bg-[#111115] text-white shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
        <div><Eyebrow index="EDITOR">Film catalogue</Eyebrow><h2 className="cine-head mt-3 text-[28px]">{movie ? "Edit film" : "Add a film"}<span className="text-[#ff4562]">.</span></h2></div>
        <button type="button" aria-label="Close" disabled={saving} onClick={onClose} className="rounded-full border border-white/15 p-2.5 text-zinc-400 hover:text-white disabled:opacity-40"><X size={18} /></button>
      </div>
      <form onSubmit={save} className="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-[110px_minmax(0,1fr)] sm:items-center">
          <Poster movie={form} className="aspect-[2/3] w-[110px] rounded-xl" />
          <div><p className="text-[10px] uppercase tracking-[0.2em] text-[#ff526e]">Film identity</p>
            <p className="cine-head mt-3 break-words text-2xl">{form.title || "Untitled film"}</p>
            <p className="mt-2 max-w-md text-xs leading-6 text-zinc-500">These details and creative assets are displayed to customers across the platform.</p>
          </div>
        </div>
        <section className="mt-7 space-y-5 border-t border-white/10 pt-7">
          <Eyebrow index="01">Essentials</Eyebrow>
          <Field label="Film title" name="title" form={form} onChange={update} required maxLength={200} />
          <label className="block"><span className="mb-2 block text-xs text-zinc-400">Synopsis</span>
            <textarea name="description" value={form.description} onChange={update} rows={5} required className={`${inputStyle} resize-y`} />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Genre" name="genre" form={form} onChange={update} required />
            <Field label="Duration" name="duration" form={form} onChange={update} required placeholder="2h 30m" />
            <Field label="Language" name="language" form={form} onChange={update} />
            <Field label="Certificate" name="rating" form={form} onChange={update} />
            <Field label="Release year" name="releaseYear" type="number" min="1888" max="2100" form={form} onChange={update} />
            <Field label="Release date" name="releaseDate" type="date" form={form} onChange={update} />
            <Field label="Audience rating / 5" name="avgRating" type="number" min="0" max="5" step="0.1" form={form} onChange={update} />
            <label className="block"><span className="mb-2 block text-xs text-zinc-400">Listing status</span>
              <select name="listingStatus" value={form.listingStatus} onChange={update} className={inputStyle}>
                {STATUS.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
              </select>
            </label>
            <Field label="Director" name="director" form={form} onChange={update} />
            <Field label="Producer" name="producer" form={form} onChange={update} />
          </div>
        </section>
        <section className="mt-7 space-y-5 border-t border-white/10 pt-7">
          <Eyebrow index="02">Creative assets</Eyebrow>
          <Field label="Poster URL" name="poster" type="url" form={form} onChange={update} required />
          <Field label="Banner URL" name="banner" type="url" form={form} onChange={update} />
          <Field label="Trailer URL" name="trailer" type="url" form={form} onChange={update} />
        </section>
        <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-6">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-full border border-white/15 px-6 py-3 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-40">Discard</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold hover:bg-[#ed2b48] disabled:opacity-40"><Save size={16} />{saving ? "Saving..." : movie ? "Save changes" : "Publish film"}</button>
        </div>
      </form>
    </motion.aside>
  </motion.div>;
}

export default function AdminMovies() {
  const { token } = useAuth();
  const reduced = useReducedMotion();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("RECENT");
  const [selectedId, setSelectedId] = useState("");
  const [editor, setEditor] = useState({ open: false, movie: null });
  const [changingId, setChangingId] = useState(null);
  const refreshController = useRef(null);

  const load = useCallback(async (signal) => {
    if (!token) { setLoading(false); return false; }
    setError("");
    try {
      const response = await axios.get(`${API}/api/movies/admin/all`, { headers: { Authorization: `Bearer ${token}` }, signal });
      if (signal?.aborted) return false;
      setMovies(Array.isArray(response.data?.movies) ? response.data.movies : []);
      return true;
    } catch (problem) {
      if (signal?.aborted || axios.isCancel(problem)) return false;
      setError(problem.response?.data?.error || "Could not load the film catalogue.");
      return false;
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => () => refreshController.current?.abort(), []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(false), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function refresh() {
    if (loading || refreshing) return;
    const controller = new AbortController();
    refreshController.current = controller;
    setRefreshing(true); setNotice(false);
    try {
      const [success] = await Promise.all([
        load(controller.signal),
        new Promise((resolve) => window.setTimeout(resolve, 700)),
      ]);
      if (!controller.signal.aborted && success) setNotice(true);
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
      if (refreshController.current === controller) refreshController.current = null;
    }
  }
  const counts = useMemo(() => ({
    ALL: movies.length,
    ACTIVE: movies.filter((movie) => !movie.listingStatus || movie.listingStatus === "ACTIVE").length,
    COMING_SOON: movies.filter((movie) => movie.listingStatus === "COMING_SOON").length,
    HIDDEN: movies.filter((movie) => movie.listingStatus === "HIDDEN").length,
  }), [movies]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return movies.filter((movie) =>
      (status === "ALL" || status === (movie.listingStatus || "ACTIVE")) &&
      (!query || [movie.title, movie.genre, movie.language, movie.director, movie.producer]
        .filter(Boolean).join(" ").toLowerCase().includes(query))
    ).sort((a, b) => sort === "AZ"
      ? String(a.title || "").localeCompare(String(b.title || ""))
      : sort === "RATING"
        ? Number(b.avgRating || 0) - Number(a.avgRating || 0)
        : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [movies, search, status, sort]);
  const selected = filtered.find((movie) => movie._id === selectedId) || filtered[0] || null;

  async function changeVisibility(movie) {
    if (changingId) return;
    const hidden = movie.listingStatus === "HIDDEN";
    if (!window.confirm(hidden ? `Restore "${movie.title}" to listings?` : `Hide "${movie.title}"? Existing bookings remain unchanged.`)) return;
    setChangingId(movie._id);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (hidden) await axios.put(`${API}/api/movies/${movie._id}`, { listingStatus: "ACTIVE" }, config);
      else await axios.delete(`${API}/api/movies/${movie._id}`, config);
      toast.success(hidden ? "Film restored." : "Film hidden.");
      await load();
    } catch (problem) {
      toast.error(problem.response?.data?.error || problem.response?.data?.message || "Could not change film visibility.");
    } finally { setChangingId(null); }
  }

  return <div className="mx-auto max-w-[1460px] text-white">
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-7">
      <div><Eyebrow index="03">Film catalogue</Eyebrow>
        <h1 className="cine-display mt-5 text-[clamp(2.6rem,4.7vw,4.6rem)] leading-[.95]">The film <span className="text-[#ff4562]">vault.</span></h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">Manage titles, artwork, release details and visibility across the cinema network.</p>
      </div>
      <button type="button" onClick={() => setEditor({ open: true, movie: null })} className="group inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold transition-colors hover:bg-[#ef304d]"><Plus size={17} />Add a film<ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></button>
    </header>

    <div className="mt-7 flex flex-wrap gap-2" aria-label="Film status filters">
      {["ALL", ...STATUS].map((item) => <button key={item} type="button" aria-pressed={status === item} onClick={() => setStatus(item)}
        className={`rounded-full border px-4 py-2.5 text-[11px] font-semibold transition-colors ${status === item ? "border-[#D71935] bg-[#D71935] text-white" : "border-white/10 bg-white/[0.025] text-zinc-400 hover:border-white/25 hover:text-white"}`}>
        {item === "ALL" ? "All films" : statusLabel(item)} <span className="ml-2 opacity-70">{counts[item]}</span>
      </button>)}
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input type="search" aria-label="Search films" placeholder="Search title, genre or director..." value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputStyle} pl-11`} />
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#17171b] px-4 py-3 text-xs text-zinc-400"><ArrowDownAZ size={16} />
        <select aria-label="Sort films" value={sort} onChange={(event) => setSort(event.target.value)} className="bg-transparent font-semibold text-white outline-none">
          <option className="bg-[#17171b]" value="RECENT">Recently added</option>
          <option className="bg-[#17171b]" value="AZ">A to Z</option>
          <option className="bg-[#17171b]" value="RATING">Highest rated</option>
        </select>
      </label>
      <button type="button" onClick={refresh} disabled={loading || refreshing} aria-busy={refreshing}
        className="inline-flex min-h-[45px] items-center gap-2.5 rounded-full border border-white/20 px-5 py-3 text-xs font-semibold text-zinc-200 transition-colors hover:border-[#D71935]/60 hover:bg-[#D71935]/10 disabled:opacity-50">
        <motion.span className="inline-flex text-[#ff526e]" animate={refreshing && !reduced ? { rotate: 360 } : { rotate: 0 }} transition={refreshing && !reduced ? { duration: 1.1, repeat: Infinity, ease: "linear" } : { duration: 0.2 }}><RefreshCw size={16} /></motion.span>
        {refreshing ? "Refreshing..." : "Refresh films"}
      </button>
    </div>
    <div aria-live="polite" className="mt-2 min-h-[20px] text-xs text-emerald-300">
      <AnimatePresence>{notice && <motion.p key="success" role="status" initial={reduced ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-2"><CheckCircle2 size={15} />Film catalogue updated</motion.p>}</AnimatePresence>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
    {loading && !movies.length ? <div role="status" className="mt-8 h-80 animate-pulse rounded-2xl bg-white/[0.05]" />
      : !filtered.length ? <div className="mt-7 rounded-[22px] border border-dashed border-white/15 p-12 text-center"><Film size={32} className="mx-auto text-zinc-600" /><p className="cine-head mt-4 text-xl">No films found.</p><p className="mt-2 text-sm text-zinc-500">Adjust the filters or add a new film.</p></div>
      : <div className="mt-7 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.88fr)]">
        <section aria-label="Film index" className="min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#101013]/90">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff526e]">Your films</span><span className="text-xs tabular-nums text-zinc-500">{filtered.length} titles</span></div>
          <div className="max-h-[750px] overflow-y-auto">
            {filtered.map((movie, index) => <button type="button" key={movie._id} onClick={() => setSelectedId(movie._id)}
              className={`group flex w-full items-center gap-4 border-b border-white/[0.06] px-4 py-3.5 text-left transition-colors sm:px-5 ${movie._id === selected?._id ? "bg-[#D71935]/[0.10]" : "hover:bg-white/[0.04]"}`}>
              <span className="hidden w-6 shrink-0 text-[11px] tabular-nums text-[#ff526e] sm:block">{String(index + 1).padStart(2, "0")}</span>
              <Poster movie={movie} className="h-[80px] w-[54px] shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1"><h2 className="cine-head truncate text-[16px] text-white">{movie.title}</h2><p className="mt-1 truncate text-[11px] text-zinc-500">{[movie.genre, movie.language, movie.releaseYear].filter(Boolean).join(" · ")}</p><div className="mt-2"><Pill status={movie.listingStatus} /></div></div>
              <ChevronRight size={17} className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-[#ff526e]" />
            </button>)}
          </div>
        </section>
        <AnimatePresence mode="wait">
          {selected && <motion.aside key={selected._id} initial={reduced ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#111114]/95 xl:sticky xl:top-24">
            <div className="relative h-[300px] overflow-hidden"><Poster movie={selected} className="absolute inset-0 h-full w-full opacity-35" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111114] via-[#111114]/60 to-black/20" />
              <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 px-6 pb-6"><Poster movie={selected} className="h-[150px] w-[100px] shrink-0 rounded-xl border border-white/15 shadow-2xl" />
                <div className="min-w-0"><p className="text-[10px] uppercase tracking-[.2em] text-[#ff526e]">Selected film</p><h2 className="cine-head mt-3 break-words text-[clamp(1.3rem,2.4vw,2rem)] leading-tight">{selected.title}</h2><p className="mt-2 text-xs text-zinc-400">{selected.genre}</p></div>
              </div>
            </div>
            <div className="space-y-5 px-6 pb-6"><div className="flex flex-wrap items-center justify-between gap-2"><Pill status={selected.listingStatus} />{selected.avgRating != null && <span className="flex items-center gap-1.5 text-xs text-zinc-300"><Star size={15} className="fill-[#D71935] text-[#D71935]" />{selected.avgRating}/5</span>}</div>
              <p className="text-sm leading-7 text-zinc-400">{selected.description || "No synopsis provided."}</p>
              <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-5 text-xs">
                {[
                  ["Director", selected.director],
                  ["Duration", formatDuration(selected.duration)],
                  ["Language", selected.language],
                  ["Release year", selected.releaseYear],
                ].map(([label, value]) => <div key={label}><p className="text-zinc-500">{label}</p><p className="mt-1.5 break-words font-semibold text-white">{value || "—"}</p></div>)}
              </div>
              <div className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
                <button type="button" onClick={() => setEditor({ open: true, movie: selected })} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D71935] px-4 py-3 text-xs font-semibold transition-colors hover:bg-[#ed2b48]"><Pencil size={15} />Edit details</button>
                <button type="button" disabled={changingId === selected._id} onClick={() => changeVisibility(selected)} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-xs font-semibold text-zinc-300 transition-colors hover:border-[#D71935]/60 hover:bg-[#D71935]/10 disabled:opacity-40">{selected.listingStatus === "HIDDEN" ? <Eye size={15} /> : <EyeOff size={15} />}{selected.listingStatus === "HIDDEN" ? "Restore film" : "Hide film"}</button>
              </div>
            </div>
          </motion.aside>}
        </AnimatePresence>
      </div>}
    <AnimatePresence>{editor.open && <FilmEditor key={editor.movie?._id || "new"} movie={editor.movie} token={token} onClose={() => setEditor({ open: false, movie: null })} onSaved={load} />}</AnimatePresence>
  </div>;
}
