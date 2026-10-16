
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CircleAlert,
  IndianRupee,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API = (
  process.env.REACT_APP_BACKEND_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

const ROOT = `${API}/api/admin/pricing`;

const INPUT =
  "w-full rounded-xl border border-white/10 bg-[#202024] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#D71935] disabled:opacity-50";

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
    description: "Hard limits on the final ticket-price multiplier.",
    fields: [
      ["minMultiplier", "Minimum multiplier", 0.8, 1, 0.01],
      ["maxMultiplier", "Maximum multiplier", 1, 1.5, 0.01],
    ],
  },
  {
    title: "Occupancy rules",
    description: "Only permanently booked seats count toward demand.",
    fields: [
      ["lowOccupancyThreshold", "Low occupancy (fraction)", 0, 1, 0.01],
      ["highOccupancyThreshold", "High occupancy (fraction)", 0, 1, 0.01],
      ["lowDemandDiscount", "Low-demand discount", 0, 0.2, 0.01],
      ["highDemandSurcharge", "High-demand surcharge", 0, 0.3, 0.01],
    ],
  },
  {
    title: "Showtime adjustments",
    description: "Additional modifiers, capped by your price boundaries.",
    fields: [
      ["last48HoursSurcharge", "Within 48 hours", 0, 0.15, 0.01],
      ["last12HoursSurcharge", "Within 12 hours", 0, 0.15, 0.01],
      ["weekendSurcharge", "Weekend", 0, 0.15, 0.01],
      ["openingWeekSurcharge", "Release week", 0, 0.15, 0.01],
    ],
  },
];

const fields = SECTIONS.flatMap((section) => section.fields);

const idOf = (record) => String(record?._id || "");

const showDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const formatPercent = (value) =>
  `${Math.round(Number(value) * 100)}%`;

const requestError = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  "Unable to reach the pricing service.";

function validate(draft) {
  if (!draft) return "Choose a show first.";

  for (const [key, label, minimum, maximum] of fields) {
    const raw = draft[key];
    const value = Number(raw);

    if (
      raw === "" ||
      raw === null ||
      !Number.isFinite(value) ||
      value < minimum ||
      value > maximum
    ) {
      return `${label} must be between ${minimum} and ${maximum}.`;
    }
  }

  if (
    Number(draft.minMultiplier) >
    Number(draft.maxMultiplier)
  ) {
    return "Minimum multiplier must not exceed maximum multiplier.";
  }

  if (
    Number(draft.lowOccupancyThreshold) >=
    Number(draft.highOccupancyThreshold)
  ) {
    return "Low occupancy threshold must be lower than high occupancy threshold.";
  }

  return null;
}

