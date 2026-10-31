
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Building2, Check, CheckCircle2,
  Mail, MapPin, Pencil, Phone, Plus, RefreshCw, Search, Trash2, X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const EASE = [0.22, 1, 0.36, 1];
const inputStyle = "w-full rounded-xl border border-white/10 bg-[#17171b] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 transition-colors focus:border-[#D71935]/70";
const emptyForm = () => ({
  name: "", city: "", street: "", area: "", state: "", postalCode: "",
  country: "India", description: "", coverImage: "", gallery: "",
  amenities: "", phone: "", email: "", latitude: "", longitude: "", isActive: true,
});
function addressOf(theatre) {
  const address = theatre?.address;
  if (typeof address === "string") return { street: address, city: theatre?.city || "" };
  return address && typeof address === "object" ? address : { city: theatre?.city || "" };
}
function locationOf(theatre) {
  const address = addressOf(theatre);
  return [address.area, theatre?.city || address.city, address.state].filter(Boolean).join(", ");
}
function Eyebrow({ children, index }) {
  return <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff526e]"><span className="h-px w-7 bg-[#D71935]" />{children}<span className="text-zinc-600">/ {index}</span></p>;
}
function VenueImage({ src, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className={`group relative overflow-hidden bg-[radial-gradient(ellipse_at_60%_10%,#4a202b,#141317_70%)] ${className}`}>
    {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      : <div className="flex h-full items-center justify-center"><Building2 size={40} strokeWidth={1.3} className="text-white/25" /></div>}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />
  </div>;
}
function Field({ label, name, form, onChange, ...props }) {
  return <label className="block min-w-0"><span className="mb-2 block text-xs text-zinc-400">{label}</span>
    <input name={name} value={form[name]} onChange={onChange} className={inputStyle} {...props} />
  </label>;
}
function VenueEditor({ theatre, token, onClose, onSaved }) {
  const reduced = useReducedMotion();
  const editing = Boolean(theatre?._id);
  const [form, setForm] = useState(() => {
    if (!editing) return emptyForm();
    const address = addressOf(theatre);
    return {
      name: theatre.name || "", city: theatre.city || address.city || "",
      street: address.street || "", area: address.area || "", state: address.state || "",
      postalCode: address.postalCode || "", country: address.country || "India",
      description: theatre.description || "", coverImage: theatre.coverImage || "",
      gallery: Array.isArray(theatre.gallery) ? theatre.gallery.join("\n") : "",
      amenities: Array.isArray(theatre.amenities) ? theatre.amenities.join(", ") : "",
      phone: theatre.contact?.phone || "", email: theatre.contact?.email || "",
      longitude: String(theatre.location?.coordinates?.[0] ?? ""),
      latitude: String(theatre.location?.coordinates?.[1] ?? ""),
      isActive: theatre.isActive !== false,
    };
  });
  const [tab, setTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const change = (event) => {
    const { name, type, value, checked } = event.target;
    setForm((previous) => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
  };
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event) => { if (event.key === "Escape" && !savingRef.current) onClose(); };
    document.addEventListener("keydown", onEscape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onEscape); };
  }, [onClose]);

  async function save(event) {
    event.preventDefault();
    if (savingRef.current) return;
    if (![form.name, form.city, form.street].every((value) => value.trim())) {
      toast.error("Cinema name, city and street are required."); setTab("details"); return;
    }
    const lat = form.latitude.trim();
    const lng = form.longitude.trim();
    if (Boolean(lat) !== Boolean(lng)) {
      toast.error("Enter both latitude and longitude, or neither."); setTab("media"); return;
    }
    if (lat && (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180)) {
      toast.error("Invalid map coordinates."); setTab("media"); return;
    }
    const payload = {
      name: form.name.trim(), city: form.city.trim(),
      address: {
        street: form.street.trim(), area: form.area.trim(), city: form.city.trim(),
        state: form.state.trim(), postalCode: form.postalCode.trim(),
        country: form.country.trim() || "India",
      },
      description: form.description.trim(), coverImage: form.coverImage.trim(),
      gallery: form.gallery.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      amenities: form.amenities.split(",").map((item) => item.trim()).filter(Boolean),
      contact: { phone: form.phone.trim(), email: form.email.trim() },
      isActive: form.isActive,
    };
    if (lat) payload.location = { type: "Point", coordinates: [Number(lng), Number(lat)] };
    savingRef.current = true;
    setSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (editing) await axios.put(`${API}/api/theatres/${theatre._id}`, payload, config);
      else await axios.post(`${API}/api/theatres`, payload, config);
      toast.success(editing ? "Cinema updated." : "Cinema created.");
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.message || "Unable to save cinema.");
    } finally { savingRef.current = false; setSaving(false); }
  }

  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[115] flex justify-end">
    <button type="button" aria-label="Close cinema editor" disabled={saving} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
    <motion.aside role="dialog" aria-modal="true" aria-label={editing ? "Edit cinema" : "Create cinema"}
      initial={reduced ? false : { x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: reduced ? 0 : 0.36, ease: EASE }}
      className="relative flex h-full w-full max-w-[740px] flex-col border-l border-white/10 bg-[#111115] text-white shadow-2xl">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
        <div><Eyebrow index="EDITOR">Cinema network</Eyebrow><h2 className="cine-head mt-3 text-[28px]">{editing ? "Edit cinema" : "Add a cinema"}<span className="text-[#ff4562]">.</span></h2></div>
        <button type="button" disabled={saving} onClick={onClose} aria-label="Close" className="rounded-full border border-white/15 p-2.5 text-zinc-400 hover:text-white disabled:opacity-40"><X size={18} /></button>
      </header>
      <div role="tablist" aria-label="Cinema editor sections" className="flex shrink-0 gap-2 border-b border-white/10 px-6 sm:px-8">
        {[["details", "01 / Identity"], ["media", "02 / Gallery & location"]].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`border-b-2 px-3 py-4 text-xs font-semibold transition-colors ${tab === key ? "border-[#D71935] text-white" : "border-transparent text-zinc-500 hover:text-white"}`}>{label}</button>)}
      </div>
      <form noValidate onSubmit={save} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-8">
          <div hidden={tab !== "details"} className="space-y-5">
            <Field label="Cinema name" name="name" form={form} onChange={change} required />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="City" name="city" form={form} onChange={change} required />
              <Field label="Street / road" name="street" form={form} onChange={change} required />
              <Field label="Neighbourhood / area" name="area" form={form} onChange={change} />
              <Field label="State" name="state" form={form} onChange={change} />
              <Field label="Postal code" name="postalCode" form={form} onChange={change} />
              <Field label="Country" name="country" form={form} onChange={change} />
              <Field label="Phone" name="phone" type="tel" form={form} onChange={change} />
              <Field label="Email" name="email" type="email" form={form} onChange={change} />
            </div>
            <label className="block"><span className="mb-2 block text-xs text-zinc-400">About this cinema</span>
              <textarea name="description" rows={4} value={form.description} onChange={change} className={`${inputStyle} resize-y`} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span><span className="block text-sm font-semibold text-white">Active cinema</span><span className="mt-1 block text-xs text-zinc-500">Available for public discovery</span></span>
              <input type="checkbox" name="isActive" checked={form.isActive} onChange={change} className="h-5 w-5 accent-[#D71935]" />
            </label>
          </div>
          <div hidden={tab !== "media"} className="space-y-5">
            <VenueImage src={form.coverImage} className="h-[220px] rounded-2xl" />
            <Field label="Cover image URL" name="coverImage" type="url" form={form} onChange={change} />
            <label className="block"><span className="mb-2 block text-xs text-zinc-400">Gallery image URLs — one per line</span>
              <textarea name="gallery" value={form.gallery} onChange={change} rows={5} className={`${inputStyle} resize-y`} />
            </label>
            <Field label="Amenities — comma separated" name="amenities" form={form} onChange={change} placeholder="Recliners, Parking, Dolby Atmos" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Latitude" name="latitude" type="number" step="any" form={form} onChange={change} />
              <Field label="Longitude" name="longitude" type="number" step="any" form={form} onChange={change} />
            </div>
            <p className="text-xs leading-6 text-zinc-500">Map coordinates are optional. Saved coordinates follow GeoJSON order: longitude, latitude.</p>
          </div>
        </div>
        <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/10 bg-[#111115] px-6 py-5 sm:px-8">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-full border border-white/15 px-6 py-3 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-40">Discard</button>
          <button type="submit" disabled={saving} className="rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold hover:bg-[#ed2b48] disabled:opacity-40">{saving ? "Saving..." : editing ? "Save cinema" : "Create cinema"}</button>
        </footer>
      </form>
    </motion.aside>
  </motion.div>;
}

