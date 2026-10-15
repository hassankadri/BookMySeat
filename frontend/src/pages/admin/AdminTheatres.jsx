
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Building2, Check, Mail, MapPin,
  Pencil, Phone, Plus, RefreshCw, Search, Trash2, X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const INPUT = "w-full rounded-xl border border-white/10 bg-[#222227] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D71935]/70";
const ease = [0.22, 1, 0.36, 1];

const initialForm = () => ({
  name: "", city: "", street: "", area: "", state: "", postalCode: "",
  country: "India", description: "", coverImage: "", gallery: "",
  amenities: "", phone: "", email: "", latitude: "", longitude: "",
  isActive: true,
});

function addressOf(theatre) {
  const address = theatre?.address;

  if (typeof address === "string") {
    return { street: address, city: theatre?.city || "" };
  }

  return address && typeof address === "object"
    ? address
    : { city: theatre?.city || "" };
}

function locationOf(theatre) {
  const address = addressOf(theatre);
  return [address.area, theatre?.city || address.city, address.state]
    .filter(Boolean)
    .join(", ");
}

function Field({ title, name, value, onChange, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-[#a2a2ad]">
        {title}
      </span>
      <input name={name} value={value} onChange={onChange} className={INPUT} {...props} />
    </label>
  );
}

function TheatreImage({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <div className={`relative overflow-hidden bg-[radial-gradient(ellipse_at_70%_20%,#4a202b,#18171c_65%)] ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Building2 size={48} className="text-white/15" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/15" />
    </div>
  );
}

function TheatreEditor({ theatre, onClose, onSaved, token }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("details");
  const editing = Boolean(theatre?._id);

  useEffect(() => {
    if (!theatre) return;

    const address = addressOf(theatre);

    setForm({
      name: theatre.name || "",
      city: theatre.city || address.city || "",
      street: address.street || "",
      area: address.area || "",
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "India",
      description: theatre.description || "",
      coverImage: theatre.coverImage || "",
      gallery: Array.isArray(theatre.gallery) ? theatre.gallery.join("\n") : "",
      amenities: Array.isArray(theatre.amenities) ? theatre.amenities.join(", ") : "",
      phone: theatre.contact?.phone || "",
      email: theatre.contact?.email || "",
      longitude: String(theatre.location?.coordinates?.[0] ?? ""),
      latitude: String(theatre.location?.coordinates?.[1] ?? ""),
      isActive: theatre.isActive !== false,
    });

    setTab("details");
  }, [theatre]);

  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const escape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    document.addEventListener("keydown", escape);

    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", escape);
    };
  }, [saving, onClose]);

  const change = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((state) => ({
      ...state,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (![form.name, form.city, form.street].every((value) => value.trim())) {
      toast.error("Name, city and street address are required.");
      setTab("details");
      return;
    }

    const lat = form.latitude.trim();
    const lng = form.longitude.trim();

    if (Boolean(lat) !== Boolean(lng)) {
      toast.error("Enter both latitude and longitude, or neither.");
      setTab("media");
      return;
    }

    if (
      lat &&
      (!Number.isFinite(Number(lat)) ||
        !Number.isFinite(Number(lng)) ||
        Math.abs(Number(lat)) > 90 ||
        Math.abs(Number(lng)) > 180)
    ) {
      toast.error("Invalid map coordinates.");
      setTab("media");
      return;
    }

    const payload = {
      name: form.name.trim(),
      city: form.city.trim(),
      address: {
        street: form.street.trim(),
        area: form.area.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim() || "India",
      },
      description: form.description.trim(),
      coverImage: form.coverImage.trim(),
      gallery: form.gallery
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      amenities: form.amenities
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      contact: {
        phone: form.phone.trim(),
        email: form.email.trim(),
      },
      isActive: form.isActive,
    };

    if (lat) {
      payload.location = {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      };
    }

    setSaving(true);

    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      if (editing) {
        await axios.put(`${API}/api/theatres/${theatre._id}`, payload, config);
      } else {
        await axios.post(`${API}/api/theatres`, payload, config);
      }

      toast.success(editing ? "Cinema updated." : "Cinema added.");
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Unable to save cinema."
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
        type="button"
        aria-label="Close cinema editor"
        disabled={saving}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit cinema" : "Add cinema"}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.38, ease }}
        className="relative flex h-full w-full max-w-[740px] flex-col border-l border-white/10 bg-[#141417] text-white"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
          <div>
            <p className="text-[10px] uppercase tracking-[.23em] text-[#ff607a]">
              Cinema network / Editor
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {editing ? "Edit cinema" : "Add a cinema"}
            </h2>
          </div>
          <button
            type="button"
            disabled={saving}
            aria-label="Close"
            onClick={onClose}
            className="rounded-full border border-white/15 p-2.5 hover:bg-white/10"
          >
            <X size={19} />
          </button>
        </div>

        <div role="tablist" aria-label="Editor sections" className="flex shrink-0 gap-1 border-b border-white/10 px-6 sm:px-8">
          {[
            ["details", "01  Identity"],
            ["media", "02  Gallery & location"],
          ].map(([key, value]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`border-b-2 px-4 py-4 text-xs font-semibold transition ${
                tab === key
                  ? "border-[#D71935] text-white"
                  : "border-transparent text-zinc-500 hover:text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <form noValidate onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
            <div hidden={tab !== "details"} className="space-y-5">
              <Field title="Cinema name" name="name" value={form.name} onChange={change} required />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field title="City" name="city" value={form.city} onChange={change} required />
                <Field title="Street / road" name="street" value={form.street} onChange={change} required />
                <Field title="Area" name="area" value={form.area} onChange={change} />
                <Field title="State" name="state" value={form.state} onChange={change} />
                <Field title="Postal code" name="postalCode" value={form.postalCode} onChange={change} />
                <Field title="Country" name="country" value={form.country} onChange={change} />
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-zinc-400">
                  About this cinema
                </span>
                <textarea
                  name="description"
                  rows={4}
                  value={form.description}
                  onChange={change}
                  className={`${INPUT} resize-y`}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field title="Contact phone" name="phone" value={form.phone} onChange={change} />
                <Field title="Email" type="email" name="email" value={form.email} onChange={change} />
              </div>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.025] p-4">
                <span className="text-sm text-white">
                  Active cinema
                  <span className="mt-1 block text-xs text-zinc-500">
                    Can appear in public discovery
                  </span>
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

            <div hidden={tab !== "media"} className="space-y-5">
              <TheatreImage
                src={form.coverImage}
                alt="Cover preview"
                className="h-52 rounded-2xl"
              />
              <Field
                title="Cover image URL"
                name="coverImage"
                value={form.coverImage}
                onChange={change}
                placeholder="https://..."
              />
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-zinc-400">
                  Gallery image URLs · one per line
                </span>
                <textarea
                  rows={5}
                  name="gallery"
                  value={form.gallery}
                  onChange={change}
                  className={`${INPUT} resize-y`}
                  placeholder="https://cinema-image-1.jpg"
                />
              </label>
              <Field
                title="Amenities · comma separated"
                name="amenities"
                value={form.amenities}
                onChange={change}
                placeholder="Dolby Atmos, Recliners, Parking"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field title="Latitude" name="latitude" value={form.latitude} onChange={change} type="number" step="any" />
                <Field title="Longitude" name="longitude" value={form.longitude} onChange={change} type="number" step="any" />
              </div>
              <p className="text-xs leading-5 text-zinc-500">
                Optional coordinates use GeoJSON order [longitude, latitude] when saved.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-white/10 bg-[#141417] p-5 sm:px-8">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-full border border-white/15 px-6 py-3 text-sm text-zinc-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#D71935] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#ee2d4a] disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Save cinema" : "Create cinema"}
            </button>
          </div>
        </form>
      </motion.aside>
    </motion.div>
  );
}

export default function AdminTheatres() {
  const { token } = useAuth();
  const reduced = useReducedMotion();

  const [theatres, setTheatres] = useState([]);
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
  const [city, setCity] = useState("ALL");
  const [focusedId, setFocusedId] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [editor, setEditor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (signal) => {
    if (!token) return false;

    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`${API}/api/admin/theatres`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      if (signal?.aborted) return false;
      setTheatres(response.data.theatres || []);
      return true;
    } catch (error) {
      if (signal?.aborted || axios.isCancel(error)) return false;
      setError(error.response?.data?.error || "Unable to load cinema network.");
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
        const confirmation = "Cinema data refreshed successfully.";
        setRefreshFeedback(confirmation);
        toast.success(confirmation);
      } else {
        toast.error("Could not refresh cinema data.");
      }
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
      if (refreshController.current === controller) refreshController.current = null;
    }
  };

  const cities = useMemo(
    () => [...new Set(
      theatres
        .map((theatre) => theatre.city || addressOf(theatre).city)
        .filter(Boolean)
    )].sort(),
    [theatres]
  );

  const filtered = useMemo(() => theatres.filter((theatre) => {
    const query = search.trim().toLowerCase();
    const matchesCity = city === "ALL" ||
      (theatre.city || addressOf(theatre).city) === city;

    return matchesCity && (
      !query ||
      [theatre.name, theatre.city, locationOf(theatre), theatre.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }), [theatres, search, city]);

  const focused = filtered.find((theatre) => theatre._id === focusedId) || filtered[0] || null;

  const images = focused
    ? [...new Set([
        focused.coverImage,
        ...(Array.isArray(focused.gallery) ? focused.gallery : []),
      ].filter(Boolean))]
    : [];

  const photo = images[Math.min(galleryIndex, Math.max(0, images.length - 1))];

  const focusTheatre = (id) => {
    setFocusedId(id);
    setGalleryIndex(0);
  };

  const setActive = async (theatre) => {
    const active = theatre.isActive !== false;

    if (!window.confirm(`${active ? "Deactivate" : "Reactivate"} ${theatre.name}?`)) {
      return;
    }

    setBusyId(theatre._id);

    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      if (active) {
        await axios.delete(`${API}/api/theatres/${theatre._id}`, config);
      } else {
        await axios.put(`${API}/api/theatres/${theatre._id}`, { isActive: true }, config);
      }

      toast.success(active ? "Cinema deactivated." : "Cinema reactivated.");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Cinema status could not be updated.");
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = theatres.filter((theatre) => theatre.isActive !== false).length;

  return (
    <div className="mx-auto max-w-[1550px] text-white">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.25em] text-[#ff667d]">
            <span className="h-px w-8 bg-[#D71935]" /> Network / 04
          </p>
          <h1 className="mt-4 text-[clamp(2.25rem,3.8vw,4rem)] font-semibold leading-none tracking-[-.075em] text-[#f1eee9]">
            Places worth <span className="text-[#df3954]">going.</span>
          </h1>
          <p className="mt-5 text-sm leading-7 text-zinc-400">
            Your cinema network, presented as places—not database rows.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditor({})}
          className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold transition hover:bg-[#ed2b48]"
        >
          <Plus size={18} /> Add cinema
        </button>
      </header>

      <div className="mt-9 flex flex-wrap items-center gap-4 border-y border-white/10 py-5 text-xs text-zinc-400">
        <span>
          <strong className="mr-2 text-lg text-white">{theatres.length}</strong>
          Locations
        </span>
        <span className="h-5 w-px bg-white/10" />
        <span>
          <strong className="mr-2 text-lg text-white">{activeCount}</strong>
          Active
        </span>
        <span className="h-5 w-px bg-white/10" />
        <span>
          <strong className="mr-2 text-lg text-white">{cities.length}</strong>
          Cities
        </span>
      </div>

      <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a cinema or neighbourhood"
            aria-label="Search cinemas"
            className={`${INPUT} pl-11`}
          />
        </div>

        <select
          aria-label="Filter by city"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className={`${INPUT} w-full lg:w-[190px]`}
        >
          <option value="ALL">All cities</option>
          {cities.map((item) => <option key={item}>{item}</option>)}
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
        <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading && theatres.length === 0 ? (
        <div role="status" className="mt-8 h-96 animate-pulse rounded-3xl bg-white/5" />
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-white/15 p-16 text-center">
          <Building2 size={32} className="mx-auto text-zinc-600" />
          <p className="mt-4 text-lg font-semibold">No cinemas found</p>
          <p className="mt-2 text-sm text-zinc-500">
            Change your filters or add a location.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.8fr)]">
          <section className="min-w-0">
            <motion.div
              key={focused._id}
              initial={reduced ? false : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease }}
              className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[#19161b]"
            >
              <TheatreImage src={photo} alt={focused.name} className="h-[380px] sm:h-[510px]" />
              <div className="absolute bottom-0 left-0 right-0 p-7 sm:p-9">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <span className="rounded-full border border-white/25 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[.17em] backdrop-blur">
                      {focused.isActive === false ? "Inactive" : "Active location"}
                    </span>
                    <h2 className="mt-5 text-[clamp(2.4rem,5vw,4.6rem)] font-semibold leading-none tracking-[-.06em]">
                      {focused.name}
                    </h2>
                    <p className="mt-3 flex items-center gap-2 text-sm text-white/80">
                      <MapPin size={16} className="text-[#ff607c]" />
                      {locationOf(focused) || "Address unavailable"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditor(focused)}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-[#ffccd5]"
                  >
                    <Pencil size={16} /> Edit cinema
                  </button>
                </div>
              </div>
            </motion.div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/[.08] bg-[#141417] p-4">
              <div>
                <p className="text-[10px] uppercase tracking-[.2em] text-[#ff607c]">
                  Location gallery
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {images.length
                    ? `${Math.min(galleryIndex + 1, images.length)} of ${images.length} photographs`
                    : "No photographs uploaded"}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={images.length < 2}
                  aria-label="Previous photo"
                  onClick={() => setGalleryIndex((index) => (index + images.length - 1) % images.length)}
                  className="rounded-full border border-white/15 p-3 disabled:opacity-30"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  disabled={images.length < 2}
                  aria-label="Next photo"
                  onClick={() => setGalleryIndex((index) => (index + 1) % images.length)}
                  className="rounded-full border border-white/15 p-3 disabled:opacity-30"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/[.08] bg-[#141417] p-6">
              <p className="text-[10px] uppercase tracking-[.2em] text-[#ff607c]">
                About the venue
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                {focused.description || "No cinema description has been added yet."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(Array.isArray(focused.amenities) ? focused.amenities : []).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-5 text-xs text-zinc-400">
                {focused.contact?.phone && (
                  <span className="flex items-center gap-2">
                    <Phone size={14} /> {focused.contact.phone}
                  </span>
                )}
                {focused.contact?.email && (
                  <span className="flex items-center gap-2">
                    <Mail size={14} /> {focused.contact.email}
                  </span>
                )}
              </div>
            </div>
          </section>

          <aside className="min-w-0 xl:sticky xl:top-40 xl:self-start">
            <div className="overflow-hidden rounded-[25px] border border-white/10 bg-[#141417]">
              <div className="flex items-center justify-between border-b border-white/10 p-5">
                <h3 className="text-sm font-semibold text-white">Network directory</h3>
                <span className="text-xs text-zinc-500">{filtered.length} venues</span>
              </div>

              <div className="max-h-[640px] space-y-1 overflow-y-auto p-2">
                {filtered.map((theatre, index) => (
                  <button
                    key={theatre._id}
                    type="button"
                    onClick={() => focusTheatre(theatre._id)}
                    className={`group flex w-full gap-3 rounded-xl p-3 text-left transition ${
                      focused._id === theatre._id
                        ? "bg-[#D71935]/15"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <TheatreImage
                      src={theatre.coverImage}
                      alt=""
                      className="h-20 w-24 shrink-0 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-zinc-600">
                        {String(index + 1).padStart(2, "0")}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-white">
                        {theatre.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-400">
                        {theatre.city || addressOf(theatre).city || "City unspecified"}
                      </p>
                      <p className={`mt-1 text-[10px] ${
                        theatre.isActive === false
                          ? "text-zinc-500"
                          : "text-emerald-400"
                      }`}>
                        {theatre.isActive === false ? "Inactive" : "Active"}
                      </p>
                    </div>
                    {focused._id === theatre._id && (
                      <Check size={15} className="shrink-0 text-[#ff607c]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-white/10 p-4">
                <button
                  type="button"
                  disabled={busyId === focused._id}
                  onClick={() => setActive(focused)}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-[#D71935]/50 disabled:opacity-40"
                >
                  <Trash2 size={16} />
                  {focused.isActive === false
                    ? "Reactivate selected cinema"
                    : "Deactivate selected cinema"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      <AnimatePresence>
        {editor !== null && (
          <TheatreEditor
            theatre={editor}
            token={token}
            onClose={() => setEditor(null)}
            onSaved={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
