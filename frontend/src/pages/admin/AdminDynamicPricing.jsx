
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity, ArrowLeft, ArrowRight, CalendarClock, CheckCircle2,
  CircleAlert, IndianRupee, RefreshCw, Save, Search, SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const ENDPOINT = `${API}/api/admin/pricing`;
const EASE = [0.22, 1, 0.36, 1];
const PANEL = "rounded-[22px] border border-white/10 bg-[#111114]/90";
const INPUT = "w-full rounded-xl border border-white/10 bg-[#1a191e] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#D71935]/70 disabled:opacity-50";

const DEFAULT_POLICY = {
  enabled: false,
  minMultiplier: 0.9,
  maxMultiplier: 1.3,
  lowOccupancyThreshold: 0.3,
  highOccupancyThreshold: 0.75,
  lowDemandDiscount: 0.05,
  highDemandSurcharge: 0.15,
  last48HoursSurcharge: 0.05,
  last12HoursSurcharge: 0.05,
  weekendSurcharge: 0.05,
  openingWeekSurcharge: 0.05,
};

const SECTIONS = [
  {
    title: "Price boundaries",
    subtitle: "The final multiplier never leaves these limits.",
    fields: [
      ["minMultiplier", "Minimum multiplier", 0.8, 1, 0.01],
      ["maxMultiplier", "Maximum multiplier", 1, 1.5, 0.01],
    ],
  },
  {
    title: "Occupancy rules",
    subtitle: "Demand is based on permanently booked seats.",
    fields: [
      ["lowOccupancyThreshold", "Low occupancy", 0, 1, 0.01],
      ["highOccupancyThreshold", "High occupancy", 0, 1, 0.01],
      ["lowDemandDiscount", "Low-demand discount", 0, 0.2, 0.01],
      ["highDemandSurcharge", "High-demand surcharge", 0, 0.3, 0.01],
    ],
  },
  {
    title: "Showtime adjustments",
    subtitle: "Additional modifiers, still subject to the price boundaries.",
    fields: [
      ["last48HoursSurcharge", "Within 48 hours", 0, 0.15, 0.01],
      ["last12HoursSurcharge", "Within 12 hours", 0, 0.15, 0.01],
      ["weekendSurcharge", "Weekend", 0, 0.15, 0.01],
      ["openingWeekSurcharge", "Release week", 0, 0.15, 0.01],
    ],
  },
];

const FIELDS = SECTIONS.flatMap((section) => section.fields);
const identifier = (show) => String(show?._id || "");
const formatNumber = (n) => Number(n || 0).toLocaleString("en-IN");

const formatDate = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Time unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const errorText = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  "Pricing service unavailable.";

const normalize = (value) => ({
  ...DEFAULT_POLICY,
  ...Object.fromEntries(
    Object.keys(DEFAULT_POLICY)
      .filter((key) => value?.[key] !== undefined)
      .map((key) => [key, value[key]])
  ),
});

function validationError(policy) {
  if (!policy) return "Choose a screening first.";

  for (const [key, label, low, high] of FIELDS) {
    const raw = policy[key];
    const n = Number(raw);

    if (raw === "" || raw == null || !Number.isFinite(n) || n < low || n > high) {
      return `${label} must be between ${low} and ${high}.`;
    }
  }

  if (Number(policy.minMultiplier) > Number(policy.maxMultiplier)) {
    return "Minimum multiplier cannot exceed maximum.";
  }

  if (Number(policy.lowOccupancyThreshold) >= Number(policy.highOccupancyThreshold)) {
    return "Low occupancy must be below high occupancy.";
  }

  return "";
}

function Eyebrow({ children, index }) {
  return (
    <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff526e]">
      <span className="h-px w-7 bg-[#D71935]" />
      {children}
      <span className="text-zinc-600">/ {index}</span>
    </p>
  );
}

function Metric({ label, value, icon: Icon, note }) {
  return (
    <div className={`${PANEL} p-5 transition-colors hover:border-[#D71935]/35 sm:p-6`}>
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
        <span>{label}</span>
        <Icon size={17} className="text-[#ff526e]" />
      </div>
      <p className="cine-head mt-4 text-3xl tabular-nums text-white">
        {formatNumber(value)}
      </p>
      <p className="mt-2 text-[11px] text-zinc-500">{note}</p>
    </div>
  );
}