export default function AdminTheatres() {
  const { token } = useAuth();
  const reduced = useReducedMotion();
  const [theatres, setTheatres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("ALL");
  const [focusedId, setFocusedId] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [editor, setEditor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const refreshController = useRef(null);

  const load = useCallback(async (signal) => {
    if (!token) { setLoading(false); return false; }
    setError("");
    try {
      const response = await axios.get(`${API}/api/admin/theatres`, { headers: { Authorization: `Bearer ${token}` }, signal });
      if (signal?.aborted) return false;
      setTheatres(Array.isArray(response.data?.theatres) ? response.data.theatres : []);
      return true;
    } catch (problem) {
      if (signal?.aborted || axios.isCancel(problem)) return false;
      setError(problem.response?.data?.error || "Unable to load cinema network.");
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
  const cities = useMemo(() => [...new Set(theatres.map((venue) => venue.city || addressOf(venue).city).filter(Boolean))].sort(), [theatres]);
  const filtered = useMemo(() => theatres.filter((venue) =>
    (city === "ALL" || (venue.city || addressOf(venue).city) === city) &&
    (!search.trim() || [venue.name, venue.city, locationOf(venue), venue.description]
      .filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()))
  ), [theatres, search, city]);
  const focused = filtered.find((venue) => venue._id === focusedId) || filtered[0] || null;
  const images = focused ? [...new Set([focused.coverImage, ...(Array.isArray(focused.gallery) ? focused.gallery : [])].filter(Boolean))] : [];
  const photo = images[Math.min(galleryIndex, Math.max(0, images.length - 1))];
  const activeCount = theatres.filter((venue) => venue.isActive !== false).length;
  const focus = (id) => { setFocusedId(id); setGalleryIndex(0); };

  async function changeActivity(venue) {
    if (busyId) return;
    const active = venue.isActive !== false;
    if (!window.confirm(`${active ? "Deactivate" : "Reactivate"} ${venue.name}?`)) return;
    setBusyId(venue._id);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (active) await axios.delete(`${API}/api/theatres/${venue._id}`, config);
      else await axios.put(`${API}/api/theatres/${venue._id}`, { isActive: true }, config);
      toast.success(active ? "Cinema deactivated." : "Cinema reactivated.");
      await load();
    } catch (problem) {
      toast.error(problem.response?.data?.error || problem.response?.data?.message || "Could not update cinema status.");
    } finally { setBusyId(null); }
  }

  return <div className="mx-auto max-w-[1460px] text-white">
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-7">
      <div><Eyebrow index="04">Cinema network</Eyebrow><h1 className="cine-display mt-5 text-[clamp(2.6rem,4.7vw,4.6rem)] leading-[.95]">Places worth <span className="text-[#ff4562]">going.</span></h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">Manage destinations, venue details and public availability across your network.</p>
      </div>
      <button type="button" onClick={() => setEditor({})} className="group inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold hover:bg-[#ed2b48]"><Plus size={17} />Add a cinema<ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></button>
    </header>
    <div className="mt-6 flex flex-wrap gap-7 border-b border-white/10 pb-6">
      {[["Locations", theatres.length], ["Active venues", activeCount], ["Cities", cities.length]].map(([label, value]) => <div key={label}><p className="cine-head text-2xl tabular-nums text-white">{value}</p><p className="mt-1 text-xs text-zinc-500">{label}</p></div>)}
    </div>
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input aria-label="Search cinemas" type="search" placeholder="Search cinema or neighbourhood..." value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputStyle} pl-11`} />
      </div>
      <select aria-label="Filter by city" value={city} onChange={(event) => setCity(event.target.value)} className={`${inputStyle} w-full sm:w-[180px]`}>
        <option value="ALL">All cities</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <button type="button" onClick={refresh} disabled={loading || refreshing} aria-busy={refreshing} className="inline-flex min-h-[45px] items-center gap-2.5 rounded-full border border-white/20 px-5 py-3 text-xs font-semibold text-zinc-200 hover:border-[#D71935]/60 hover:bg-[#D71935]/10 disabled:opacity-50">
        <motion.span className="inline-flex text-[#ff526e]" animate={refreshing && !reduced ? { rotate: 360 } : { rotate: 0 }} transition={refreshing && !reduced ? { duration: 1.1, repeat: Infinity, ease: "linear" } : { duration: 0.2 }}><RefreshCw size={16} /></motion.span>
        {refreshing ? "Refreshing..." : "Refresh cinemas"}
      </button>
    </div>
    <div className="mt-2 min-h-[20px] text-xs text-emerald-300" aria-live="polite"><AnimatePresence>{notice && <motion.p role="status" key="success" initial={reduced ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-2"><CheckCircle2 size={15} />Cinema data updated</motion.p>}</AnimatePresence></div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
    {loading && !theatres.length ? <div className="mt-8 h-[360px] animate-pulse rounded-[22px] bg-white/[0.05]" role="status" />
      : !filtered.length ? <div className="mt-7 rounded-[22px] border border-dashed border-white/15 p-12 text-center"><Building2 size={32} className="mx-auto text-zinc-600" /><p className="cine-head mt-4 text-xl">No cinemas found.</p><p className="mt-2 text-sm text-zinc-500">Adjust the filters or add a new destination.</p></div>
      : <div className="mt-7 grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
        <section className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.article key={focused._id} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden rounded-[22px] border border-white/10 bg-[#111114]/95">
              <div className="relative h-[320px] sm:h-[430px]"><VenueImage src={photo} className="absolute inset-0 h-full w-full" />
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 px-6 pb-7 sm:px-8">
                  <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff8295]">Featured destination</p>
                    <h2 className="cine-display mt-3 break-words text-[clamp(1.8rem,3.5vw,3.5rem)] leading-[.96]">{focused.name}</h2>
                    <p className="mt-3 flex items-center gap-2 text-xs text-zinc-200"><MapPin size={14} className="text-[#ff526e]" />{locationOf(focused) || "Location not specified"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${focused.isActive === false ? "border-white/20 bg-black/30 text-zinc-300" : "border-emerald-400/30 bg-black/40 text-emerald-300"}`}>{focused.isActive === false ? "Inactive" : "Active"}</span>
                </div>
              </div>
              <div className="space-y-5 p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3"><Eyebrow index="DETAILS">Venue information</Eyebrow><button type="button" onClick={() => setEditor(focused)} className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-5 py-2.5 text-xs font-semibold hover:bg-[#ed2b48]"><Pencil size={14} />Edit cinema</button></div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#17171b] p-3"><div><p className="text-xs font-semibold text-white">Location gallery</p><p className="mt-1 text-[11px] text-zinc-500">{images.length ? `${Math.min(galleryIndex + 1, images.length)} of ${images.length} photographs` : "No photographs available"}</p></div>
                  <div className="flex gap-2"><button type="button" aria-label="Previous photo" disabled={images.length < 2} onClick={() => setGalleryIndex((current) => (current + images.length - 1) % images.length)} className="rounded-full border border-white/15 p-2.5 hover:bg-white/10 disabled:opacity-30"><ArrowLeft size={15} /></button>
                    <button type="button" aria-label="Next photo" disabled={images.length < 2} onClick={() => setGalleryIndex((current) => (current + 1) % images.length)} className="rounded-full border border-white/15 p-2.5 hover:bg-white/10 disabled:opacity-30"><ArrowRight size={15} /></button></div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff526e]">About the venue</p>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">{focused.description || "No cinema description has been added."}</p>
                  <div className="mt-4 flex flex-wrap gap-2">{(Array.isArray(focused.amenities) ? focused.amenities : []).map((item) => <span key={item} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">{item}</span>)}</div>
                  <div className="mt-5 flex flex-wrap gap-5 text-xs text-zinc-400">{focused.contact?.phone && <span className="flex items-center gap-2"><Phone size={14} />{focused.contact.phone}</span>}{focused.contact?.email && <span className="flex items-center gap-2"><Mail size={14} />{focused.contact.email}</span>}</div>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </section>
        <aside className="min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#111114]/95 xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5"><h3 className="cine-head text-lg">Network directory</h3><span className="text-xs text-zinc-500">{filtered.length} venues</span></div>
          <div className="max-h-[570px] overflow-y-auto p-2">
            {filtered.map((venue, index) => <button type="button" key={venue._id} onClick={() => focus(venue._id)} className={`group flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${focused._id === venue._id ? "bg-[#D71935]/[0.12]" : "hover:bg-white/[0.04]"}`}>
              <VenueImage src={venue.coverImage} className="h-[68px] w-[80px] shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1"><p className="text-[10px] tabular-nums text-[#ff526e]">{String(index + 1).padStart(2, "0")}</p><p className="cine-head mt-1 truncate text-sm">{venue.name}</p><p className="mt-1 truncate text-xs text-zinc-500">{venue.city || addressOf(venue).city || "Location unknown"}</p><p className={`mt-1 text-[10px] ${venue.isActive === false ? "text-zinc-500" : "text-emerald-300"}`}>{venue.isActive === false ? "Inactive" : "Active"}</p></div>
              {focused._id === venue._id && <Check size={15} className="shrink-0 text-[#ff526e]" />}
            </button>)}
          </div>
          <div className="border-t border-white/10 p-4"><button type="button" disabled={busyId === focused._id} onClick={() => changeActivity(focused)} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-xs font-semibold text-zinc-300 hover:border-[#D71935]/60 hover:bg-[#D71935]/10 disabled:opacity-40"><Trash2 size={15} />{focused.isActive === false ? "Reactivate selected cinema" : "Deactivate selected cinema"}</button></div>
        </aside>
      </div>}
    <AnimatePresence>{editor !== null && <VenueEditor key={editor._id || "new"} theatre={editor} token={token} onClose={() => setEditor(null)} onSaved={load} />}</AnimatePresence>
  </div>;
}
