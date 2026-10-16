
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity, AlertTriangle, Armchair, CheckCircle2, CreditCard,
  RefreshCw, Search, ShieldAlert, ShieldCheck, Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const ENDPOINT = `${API_URL}/api/admin/risk`;
const EASE = [0.22, 1, 0.36, 1];
const PANEL = "rounded-[22px] border border-white/10 bg-[#111114]/90";
const INPUT = "w-full min-w-0 rounded-xl border border-white/10 bg-[#1a191e] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#D71935]/70";

const TYPE_LABELS = {
  EXCESSIVE_SEAT_HOLD_REQUESTS: "Excessive seat-hold requests",
  REPEATED_SEAT_CONFLICTS: "Repeated seat conflicts",
  REPEATED_PAYMENT_REQUEST_REJECTIONS: "Repeated payment rejections",
  EXCESSIVE_PAYMENT_CREATION_REQUESTS: "Excessive payment requests",
};

const number = (value) => Number(value || 0).toLocaleString("en-IN");

const isPayment = (event) =>
  String(event?.type || "").toUpperCase().includes("PAYMENT");

const displayType = (value) =>
  TYPE_LABELS[value] ||
  String(value || "Unclassified signal").replaceAll("_", " ").toLowerCase();

const maskHash = (value) =>
  value ? `••••${String(value).slice(-12)}` : "Unavailable";

const time = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return "Time unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

function Eyebrow({ children, index }) {
  return (
    <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff526e]">
      <span className="h-px w-7 bg-[#D71935]" />
      {children}
      <span className="text-zinc-600">/ {index}</span>
    </p>
  );
}

function Metric({ icon: Icon, title, value, subtitle }) {
  return (
    <div className={`${PANEL} p-5 transition-colors hover:border-[#D71935]/35 sm:p-6`}>
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
        <span>{title}</span>
        <Icon size={17} className="text-[#ff526e]" />
      </div>
      <p className="cine-head mt-5 text-3xl tabular-nums text-white">
        {number(value)}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">
        {subtitle}
      </p>
    </div>
  );
}