export default function AdminDynamicPricing() {
  const { token } = useAuth();
  const reduced = useReducedMotion();

  const [page, setPage] = useState(1);
  const [shows, setShows] = useState([]);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(false);
  const refreshController = useRef(null);

  const loadShows = useCallback(async (signal) => {
    if (!token) {
      setListError("Administrator authentication is required.");
      return false;
    }

    setListError("");

    try {
      const { data } = await axios.get(ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page },
        signal,
        timeout: 12000,
      });

      if (signal?.aborted) return false;

      const records = Array.isArray(data?.shows) ? data.shows : [];

      setShows(records);
      setPagination(data?.pagination || { pages: 0, total: 0 });

      setSelectedId((previous) =>
        records.some((show) => identifier(show) === previous)
          ? previous
          : identifier(records[0])
      );

      return true;
    } catch (error) {
      if (signal?.aborted || axios.isCancel(error)) return false;
      setListError(errorText(error));
      return false;
    }
  }, [token, page]);

  const loadPolicy = useCallback(async (showId, signal) => {
    if (!token || !showId) return false;

    setEditorError("");

    try {
      const { data } = await axios.get(
        `${ENDPOINT}/${encodeURIComponent(showId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal,
          timeout: 12000,
        }
      );

      if (signal?.aborted) return false;

      const policy = normalize(data?.policy);
      setDraft(policy);
      setOriginal(policy);
      return true;
    } catch (error) {
      if (signal?.aborted || axios.isCancel(error)) return false;
      setEditorError(errorText(error));
      return false;
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setListLoading(true);

    loadShows(controller.signal).finally(() => {
      if (!controller.signal.aborted) setListLoading(false);
    });

    return () => controller.abort();
  }, [loadShows]);

  useEffect(() => {
    const controller = new AbortController();

    setDraft(null);
    setOriginal(null);

    if (!selectedId) return () => controller.abort();

    setEditorLoading(true);

    loadPolicy(selectedId, controller.signal).finally(() => {
      if (!controller.signal.aborted) setEditorLoading(false);
    });

    return () => controller.abort();
  }, [loadPolicy, selectedId]);

  useEffect(() => () => refreshController.current?.abort(), []);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = window.setTimeout(() => setNotice(false), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const changed = Boolean(
    draft && original && JSON.stringify(draft) !== JSON.stringify(original)
  );

  const selected = shows.find((show) => identifier(show) === selectedId);

  const visibleShows = useMemo(() => {
    const term = query.toLowerCase().trim();

    return !term
      ? shows
      : shows.filter((show) =>
          [
            show.movie?.title,
            show.theatre?.name,
            show.theatre?.city,
            show.screen?.name,
            show.screen?.screenNumber,
          ].some((part) => String(part ?? "").toLowerCase().includes(term))
        );
  }, [query, shows]);

  const activeCount = shows.filter((show) => show.dynamicPricing?.enabled).length;

  const confirmDiscard = () =>
    !changed || window.confirm("Discard the unsaved pricing changes?");

  function selectShow(id) {
    if (!saving && !refreshing && confirmDiscard()) setSelectedId(id);
  }

  function changePage(next) {
    if (saving || refreshing || listLoading || !confirmDiscard()) return;
    setPage(next);
  }

  async function refresh() {
    if (
      saving ||
      refreshing ||
      listLoading ||
      editorLoading ||
      !confirmDiscard()
    ) return;

    const controller = new AbortController();
    refreshController.current = controller;

    setNotice(false);
    setRefreshing(true);

    try {
      const [listOk, policyOk] = await Promise.all([
        loadShows(controller.signal),
        selectedId
          ? loadPolicy(selectedId, controller.signal)
          : Promise.resolve(true),
        new Promise((resolve) => window.setTimeout(resolve, 650)),
      ]);

      if (!controller.signal.aborted && listOk && policyOk) {
        setNotice(true);
      }
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);

      if (refreshController.current === controller) {
        refreshController.current = null;
      }
    }
  }

  async function save(event) {
    event.preventDefault();

    if (saving || refreshing || editorLoading || !selectedId || !draft) return;

    const invalid = validationError(draft);

    if (invalid) {
      toast.error(invalid);
      return;
    }

    if (
      draft.enabled &&
      !original?.enabled &&
      !window.confirm(
        "Enable dynamic pricing for this show? New payment requests may use adjusted ticket prices."
      )
    ) return;

    const payload = { enabled: Boolean(draft.enabled) };

    for (const [key] of FIELDS) {
      payload[key] = Number(draft[key]);
    }

    setSaving(true);

    try {
      const { data } = await axios.put(
        `${ENDPOINT}/${encodeURIComponent(selectedId)}`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 12000,
        }
      );

      const saved = normalize(data?.policy || payload);

      setDraft(saved);
      setOriginal(saved);

      setShows((previous) =>
        previous.map((show) =>
          identifier(show) === selectedId
            ? { ...show, dynamicPricing: saved }
            : show
        )
      );

      toast.success(data?.message || "Pricing policy saved.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1460px] pb-16 text-white">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-7">
        <div className="min-w-0">
          <Eyebrow index="10">Revenue management</Eyebrow>

          <h1 className="cine-display mt-5 text-[clamp(2.2rem,3.8vw,3.8rem)] leading-[1.14]">
            Intelligent <span className="text-[#ff4562]">pricing.</span>
          </h1>

          <p className="mt-4 max-w-[590px] text-sm leading-7 text-zinc-400">
            Fine-tune demand-based pricing per screening. Policies remain
            inactive until explicitly enabled and saved.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            aria-busy={refreshing}
            disabled={refreshing || saving || listLoading || editorLoading}
            onClick={refresh}
            className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.035] px-5 py-3 text-xs font-semibold text-zinc-200 transition-colors hover:border-[#D71935]/60 hover:bg-[#D71935]/10 disabled:opacity-50"
          >
            <motion.span
              className="inline-flex text-[#ff526e]"
              animate={refreshing && !reduced ? { rotate: 360 } : { rotate: 0 }}
              transition={
                refreshing && !reduced
                  ? { repeat: Infinity, duration: 1.15, ease: "linear" }
                  : { duration: 0.2 }
              }
            >
              <RefreshCw size={16} />
            </motion.span>
            {refreshing ? "Refreshing..." : "Refresh pricing"}
          </button>

          <div className="min-h-[20px]" aria-live="polite">
            <AnimatePresence>
              {notice && (
                <motion.p
                  key="success"
                  role="status"
                  initial={reduced ? false : { opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-2 text-xs text-emerald-300"
                >
                  <CheckCircle2 size={15} />
                  Pricing data updated
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <section aria-label="Pricing overview" className="mt-7 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Upcoming screenings"
          value={pagination.total}
          note="Across all result pages"
          icon={CalendarClock}
        />
        <Metric
          label="On this page"
          value={shows.length}
          note="Up to 30 screenings"
          icon={Activity}
        />
        <Metric
          label="Dynamic pricing active"
          value={activeCount}
          note="Count on this page only"
          icon={IndianRupee}
        />
      </section>

      <div className="mt-7 grid items-start gap-5 xl:grid-cols-[minmax(270px,.85fr)_minmax(0,1.5fr)]">
        <section className={`${PANEL} min-w-0 overflow-hidden`} aria-label="Upcoming shows">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <Eyebrow index="01">Choose a screening</Eyebrow>
            <h2 className="cine-head mt-4 text-2xl">Upcoming shows</h2>
            <p className="mt-2 text-xs text-zinc-500">
              Choose a screening to adjust its individual policy.
            </p>

            <div className="relative mt-5">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Filter shows on this page"
                placeholder="Search within this page"
                className={`${INPUT} pl-11`}
              />
            </div>

            {listError && (
              <p role="alert" className="mt-4 text-xs leading-6 text-rose-300">
                {listError}
              </p>
            )}
          </div>

          <div className="max-h-[620px] space-y-2 overflow-y-auto p-3">
            {listLoading && (
              <p role="status" className="p-5 text-sm text-zinc-400">
                Loading upcoming shows...
              </p>
            )}

            {!listLoading && !visibleShows.length && (
              <p className="p-5 text-sm text-zinc-500">
                No matching upcoming screenings.
              </p>
            )}

            {!listLoading && visibleShows.map((show, index) => {
              const active = identifier(show) === selectedId;

              return (
                <button
                  key={identifier(show)}
                  type="button"
                  disabled={saving || refreshing}
                  aria-pressed={active}
                  onClick={() => selectShow(identifier(show))}
                  className={`group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
                    active
                      ? "border-[#D71935]/60 bg-[#D71935]/10"
                      : "border-white/[0.07] bg-[#19191d] hover:border-white/25"
                  }`}
                >
                  <span className="mt-0.5 text-[10px] tabular-nums text-[#ff526e]">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="cine-head block break-words text-[15px] text-white">
                      {show.movie?.title || "Untitled film"}
                    </span>
                    <span className="mt-2 block text-xs text-zinc-400">
                      {formatDate(show.startTime)}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">
                      {[show.theatre?.name, show.screen?.name]
                        .filter(Boolean).join(" · ") || "Location unavailable"}
                    </span>
                  </span>

                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                    show.dynamicPricing?.enabled
                      ? "border-[#D71935]/50 bg-[#D71935]/15 text-[#ff8295]"
                      : "border-white/10 text-zinc-400"
                  }`}>
                    {show.dynamicPricing?.enabled ? "Dynamic" : "Fixed"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4 text-xs text-zinc-400 sm:px-6">
            <span>
              Page {page} / {Math.max(1, Number(pagination.pages) || 1)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1 || listLoading || refreshing || saving}
                onClick={() => changePage(page - 1)}
                className="rounded-full border border-white/15 p-2.5 hover:bg-white/10 disabled:opacity-30"
              >
                <ArrowLeft size={16} />
              </button>

              <button
                type="button"
                aria-label="Next page"
                disabled={page >= Number(pagination.pages || 0) || listLoading || refreshing || saving}
                onClick={() => changePage(page + 1)}
                className="rounded-full border border-white/15 p-2.5 hover:bg-white/10 disabled:opacity-30"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <motion.section
          key={selectedId || "empty"}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className={`${PANEL} min-w-0 overflow-hidden p-5 sm:p-7`}
          aria-label="Pricing policy editor"
        >
          {!selectedId ? (
            <p className="py-20 text-center text-sm text-zinc-400">
              Select an upcoming show to configure its pricing.
            </p>
          ) : editorLoading || !draft ? (
            <div className="py-20 text-center text-sm text-zinc-400" role="status">
              {editorError ? (
                <p role="alert" className="text-rose-300">{editorError}</p>
              ) : "Loading pricing policy..."}
            </div>
          ) : (
            <form onSubmit={save}>
              <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/10 pb-6">
                <div className="min-w-0">
                  <Eyebrow index="02">Policy editor</Eyebrow>
                  <h2 className="cine-head mt-4 break-words text-2xl">
                    {selected?.movie?.title || "Selected screening"}
                  </h2>
                  <p className="mt-2 text-xs text-zinc-400">
                    {formatDate(selected?.startTime)}
                  </p>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3">
                  <span className="text-xs font-semibold text-zinc-200">
                    Enable policy
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(draft.enabled)}
                    onChange={(event) => setDraft((previous) => ({
                      ...previous,
                      enabled: event.target.checked,
                    }))}
                    className="h-5 w-5 accent-[#D71935]"
                  />
                </label>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#D71935]/25 bg-[#D71935]/[0.07] p-4">
                <CircleAlert
                  size={18}
                  className="mt-0.5 shrink-0 text-[#ff8295]"
                />
                <p className="text-xs leading-6 text-zinc-300">
                  {draft.enabled
                    ? "Saving this enabled policy affects new payment requests. PaymentIntents created earlier retain their existing price."
                    : "Fixed prices remain active. You can save these parameters without enabling dynamic pricing."}
                </p>
              </div>

              {SECTIONS.map((section, index) => (
                <fieldset
                  key={section.title}
                  className="mt-7 border-t border-white/10 pt-6"
                >
                  <legend className="sr-only">{section.title}</legend>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff526e]">
                    {String(index + 1).padStart(2, "0")} / Rules
                  </p>
                  <h3 className="cine-head mt-3 text-xl text-white">
                    {section.title}
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-zinc-500">
                    {section.subtitle}
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {section.fields.map(([key, label, low, high, step]) => (
                      <label
                        key={key}
                        className="block rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"
                      >
                        <span className="block text-xs text-zinc-300">
                          {label}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          required
                          value={draft[key]}
                          min={low}
                          max={high}
                          step={step}
                          onChange={(event) => setDraft((previous) => ({
                            ...previous,
                            [key]: event.target.value,
                          }))}
                          className={`${INPUT} mt-3`}
                        />
                        <span className="mt-2 block text-[11px] text-zinc-500">
                          {key.includes("Multiplier")
                            ? `${low}×–${high}× base`
                            : `${Math.round(low * 100)}%–${Math.round(high * 100)}%`}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
                <p className={`text-xs ${changed ? "text-amber-200" : "text-zinc-500"}`}>
                  {changed ? "Unsaved changes" : "All changes saved"}
                </p>
                <button
                  type="submit"
                  disabled={!changed || saving || refreshing}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ed304d] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {saving
                    ? <RefreshCw size={16} className={reduced ? "" : "animate-spin"} />
                    : <Save size={16} />}
                  {saving ? "Saving..." : "Save policy"}
                </button>
              </div>
            </form>
          )}
        </motion.section>
      </div>
    </div>
  );
}
