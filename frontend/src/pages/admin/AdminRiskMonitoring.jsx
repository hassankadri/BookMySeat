
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlertTriangle,
  Armchair,
  CreditCard,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

const API_URL = (
  process.env.REACT_APP_BACKEND_URL || ""
).replace(/\/+$/, "");

const ENDPOINT = `${API_URL}/api/admin/risk`;

const TYPE_LABELS = {
  EXCESSIVE_SEAT_HOLD_REQUESTS:
    "Excessive seat-hold requests",
  REPEATED_SEAT_CONFLICTS:
    "Repeated seat conflicts",
  REPEATED_PAYMENT_REQUEST_REJECTIONS:
    "Repeated payment rejections",
  EXCESSIVE_PAYMENT_CREATION_REQUESTS:
    "Excessive payment requests",
};

function isPaymentSignal(event) {
  return String(event.type || "")
    .toUpperCase()
    .includes("PAYMENT");
}

function formatDate(value) {
  if (!value) return "Time unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function displayType(type) {
  return (
    TYPE_LABELS[type] ||
    String(type || "Unclassified signal")
      .replace(/_/g, " ")
      .toLowerCase()
  );
}

function maskAccount(hash) {
  if (!hash) return "Unavailable";
  return `••••${String(hash).slice(-12)}`;
}

function MetricCard({ title, value, description, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#17171b] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-white/55">
          {title}
        </span>

        <Icon
          size={17}
          strokeWidth={1.7}
          className="text-[#ec647d]"
        />
      </div>

      <p className="mt-4 text-3xl font-semibold tracking-tight text-white tabular-nums">
        {value.toLocaleString("en-IN")}
      </p>

      <p className="mt-2 text-xs leading-5 text-white/40">
        {description}
      </p>
    </div>
  );
}