export default function AdminRiskMonitoring() {
  const { token } = useAuth();
  const reduced = useReducedMotion();

  const [events, setEvents] = useState([]);
  const [retained, setRetained] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const refreshController = useRef(null);

  const fetchSignals = useCallback(async (signal) => {
    if (!token) {
      setError("Administrator authentication is required.");
      return false;
    }

    setError("");

    try {
      const { data } = await axios.get(ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 100 },
        signal,
        timeout: 12000,
      });

      if (signal?.aborted) return false;

      if (data?.success !== true || !Array.isArray(data.events)) {
        throw new Error("Invalid risk-monitoring response.");
      }

      setEvents(data.events);
      setRetained(data.retained || {});
      return true;
    } catch (problem) {
      if (signal?.aborted || axios.isCancel(problem)) return false;

      setError(
        problem.response?.data?.message ||
        problem.message ||
        "Unable to load risk signals."
      );
      return false;
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetchSignals(controller.signal).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [fetchSignals]);

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

    setRefreshing(true);
    setNotice(false);

    try {
      const [success] = await Promise.all([
        fetchSignals(controller.signal),
        new Promise((resolve) => window.setTimeout(resolve, 650)),
      ]);

      if (!controller.signal.aborted && success) {
        setNotice(true);
      }
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);

      if (refreshController.current === controller) {
        refreshController.current = null;
      }
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();

    return events.filter((event) => {
      const payment = isPayment(event);

      if (category === "PAYMENT" && !payment) return false;
      if (category === "SEAT" && payment) return false;
      if (source !== "ALL" && event.source !== source) return false;

      if (period !== "ALL") {
        const timestamp = new Date(event.occurredAt).getTime();
        const windowMs = period === "24H" ? 86400000 : 7 * 86400000;

        if (!Number.isFinite(timestamp) || timestamp < now - windowMs) {
          return false;
        }
      }

      if (!term) return true;

      return [
        event.type,
        event.source,
        event.showId,
        event.accountHash,
        displayType(event.type),
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      );
    });
  }, [events, search, category, source, period]);

  const paymentCount = events.filter(isPayment).length;
  const seatCount = events.length - paymentCount;
  const distinctCount = new Set(
    events.map((event) => event.accountHash).filter(Boolean)
  ).size;

  const retainedCount = Object.values(retained).reduce(
    (sum, count) => sum + (Number(count) || 0),
    0
  );

  return (
    <div className="mx-auto max-w-[1460px] pb-16 text-white">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-7">
        <div className="min-w-0">
          <Eyebrow index="11">Security operations</Eyebrow>

          <h1 className="cine-display mt-5 text-[clamp(2.2rem,3.8vw,3.8rem)] leading-[1.14]">
            Risk <span className="text-[#ff4562]">monitoring.</span>
          </h1>

          <p className="mt-4 max-w-[590px] text-sm leading-7 text-zinc-400">
            Review recorded seat-hold conflicts and payment request patterns.
            Signals indicate activity worth examining, not confirmed fraud.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={refresh}
            disabled={loading || refreshing}
            aria-busy={refreshing}
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
            {refreshing ? "Refreshing..." : "Refresh signals"}
          </button>

          <div className="min-h-[20px]" aria-live="polite">
            <AnimatePresence>
              {notice && (
                <motion.p
                  key="refreshed"
                  role="status"
                  initial={reduced ? false : { opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-2 text-xs text-emerald-300"
                >
                  <CheckCircle2 size={15} />
                  Risk signals updated
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <section aria-label="Risk signal summary" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Activity}
          title="Signals loaded"
          value={events.length}
          subtitle="Up to 100 latest records"
        />
        <Metric
          icon={Armchair}
          title="Seat activity"
          value={seatCount}
          subtitle="Rate limits and seat conflicts"
        />
        <Metric
          icon={CreditCard}
          title="Payment activity"
          value={paymentCount}
          subtitle="Limits and request rejections"
        />
        <Metric
          icon={Users}
          title="Distinct accounts"
          value={distinctCount}
          subtitle="Unique account hashes in results"
        />
      </section>

      <section
        className="mt-6 flex items-start gap-4 rounded-[18px] border border-[#D71935]/25 bg-[#D71935]/[0.065] p-5"
        aria-label="Monitoring context"
      >
        <ShieldCheck
          size={21}
          className="mt-0.5 shrink-0 text-[#ff8295]"
        />
        <div>
          <h2 className="cine-head text-base text-white">
            Advisory signals, not confirmed fraud.
          </h2>
          <p className="mt-2 text-xs leading-6 text-zinc-400">
            Legitimate retries or network problems can trigger these thresholds.
            This dashboard does not automatically block accounts.
            Redis currently retains {number(retainedCount)} records across
            monitored streams. The API returns up to 100 recent records per request.
          </p>
        </div>
      </section>

      <section aria-label="Risk activity log" className={`${PANEL} mt-7 overflow-hidden`}>
        <div className="border-b border-white/10 p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow index="01">Signal archive</Eyebrow>
              <h2 className="cine-head mt-4 text-2xl text-white">
                Activity log
              </h2>
            </div>
            <span className="text-xs tabular-nums text-zinc-400">
              {number(filtered.length)} matching / {number(events.length)} loaded
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_170px_170px_145px]">
            <label className="relative min-w-0">
              <span className="sr-only">Search risk events</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search event, show or account"
                className={`${INPUT} pl-11`}
              />
            </label>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by activity"
              className={INPUT}
            >
              <option value="ALL">All activity</option>
              <option value="SEAT">Seat activity</option>
              <option value="PAYMENT">Payment activity</option>
            </select>

            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              aria-label="Filter by source"
              className={INPUT}
            >
              <option value="ALL">All sources</option>
              <option value="booking-risk">Risk detector</option>
              <option value="hold-rate-limit">Hold rate limiter</option>
            </select>

            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              aria-label="Filter by period"
              className={INPUT}
            >
              <option value="ALL">All retained</option>
              <option value="24H">Last 24 hours</option>
              <option value="7D">Last 7 days</option>
            </select>
          </div>

          {error && (
            <p role="alert" className="mt-5 flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs leading-6 text-rose-200">
              <AlertTriangle size={16} className="shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="space-y-3 p-4 sm:p-6" aria-live="polite">
          {loading && !events.length && (
            <p role="status" className="py-12 text-center text-sm text-zinc-500">
              Loading risk signals...
            </p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 px-5 py-14 text-center">
              <ShieldCheck size={30} className="mx-auto text-zinc-500" />
              <p className="cine-head mt-4 text-lg">No matching signals.</p>
              <p className="mt-2 text-xs text-zinc-500">
                Adjust the filters or refresh the activity log.
              </p>
            </div>
          )}

          {filtered.map((event, index) => {
            const payment = isPayment(event);
            const Icon = payment ? CreditCard : Armchair;
            const count =
              Number(event.count) ||
              Math.max(
                Number(event.minuteCount) || 0,
                Number(event.fifteenMinuteCount) || 0
              );

            return (
              <motion.article
                key={event.id || `${event.source}-${index}`}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  ease: EASE,
                  delay: reduced ? 0 : Math.min(index, 8) * 0.025,
                }}
                className="rounded-xl border border-white/[0.09] bg-[#19191d] p-4 transition-colors hover:border-[#D71935]/30 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D71935]/25 bg-[#D71935]/10 text-[#ff7189]">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="cine-head text-[15px] leading-6 text-white">
                        {displayType(event.type)}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {event.source === "booking-risk"
                          ? "Risk detection"
                          : "Seat-hold rate limiter"}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-zinc-400">
                    {time(event.occurredAt)}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 border-t border-white/[0.08] pt-4 text-xs sm:grid-cols-3">
                  <div>
                    <p className="text-zinc-500">Account reference</p>
                    <p className="mt-2 break-all font-mono text-zinc-200">
                      {maskHash(event.accountHash)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Show ID</p>
                    <p className="mt-2 break-all font-mono text-zinc-200">
                      {event.showId &&
                      !["unknown", "invalid"].includes(event.showId)
                        ? event.showId
                        : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Recorded requests</p>
                    <p className="mt-2 font-semibold tabular-nums text-zinc-200">
                      {count || "—"}
                    </p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      <p className="mt-6 flex items-center gap-2 text-[11px] text-zinc-500">
        <ShieldAlert size={14} className="text-[#ff526e]" />
        Read-only view of retained security signals.
      </p>
    </div>
  );
}