export default function AdminDynamicPricing() {
  const { token } = useAuth();
  const reducedMotion = useReducedMotion();

  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [shows, setShows] = useState([]);
  const [pagination, setPagination] = useState({
    pages: 0,
    total: 0,
  });

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load upcoming shows.
  useEffect(() => {
    if (!token) {
      setListLoading(false);
      return undefined;
    }

    const controller = new AbortController();

    setListLoading(true);
    setListError("");

    axios
      .get(ROOT, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: { page },
        signal: controller.signal,
        timeout: 12000,
      })
      .then(({ data }) => {
        const records = Array.isArray(data?.shows)
          ? data.shows
          : [];

        setShows(records);
        setPagination(
          data.pagination || {
            pages: 0,
            total: 0,
          }
        );

        setSelectedId((previous) =>
          records.some((show) => idOf(show) === previous)
            ? previous
            : idOf(records[0])
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setListError(requestError(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setListLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, page, refreshKey]);

  // Load the selected show's saved policy.
  useEffect(() => {
    if (!token || !selectedId) {
      setDraft(null);
      setOriginal(null);
      return undefined;
    }

    const controller = new AbortController();

    setDraft(null);
    setOriginal(null);
    setEditorError("");
    setEditorLoading(true);

    axios
      .get(`${ROOT}/${encodeURIComponent(selectedId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
        timeout: 12000,
      })
      .then(({ data }) => {
        const policy = {
          ...DEFAULT_POLICY,
          ...(data.policy || {}),
        };

        setDraft(policy);
        setOriginal(policy);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setEditorError(requestError(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setEditorLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, selectedId, refreshKey]);

  const selectedShow = shows.find(
    (show) => idOf(show) === selectedId
  );

  const visibleShows = useMemo(() => {
    const term = query.toLowerCase().trim();

    if (!term) return shows;

    return shows.filter((show) =>
      [
        show.movie?.title,
        show.theatre?.name,
        show.theatre?.city,
        show.screen?.name,
        show.screen?.screenNumber,
      ].some((part) =>
        String(part ?? "")
          .toLowerCase()
          .includes(term)
      )
    );
  }, [query, shows]);

  const enabledCount = shows.filter(
    (show) => show.dynamicPricing?.enabled
  ).length;

  const changed = Boolean(
    draft &&
      original &&
      JSON.stringify(draft) !== JSON.stringify(original)
  );

  const savePolicy = async (event) => {
    event.preventDefault();

    if (!selectedId || !draft || saving) return;

    const error = validate(draft);

    if (error) {
      toast.error(error);
      return;
    }

    if (
      draft.enabled &&
      !original?.enabled &&
      !window.confirm(
        "Enable dynamic pricing for this show? New payment requests may be charged adjusted prices."
      )
    ) {
      return;
    }

    const payload = {
      enabled: Boolean(draft.enabled),
    };

    for (const [key] of fields) {
      payload[key] = Number(draft[key]);
    }

    setSaving(true);

    try {
      const { data } = await axios.put(
        `${ROOT}/${encodeURIComponent(selectedId)}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 12000,
        }
      );

      const saved = {
        ...DEFAULT_POLICY,
        ...(data.policy || payload),
      };

      setDraft(saved);
      setOriginal(saved);

      setShows((old) =>
        old.map((show) =>
          idOf(show) === selectedId
            ? {
                ...show,
                dynamicPricing: saved,
              }
            : show
        )
      );

      toast.success(
        data.message || "Pricing policy saved."
      );
    } catch (error) {
      toast.error(requestError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] pb-20 text-white">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-7">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f07588]">
            <SlidersHorizontal size={14} />
            Revenue management
          </div>

          <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            Dynamic pricing
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-[#aaa9b3]">
            Set pricing limits by show. Every policy
            starts disabled and applies only when
            you enable it.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((n) => n + 1)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/5"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          [
            "Upcoming shows",
            pagination.total ?? 0,
            CalendarClock,
          ],
          [
            "Loaded on this page",
            shows.length,
            Activity,
          ],
          [
            "Dynamic pricing on",
            enabledCount,
            IndianRupee,
          ],
        ].map(([label, value, Icon]) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-[#17171b] p-4"
          >
            <div className="flex items-center justify-between text-xs text-white/50">
              {label}
              <Icon size={16} />
            </div>

            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(250px,0.85fr)_minmax(0,1.5fr)]">
        {/* SHOW SELECTION */}

        <section
          className="rounded-2xl border border-white/10 bg-[#17171b] p-4 sm:p-5"
          aria-label="Upcoming shows"
        >
          <h2 className="font-semibold">
            Upcoming shows
          </h2>

          <p className="mt-1 text-xs text-white/45">
            Choose a show to edit its policy.
          </p>

          <div className="relative mt-4">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
            />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Filter shows on this page"
              aria-label="Filter shows on this page"
              className={`${INPUT} pl-10`}
            />
          </div>

          {listError && (
            <p
              role="alert"
              className="mt-4 text-sm text-red-300"
            >
              {listError}
            </p>
          )}

          <div className="mt-4 max-h-[570px] space-y-2 overflow-y-auto pr-1">
            {listLoading && (
              <p className="p-4 text-sm text-white/50">
                Loading shows…
              </p>
            )}

            {!listLoading &&
              !visibleShows.length && (
                <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-white/50">
                  No matching upcoming shows.
                </p>
              )}

            {!listLoading &&
              visibleShows.map((show) => {
                const active =
                  selectedId === idOf(show);

                return (
                  <button
                    key={idOf(show)}
                    type="button"
                    onClick={() =>
                      setSelectedId(idOf(show))
                    }
                    aria-pressed={active}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      active
                        ? "border-[#D71935]/70 bg-[#D71935]/10"
                        : "border-white/10 bg-[#202024] hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold leading-5">
                        {show.movie?.title ||
                          "Untitled film"}
                      </span>

                      <span
                        className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
                          show.dynamicPricing?.enabled
                            ? "text-[#f38b9a]"
                            : "text-white/40"
                        }`}
                      >
                        {show.dynamicPricing?.enabled
                          ? "Active"
                          : "Fixed"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-white/50">
                      {showDate(show.startTime)}
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      {[
                        show.theatre?.name,
                        show.screen?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ") ||
                        "Cinema details unavailable"}
                    </p>
                  </button>
                );
              })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
            <span>
              Page {page} of{" "}
              {Math.max(
                1,
                Number(pagination.pages) || 1
              )}
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1 || listLoading}
                onClick={() =>
                  setPage((n) => n - 1)
                }
                className="rounded-lg border border-white/10 p-2 disabled:opacity-30"
              >
                <ArrowLeft size={15} />
              </button>

              <button
                type="button"
                aria-label="Next page"
                disabled={
                  page >=
                    (Number(pagination.pages) ||
                      0) ||
                  listLoading
                }
                onClick={() =>
                  setPage((n) => n + 1)
                }
                className="rounded-lg border border-white/10 p-2 disabled:opacity-30"
              >
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </section>

        {/* PRICING EDITOR */}

        <motion.section
          key={selectedId || "none"}
          initial={
            reducedMotion
              ? false
              : { opacity: 0, y: 8 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="min-w-0 rounded-2xl border border-white/10 bg-[#17171b] p-5 sm:p-7"
          aria-label="Pricing policy editor"
        >
          {!selectedId ? (
            <p className="py-20 text-center text-sm text-white/50">
              Select an upcoming show to
              configure pricing.
            </p>
          ) : editorLoading || !draft ? (
            <div className="py-20 text-center text-sm text-white/50">
              {editorError ? (
                <p
                  role="alert"
                  className="text-red-300"
                >
                  {editorError}
                </p>
              ) : (
                "Loading pricing policy…"
              )}
            </div>
          ) : (
            <form onSubmit={savePolicy}>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-white/45">
                    Selected show
                  </p>

                  <h2 className="mt-1 text-xl font-semibold tracking-tight">
                    {selectedShow?.movie?.title ||
                      "Upcoming show"}
                  </h2>

                  <p className="mt-1 text-xs text-white/50">
                    {showDate(
                      selectedShow?.startTime
                    )}
                  </p>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#222227] px-4 py-3">
                  <span className="text-sm font-medium">
                    Enable pricing
                  </span>

                  <input
                    type="checkbox"
                    checked={Boolean(
                      draft.enabled
                    )}
                    onChange={(event) =>
                      setDraft((old) => ({
                        ...old,
                        enabled:
                          event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[#D71935]"
                  />
                </label>
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#D71935]/20 bg-[#D71935]/[0.06] p-4">
                <CircleAlert
                  size={18}
                  className="mt-0.5 shrink-0 text-[#ec778a]"
                />

                <p className="text-xs leading-6 text-[#d1bdc1]">
                  {draft.enabled
                    ? "Dynamic pricing will apply to new payment requests after you save. Already-created PaymentIntents keep their existing price."
                    : "Fixed ticket prices remain in use. You can save these settings without activating them."}
                </p>
              </div>

              {SECTIONS.map((section) => (
                <fieldset
                  key={section.title}
                  className="mt-7 border-t border-white/10 pt-6"
                >
                  <legend className="sr-only">
                    {section.title}
                  </legend>

                  <h3 className="text-sm font-semibold">
                    {section.title}
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-white/45">
                    {section.description}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {section.fields.map(
                      ([
                        key,
                        label,
                        min,
                        max,
                        step,
                      ]) => (
                        <label
                          key={key}
                          className="block text-xs text-white/70"
                        >
                          <span>{label}</span>

                          <input
                            type="number"
                            inputMode="decimal"
                            min={min}
                            max={max}
                            step={step}
                            value={draft[key]}
                            required
                            onChange={(event) =>
                              setDraft((old) => ({
                                ...old,
                                [key]:
                                  event.target.value,
                              }))
                            }
                            className={`${INPUT} mt-1.5`}
                          />

                          <span className="mt-1 block text-[11px] text-white/35">
                            {key.includes(
                              "Multiplier"
                            )
                              ? `${min}×–${max}× base price`
                              : `${formatPercent(
                                  min
                                )}–${formatPercent(
                                  max
                                )}`}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                </fieldset>
              ))}

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
                <p className="text-xs text-white/50">
                  {changed
                    ? "Unsaved policy changes"
                    : "Policy up to date"}
                </p>

                <button
                  type="submit"
                  disabled={saving || !changed}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#D71935] px-6 py-3 text-sm font-semibold transition hover:bg-[#e72b47] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : changed ? (
                    <Save size={16} />
                  ) : (
                    <Check size={16} />
                  )}

                  {saving
                    ? "Saving…"
                    : "Save policy"}
                </button>
              </div>
            </form>
          )}
        </motion.section>
      </div>
    </div>
  );
}