export default function AdminRiskMonitoring() {
  const { token } = useAuth();

  const [events, setEvents] = useState([]);
  const [retained, setRetained] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [period, setPeriod] = useState("ALL");

  // =====================================================
  // LOAD ADMIN RISK SIGNALS
  // =====================================================

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Administrator authentication is required.");
      return undefined;
    }

    const controller = new AbortController();

    setLoading(true);
    setError("");

    axios
      .get(ENDPOINT, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: { limit: 100 },
        signal: controller.signal,
        timeout: 12000,
      })
      .then(({ data }) => {
        if (!data?.success || !Array.isArray(data.events)) {
          throw new Error("Invalid risk-monitoring response.");
        }

        setEvents(data.events);
        setRetained(data.retained || {});
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;

        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Risk events could not be loaded."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, refreshKey]);

  // =====================================================
  // FILTERS
  // =====================================================

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();

    return events.filter((event) => {
      const payment = isPaymentSignal(event);

      if (category === "PAYMENT" && !payment) return false;
      if (category === "SEAT" && payment) return false;

      if (source !== "ALL" && event.source !== source) {
        return false;
      }

      if (period !== "ALL") {
        const timestamp = new Date(
          event.occurredAt
        ).getTime();

        const windowMs =
          period === "24H"
            ? 24 * 60 * 60 * 1000
            : 7 * 24 * 60 * 60 * 1000;

        if (
          !Number.isFinite(timestamp) ||
          timestamp < now - windowMs
        ) {
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
      ]
        .some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(term)
        );
    });
  }, [events, search, category, source, period]);

  const paymentEvents = events.filter(
    isPaymentSignal
  ).length;

  const seatEvents =
    events.length - paymentEvents;

  const uniqueAccounts = new Set(
    events
      .map((event) => event.accountHash)
      .filter(Boolean)
  ).size;

  const retainedTotal =
    Object.values(retained).reduce(
      (total, count) =>
        total + (Number(count) || 0),
      0
    );

  const selectClass =
    "rounded-xl border border-white/10 bg-[#1e1e23] px-3 py-2.5 text-sm text-white outline-none focus:border-[#D71935]";

  return (
    <div className="mx-auto max-w-[1440px] pb-16 text-white">
      {/* HEADING */}

      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-7">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ef7188]">
            <ShieldAlert size={15} />
            Security operations
          </div>

          <h1 className="mt-4 text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-tight tracking-[-0.06em]">
            Fraud monitoring
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a6a5ae]">
            Review abnormal booking activity and payment
            requests. Signals identify patterns that
            may require investigation.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            setRefreshKey((value) => value + 1)
          }
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-medium transition hover:border-[#D71935]/60 hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh events
        </button>
      </header>

      {/* SUMMARY */}

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Signals loaded"
          value={events.length}
          description="Latest events returned by Redis"
          icon={Activity}
        />

        <MetricCard
          title="Seat-related"
          value={seatEvents}
          description="Hold limits and seat conflicts"
          icon={Armchair}
        />

        <MetricCard
          title="Payment-related"
          value={paymentEvents}
          description="Payment request limits and rejections"
          icon={CreditCard}
        />

        <MetricCard
          title="Distinct accounts"
          value={uniqueAccounts}
          description="Unique account hashes in loaded events"
          icon={Users}
        />
      </div>

      {/* CONTEXT */}

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-[#17171b] p-4">
        <ShieldCheck
          size={19}
          className="mt-0.5 shrink-0 text-[#f0788d]"
        />

        <div>
          <p className="text-sm font-medium text-white">
            Advisory signals, not confirmed fraud
          </p>

          <p className="mt-1 text-xs leading-6 text-white/50">
            Rate limits and repeated conflicts can also
            result from legitimate retries or network
            problems. No account is automatically
            blocked by this dashboard.
            {" "}Redis currently retains{" "}
            {retainedTotal.toLocaleString("en-IN")}{" "}
            signal records across the monitored streams.
            This screen loads up to the latest 100.
          </p>
        </div>
      </div>

      {/* FILTERS */}

      <section className="mt-8 rounded-2xl border border-white/10 bg-[#17171b] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Activity log
            </h2>

            <p className="mt-1 text-xs text-white/45">
              {filtered.length} matching signals
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_160px_130px]">
          <label className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search event, show or account"
              aria-label="Search risk events"
              className={`${selectClass} w-full pl-10`}
            />
          </label>

          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value)
            }
            aria-label="Filter by activity"
            className={selectClass}
          >
            <option value="ALL">All activity</option>
            <option value="SEAT">Seat activity</option>
            <option value="PAYMENT">Payment activity</option>
          </select>

          <select
            value={source}
            onChange={(event) =>
              setSource(event.target.value)
            }
            aria-label="Filter by source"
            className={selectClass}
          >
            <option value="ALL">All sources</option>
            <option value="booking-risk">
              Risk detector
            </option>
            <option value="hold-rate-limit">
              Hold rate limits
            </option>
          </select>

          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value)
            }
            aria-label="Filter by period"
            className={selectClass}
          >
            <option value="ALL">All retained</option>
            <option value="24H">Last 24 hours</option>
            <option value="7D">Last 7 days</option>
          </select>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
          >
            <AlertTriangle
              size={17}
              className="mt-0.5 shrink-0"
            />
            {error}
          </div>
        )}

        {/* EVENT RESULTS */}

        <div
          className="mt-5 space-y-2"
          aria-live="polite"
        >
          {loading && !events.length && (
            <p className="py-12 text-center text-sm text-white/50">
              Loading security events…
            </p>
          )}

          {!loading && !error && !filtered.length && (
            <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
              <ShieldCheck
                size={28}
                className="mx-auto text-white/35"
              />

              <p className="mt-4 text-sm font-medium text-white/80">
                No matching signals
              </p>

              <p className="mt-2 text-xs text-white/40">
                Adjust the filters or refresh
                the activity log.
              </p>
            </div>
          )}

          {filtered.map((event) => {
            const payment = isPaymentSignal(event);
            const Icon = payment
              ? CreditCard
              : Armchair;

            return (
              <article
                key={event.id}
                className="rounded-xl border border-white/10 bg-[#202024] p-4 transition-colors hover:border-white/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D71935]/20 bg-[#D71935]/10 text-[#f17a90]">
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-6">
                        {displayType(event.type)}
                      </h3>

                      <p className="mt-1 text-xs text-white/45">
                        {event.source === "booking-risk"
                          ? "Risk detection"
                          : "Seat-hold rate limiter"}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs text-white/45">
                    {formatDate(event.occurredAt)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-3">
                  <div>
                    <p className="text-white/40">
                      Account reference
                    </p>

                    <p className="mt-1 break-all font-mono text-white/75">
                      {maskAccount(event.accountHash)}
                    </p>
                  </div>

                  <div>
                    <p className="text-white/40">
                      Show
                    </p>

                    <p className="mt-1 break-all font-mono text-white/75">
                      {event.showId &&
                      event.showId !== "unknown" &&
                      event.showId !== "invalid"
                        ? event.showId
                        : "Not specified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-white/40">
                      Recorded requests
                    </p>

                    <p className="mt-1 font-semibold tabular-nums text-white/75">
                      {event.count ||
                        Math.max(
                          event.minuteCount || 0,
                          event.fifteenMinuteCount || 0
                        ) ||
                        "—"}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
