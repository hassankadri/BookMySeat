
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownAZ, ChevronRight, Eye, EyeOff, Film,
  ImageOff, Pencil, Plus, RefreshCw, Save, Search, Star, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const statusOptions = ["ACTIVE", "COMING_SOON", "HIDDEN"];
const inputClass = "w-full rounded-xl border border-white/10 bg-[#202025] px-4 py-3 text-sm text-white outline-none placeholder:text-[#73737d] transition focus:border-[#D71935]/70";
const labelClass = "mb-2 block text-xs font-semibold text-[#a2a2ae]";
const easing = [0.22, 1, 0.36, 1];

const empty = () => ({
  title: "", description: "", genre: "", duration: "", language: "",
  rating: "U/A", releaseYear: String(new Date().getFullYear()), releaseDate: "",
  avgRating: "", poster: "", banner: "", trailer: "", director: "",
  producer: "", listingStatus: "ACTIVE",
});

const displayStatus = (value) => ({
  ACTIVE: "Listed",
  COMING_SOON: "Coming soon",
  HIDDEN: "Hidden",
}[value] || "Now showing");

const isoDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

function Thumb({ movie, className = "", decorative = false }) {
  const [failed, setFailed] = useState(false);
  const url = movie?.poster || movie?.banner;

  useEffect(() => setFailed(false), [url]);

  return (
    <div className={`relative overflow-hidden bg-[#26262d] ${className}`}>
      {url && !failed ? (
        <img
          src={url}
          alt={decorative ? "" : `${movie.title} poster`}
          onError={() => setFailed(true)}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-[linear-gradient(140deg,#292025,#111116)] text-[#74646b]">
          <ImageOff size={28} />
        </div>
      )}
    </div>
  );
}

function Status({ status }) {
  const current = status || "ACTIVE";
  const styles = {
    ACTIVE: "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
    COMING_SOON: "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
    HIDDEN: "border-white/10 bg-white/[0.05] text-[#a0a0aa]",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${styles[current] || styles.ACTIVE}`}>
      {displayStatus(current)}
    </span>
  );
}

function Input({ title, name, value, onChange, ...props }) {
  return (
    <label className="block">
      <span className={labelClass}>{title}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className={inputClass}
        {...props}
      />
    </label>
  );
}

function Editor({ open, movie, onClose, onSaved, token }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setForm(movie ? {
      title: movie.title || "",
      description: movie.description || "",
      genre: movie.genre || "",
      duration: movie.duration || "",
      language: movie.language || "",
      rating: movie.rating || "U/A",
      releaseYear: String(movie.releaseYear ?? ""),
      releaseDate: isoDate(movie.releaseDate),
      avgRating: movie.avgRating == null ? "" : String(movie.avgRating),
      poster: movie.poster || "",
      banner: movie.banner || "",
      trailer: movie.trailer || "",
      director: movie.director || "",
      producer: movie.producer || "",
      listingStatus: movie.listingStatus || "ACTIVE",
    } : empty());
  }, [open, movie]);

  useEffect(() => {
    if (!open) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, saving, onClose]);

  const update = (event) => {
    setForm((existing) => ({
      ...existing,
      [event.target.name]: event.target.value,
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (![form.title, form.description, form.genre, form.duration, form.poster].every((item) => String(item).trim())) {
      toast.error("Complete the title, description, genre, duration and poster fields.");
      return;
    }

    const payload = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      genre: form.genre.trim(),
      duration: form.duration.trim(),
      poster: form.poster.trim(),
      releaseYear: form.releaseYear ? Number(form.releaseYear) : undefined,
      releaseDate: form.releaseDate || null,
      avgRating: form.avgRating === "" ? 0 : Number(form.avgRating),
    };

    if (
      payload.releaseYear !== undefined &&
      (!Number.isInteger(payload.releaseYear) ||
        payload.releaseYear < 1888 ||
        payload.releaseYear > 2100)
    ) {
      toast.error("Enter a valid release year.");
      return;
    }

    if (
      !Number.isFinite(payload.avgRating) ||
      payload.avgRating < 0 ||
      payload.avgRating > 5
    ) {
      toast.error("Rating must be between 0 and 5.");
      return;
    }

    setSaving(true);

    try {
      const options = {
        headers: { Authorization: `Bearer ${token}` },
      };

      if (movie?._id) {
        await axios.put(`${API_URL}/api/movies/${movie._id}`, payload, options);
      } else {
        await axios.post(`${API_URL}/api/movies`, payload, options);
      }

      toast.success(movie ? "Movie updated." : "Movie added.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Could not save this movie."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          <motion.button
            type="button"
            aria-label="Close editor"
            onClick={() => !saving && onClose()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={movie ? "Edit movie" : "Add movie"}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.38, ease: easing }}
            className="relative h-full w-full max-w-[810px] overflow-y-auto border-l border-white/15 bg-[#131316] shadow-2xl"
          >
            <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#131316]/95 px-6 py-5 backdrop-blur-xl sm:px-9">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.23em] text-[#ef536d]">
                  Film archive / editor
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">
                  {movie ? "Edit film" : "New film"}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                aria-label="Close editor"
                className="rounded-full border border-white/15 p-3 text-[#d9d9e0] hover:bg-white/10 disabled:opacity-40"
              >
                <X size={19} />
              </button>
            </header>

            <form onSubmit={save} className="space-y-9 p-6 pb-12 sm:p-9">
              <div className="grid gap-6 sm:grid-cols-[130px_1fr]">
                <Thumb
                  movie={{
                    title: form.title,
                    poster: form.poster,
                    banner: form.banner,
                  }}
                  className="aspect-[2/3] w-full rounded-xl"
                  decorative
                />
                <div className="flex flex-col justify-center">
                  <p className="text-[11px] uppercase tracking-[0.21em] text-[#e65b73]">
                    Film identity
                  </p>
                  <p className="mt-3 text-2xl font-semibold leading-tight text-white">
                    {form.title || "Untitled film"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#9c9ca7]">
                    The poster and film metadata shown to customers come from this record.
                  </p>
                </div>
              </div>

              <section className="space-y-5 border-t border-white/10 pt-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.19em] text-[#e3536b]">
                  01 / Essentials
                </p>
                <Input title="Movie title" name="title" value={form.title} onChange={update} required />
                <label className="block">
                  <span className={labelClass}>Synopsis</span>
                  <textarea
                    name="description"
                    rows={5}
                    value={form.description}
                    onChange={update}
                    required
                    className={`${inputClass} resize-y`}
                  />
                </label>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Input title="Genre" name="genre" value={form.genre} onChange={update} placeholder="Action, Thriller" required />
                  <Input title="Duration" name="duration" value={form.duration} onChange={update} placeholder="2h 30m" required />
                  <Input title="Language" name="language" value={form.language} onChange={update} />
                  <Input title="Certificate" name="rating" value={form.rating} onChange={update} />
                  <Input title="Release year" type="number" min="1888" max="2100" name="releaseYear" value={form.releaseYear} onChange={update} />
                  <Input title="Release date" type="date" name="releaseDate" value={form.releaseDate} onChange={update} />
                  <Input title="Audience rating / 5" type="number" min="0" max="5" step="0.1" name="avgRating" value={form.avgRating} onChange={update} />
                  <label className="block">
                    <span className={labelClass}>Listing status</span>
                    <select name="listingStatus" value={form.listingStatus} onChange={update} className={inputClass}>
                      {statusOptions.map((value) => (
                        <option key={value} value={value}>
                          {displayStatus(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input title="Director" name="director" value={form.director} onChange={update} />
                  <Input title="Producer" name="producer" value={form.producer} onChange={update} />
                </div>
              </section>

              <section className="space-y-5 border-t border-white/10 pt-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.19em] text-[#e3536b]">
                  02 / Creative assets
                </p>
                <Input title="Poster URL" type="url" name="poster" value={form.poster} onChange={update} required />
                <Input title="Banner URL" type="url" name="banner" value={form.banner} onChange={update} />
                <Input title="Trailer URL" type="url" name="trailer" value={form.trailer} onChange={update} />
              </section>

              <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-6">
                <button type="button" disabled={saving} onClick={onClose} className="rounded-full border border-white/15 px-7 py-3 text-sm font-semibold text-[#c7c7cf] hover:bg-white/10 disabled:opacity-40">
                  Discard
                </button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#ed2a47] disabled:opacity-40">
                  <Save size={16} />
                  {saving ? "Saving..." : movie ? "Save changes" : "Publish film"}
                </button>
              </div>
            </form>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function AdminMovies() {
  const { token } = useAuth();
  const reduced = useReducedMotion();

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState("");

  useEffect(() => {
    if (!refreshFeedback) return undefined;
    const timer = window.setTimeout(() => setRefreshFeedback(""), 5000);
    return () => window.clearTimeout(timer);
  }, [refreshFeedback]);

  const refreshController = useRef(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("RECENT");
  const [focusedId, setFocusedId] = useState(null);
  const [editor, setEditor] = useState({ open: false, movie: null });
  const [changingId, setChangingId] = useState(null);

  const load = useCallback(async (signal) => {
    if (!token) return false;

    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`${API_URL}/api/movies/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      if (signal?.aborted) return false;

      setMovies(Array.isArray(response.data.movies) ? response.data.movies : []);
      return true;
    } catch (problem) {
      if (signal?.aborted || axios.isCancel(problem)) return false;
      setError(problem.response?.data?.error || "Could not load the film catalogue.");
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

  useEffect(() => () => refreshController.current?.abort(), []);

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
        const confirmation = "Movie catalogue refreshed successfully.";
        setRefreshFeedback(confirmation);
        toast.success(confirmation);
      } else {
        toast.error("Could not refresh the movie catalogue.");
      }
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
      if (refreshController.current === controller) refreshController.current = null;
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const entries = movies.filter((movie) => {
      const itemStatus = movie.listingStatus || "ACTIVE";

      return (
        (status === "ALL" || status === itemStatus) &&
        (!query ||
          [movie.title, movie.genre, movie.language, movie.director, movie.producer]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query))
      );
    });

    return entries.sort((a, b) => {
      if (sort === "AZ") {
        return String(a.title || "").localeCompare(String(b.title || ""));
      }

      if (sort === "RATING") {
        return Number(b.avgRating || 0) - Number(a.avgRating || 0);
      }

      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [movies, search, status, sort]);

  const selected = filtered.find((movie) => movie._id === focusedId) || filtered[0] || null;

  const counts = useMemo(() => ({
    ALL: movies.length,
    ACTIVE: movies.filter((movie) => !movie.listingStatus || movie.listingStatus === "ACTIVE").length,
    COMING_SOON: movies.filter((movie) => movie.listingStatus === "COMING_SOON").length,
    HIDDEN: movies.filter((movie) => movie.listingStatus === "HIDDEN").length,
  }), [movies]);

  const changeStatus = async (movie) => {
    const hidden = movie.listingStatus === "HIDDEN";

    const confirmed = window.confirm(
      hidden
        ? `Restore "${movie.title}" to public listings?`
        : `Hide "${movie.title}"? Existing bookings remain unchanged.`
    );

    if (!confirmed) return;

    setChangingId(movie._id);

    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      if (hidden) {
        await axios.put(`${API_URL}/api/movies/${movie._id}`, { listingStatus: "ACTIVE" }, config);
      } else {
        await axios.delete(`${API_URL}/api/movies/${movie._id}`, config);
      }

      toast.success(hidden ? "Film restored." : "Film hidden.");
      await load();
    } catch (problem) {
      toast.error(
        problem.response?.data?.error ||
        problem.response?.data?.message ||
        "Could not update film visibility."
      );
    } finally {
      setChangingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1550px] text-white">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.27em] text-[#ff607a]">
            <span className="h-px w-8 bg-[#D71935]" /> Catalogue / 03
          </p>
          <h1 className="mt-4 text-[clamp(2.25rem,3.8vw,4rem)] font-semibold leading-[0.95] tracking-[-0.075em] text-[#f4f1ed]">
            The film <span className="text-[#d83b55]">vault.</span>
          </h1>
          <p className="mt-5 text-sm leading-7 text-[#9898a4]">
            Every title your cinemas can put on the big screen.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditor({ open: true, movie: null })}
          className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#ef2b48]"
        >
          <Plus size={18} /> Add a film
        </button>
      </header>

      <div className="mt-10 flex flex-wrap items-center gap-2 border-b border-white/10 pb-5" role="group" aria-label="Film status">
        {["ALL", ...statusOptions].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            aria-pressed={status === item}
            className={`rounded-full border px-4 py-2.5 text-xs font-semibold transition ${
              status === item
                ? "border-[#D71935] bg-[#D71935] text-white"
                : "border-white/10 text-[#aaaaaf] hover:border-white/30 hover:text-white"
            }`}
          >
            {item === "ALL" ? "All films" : displayStatus(item)}
            <span className="ml-2 opacity-60">{counts[item]}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[190px] flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a95]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a film, genre, director..."
            aria-label="Search films"
            className={`${inputClass} pl-11`}
          />
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#202025] px-4 py-3 text-xs text-[#a2a2ac]">
          <ArrowDownAZ size={16} />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="bg-transparent font-semibold text-white outline-none"
            aria-label="Sort films"
          >
            <option className="bg-[#202025]" value="RECENT">Newest added</option>
            <option className="bg-[#202025]" value="AZ">A to Z</option>
            <option className="bg-[#202025]" value="RATING">Highest rated</option>
          </select>
        </label>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          aria-busy={refreshing}
          className="inline-flex shrink-0 items-center gap-3 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-[#ededed] transition-colors duration-300 hover:border-[#D71935] hover:bg-[#D71935]/10 disabled:cursor-wait disabled:opacity-60"
        >
          <motion.span
            className="inline-flex h-4 w-4 items-center justify-center"
            animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={refreshing
              ? { duration: 2.4, repeat: Infinity, ease: "linear" }
              : { duration: 0.25, ease: "easeOut" }}
          >
            <RefreshCw size={16} />
          </motion.span>
          {refreshing ? "Refreshing..." : "Refresh data"}
        </button>
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-4 text-xs text-emerald-300">
        {refreshFeedback}
      </p>

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && movies.length === 0 ? (
        <div role="status" className="mt-12 h-80 animate-pulse rounded-[24px] bg-white/[0.05]" />
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-[24px] border border-dashed border-white/15 p-16 text-center">
          <Film size={34} className="mx-auto text-[#6b6b75]" />
          <p className="mt-4 text-xl font-semibold">No films found</p>
          <p className="mt-2 text-sm text-[#96969f]">Try different filters or add a title.</p>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(350px,0.85fr)]">
          <section
            className="min-w-0 overflow-hidden rounded-[23px] border border-white/[0.08] bg-[#121215]"
            aria-label="Film catalogue"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8c8c96]">
              <span>Film index</span>
              <span>{filtered.length} results</span>
            </div>

            <div className="max-h-[850px] overflow-y-auto">
              {filtered.map((movie, index) => {
                const active = selected?._id === movie._id;

                return (
                  <motion.button
                    key={movie._id}
                    type="button"
                    onClick={() => setFocusedId(movie._id)}
                    initial={reduced ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.022, 0.22) }}
                    aria-pressed={active}
                    className={`group flex w-full items-center gap-4 border-b border-white/[0.06] px-5 py-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D71935] ${
                      active
                        ? "bg-[#D71935]/[0.095]"
                        : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="hidden w-6 shrink-0 font-mono text-xs text-[#696972] sm:block">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Thumb movie={movie} className="h-[84px] w-[57px] shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-white">{movie.title}</p>
                      <p className="mt-1 truncate text-xs text-[#92929e]">
                        {[movie.genre, movie.language, movie.releaseYear].filter(Boolean).join(" · ")}
                      </p>
                      <div className="mt-2">
                        <Status status={movie.listingStatus} />
                      </div>
                    </div>
                    <ChevronRight
                      size={19}
                      className={`shrink-0 transition-transform ${
                        active
                          ? "translate-x-1 text-[#ff5b76]"
                          : "text-[#686873] group-hover:translate-x-1 group-hover:text-white"
                      }`}
                    />
                  </motion.button>
                );
              })}
            </div>
          </section>

          <AnimatePresence mode="wait">
            {selected && (
              <motion.aside
                key={selected._id}
                initial={reduced ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="min-w-0 overflow-hidden rounded-[23px] border border-white/[0.1] bg-[#19171b] xl:sticky xl:top-40"
              >
                <div className="relative h-[290px] overflow-hidden sm:h-[360px]">
                  <Thumb
                    movie={selected}
                    decorative
                    className="absolute inset-0 h-full w-full opacity-60 blur-[2px]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#19171b] via-[#19171b]/25 to-black/25" />
                  <div className="absolute bottom-0 left-0 right-0 flex items-end gap-5 p-6 sm:p-7">
                    <Thumb
                      movie={selected}
                      decorative
                      className="h-[150px] w-[100px] shrink-0 rounded-xl border border-white/20 shadow-xl"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#ff8195]">
                        Selected film
                      </p>
                      <h2 className="mt-2 text-[clamp(1.35rem,2.2vw,2.15rem)] font-semibold leading-tight tracking-[-0.045em] text-white">
                        {selected.title}
                      </h2>
                      <p className="mt-2 text-xs text-[#d4c7ca]">
                        {selected.genre || "Film"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 p-6 sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Status status={selected.listingStatus} />
                    {selected.avgRating != null && (
                      <span className="flex items-center gap-1.5 text-sm text-[#dddde2]">
                        <Star size={16} className="fill-[#D71935] text-[#D71935]" />
                        {selected.avgRating}/5
                      </span>
                    )}
                  </div>

                  <p className="line-clamp-4 text-sm leading-7 text-[#b6b5c0]">
                    {selected.description || "No synopsis provided."}
                  </p>

                  <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-t border-white/10 pt-5 text-xs">
                    {[
                      ["Director", selected.director],
                      ["Duration", selected.duration],
                      ["Language", selected.language],
                      ["Release year", selected.releaseYear],
                    ].map(([key, value]) => (
                      <div key={key}>
                        <p className="text-[#777782]">{key}</p>
                        <p className="mt-1.5 break-words font-semibold text-white">
                          {value || "—"}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setEditor({ open: true, movie: selected })}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D71935] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ed2947]"
                    >
                      <Pencil size={16} /> Edit details
                    </button>
                    <button
                      type="button"
                      disabled={changingId === selected._id}
                      onClick={() => changeStatus(selected)}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-[#dddde1] transition hover:border-[#D71935]/60 hover:bg-[#D71935]/10 disabled:opacity-40"
                    >
                      {selected.listingStatus === "HIDDEN"
                        ? <Eye size={16} />
                        : <EyeOff size={16} />}
                      {selected.listingStatus === "HIDDEN" ? "Restore" : "Hide film"}
                    </button>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      )}

      <Editor
        open={editor.open}
        movie={editor.movie}
        token={token}
        onClose={() => setEditor({ open: false, movie: null })}
        onSaved={() => load()}
      />
    </div>
  );
}
