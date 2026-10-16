
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";
import toast from "react-hot-toast";

import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  Monitor,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";

import {
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  Link,
  Navigate,
} from "react-router-dom";

import {
  useAuth,
} from "../../context/AuthContext";

// =====================================================
// CONFIGURATION
// =====================================================

const API_URL = (
  process.env.REACT_APP_BACKEND_URL || ""
).replace(/\/+$/, "");

const API = `${API_URL}/api/partner/theatres`;

const AMENITY_OPTIONS = [
  "Parking",
  "Food & Beverages",
  "Wheelchair Accessible",
  "Dolby Atmos",
  "IMAX",
  "4DX",
  "Recliner Seats",
  "Lounger Seats",
  "3D",
  "Air Conditioning",
  "Online Food Ordering",
];

const TABS = [
  {
    id: "details",
    label: "Theatre details",
    icon: Building2,
  },
  {
    id: "screens",
    label: "Screens",
    icon: Monitor,
  },
  {
    id: "shows",
    label: "Showtimes",
    icon: CalendarDays,
  },
  {
    id: "bookings",
    label: "Bookings",
    icon: Ticket,
  },
];

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#18181c] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#D71935]/70";

const PANEL_CLASS =
  "overflow-hidden rounded-[24px] border border-white/10 bg-[#121215]";

// =====================================================
// HELPERS
// =====================================================

function toDraft(theatre) {
  return {
    description:
      theatre?.description || "",

    amenities:
      Array.isArray(theatre?.amenities)
        ? [...theatre.amenities]
        : [],

    contact: {
      phone:
        theatre?.contact?.phone || "",

      email:
        theatre?.contact?.email || "",

      whatsapp:
        theatre?.contact?.whatsapp || "",
    },
  };
}

function equal(first, second) {
  return (
    JSON.stringify(first) ===
    JSON.stringify(second)
  );
}

function getError(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    fallback
  );
}

function getAddress(theatre) {
  if (!theatre) return "";

  const address = theatre.address;

  if (typeof address === "string") {
    return [address, theatre.city]
      .filter(Boolean)
      .join(", ");
  }

  if (address && typeof address === "object") {
    return [
      address.street,
      address.area,
      address.locality,
      theatre.city,
    ]
      .filter(Boolean)
      .join(", ");
  }

  return theatre.city || "";
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function formatMoney(amount, currency = "INR") {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: currency || "INR",
        maximumFractionDigits: 2,
      }
    ).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function readable(value) {
  return String(value || "—")
    .replace(/_/g, " ");
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-white/55">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        maxLength={254}
        className={INPUT_CLASS}
      />
    </label>
  );
}

function Status({ status }) {
  const current = String(
    status || "UNKNOWN"
  ).toUpperCase();

  const positive = [
    "CONFIRMED",
    "SCHEDULED",
    "COMPLETED",
  ].includes(current);

  const negative = [
    "CANCELLED",
    "PAYMENT_FAILED",
    "EXPIRED",
    "REFUNDED",
  ].includes(current);

  const className = positive
    ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
    : negative
      ? "border-red-500/20 bg-red-500/[0.08] text-red-300"
      : "border-white/10 bg-white/[0.05] text-white/60";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] ${className}`}
    >
      {readable(current)}
    </span>
  );
}

function PanelLoading() {
  return (
    <div className="flex min-h-[280px] items-center justify-center gap-3 text-sm text-white/45">
      <Loader2
        size={19}
        className="animate-spin text-[#D71935]"
      />

      Loading cinema information...
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex min-h-[270px] flex-col items-center justify-center px-6 text-center">
      <Icon
        size={31}
        strokeWidth={1.5}
        className="text-white/25"
      />

      <h3 className="mt-5 text-lg font-semibold">
        {title}
      </h3>

      <p className="mt-3 max-w-sm text-sm leading-6 text-white/40">
        {description}
      </p>
    </div>
  );
}

// =====================================================
// MAIN DASHBOARD
// =====================================================

export default function PartnerDashboard() {
  const {
    user,
    token,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const reducedMotion = useReducedMotion();

  const [theatres, setTheatres] = useState([]);
  const [selectedId, setSelectedId] =
    useState(null);

  const [draft, setDraft] = useState(null);

  const [activeTab, setActiveTab] =
    useState("details");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [revision, setRevision] = useState(0);

  // =====================================================
  // SECONDARY DATA
  // =====================================================

  const [resource, setResource] = useState({
    theatreId: null,
    tab: null,
    items: [],
  });

  const [resourceLoading, setResourceLoading] =
    useState(false);

  const [resourceError, setResourceError] =
    useState("");

  const [resourceRevision, setResourceRevision] =
    useState(0);

  // =====================================================
  // SCREEN RENAME STATE
  // =====================================================

  const [editingScreenId, setEditingScreenId] =
    useState(null);

  const [screenName, setScreenName] =
    useState("");

  const [savingScreen, setSavingScreen] =
    useState(false);

  const isPartner =
    isAuthenticated &&
    user?.role === "partner";

  // =====================================================
  // FETCH ASSIGNED THEATRES
  // =====================================================

  useEffect(() => {
    if (!isPartner || !token) {
      setLoading(false);
      return undefined;
    }

    const controller =
      new AbortController();

    setLoading(true);
    setError("");

    axios
      .get(API, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
        timeout: 15000,
      })
      .then(({ data }) => {
        if (
          !data?.success ||
          !Array.isArray(data.theatres)
        ) {
          throw new Error(
            "Invalid theatre response."
          );
        }

        const assigned = data.theatres;

        setTheatres(assigned);

        setSelectedId((current) => {
          const stillAssigned =
            assigned.some(
              (theatre) =>
                theatre._id === current
            );

          return stillAssigned
            ? current
            : assigned[0]?._id || null;
        });
      })
      .catch((requestError) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          getError(
            requestError,
            "Unable to load assigned theatres."
          )
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    isPartner,
    token,
    revision,
  ]);

  // =====================================================
  // THEATRE SELECTION
  // =====================================================

  const selected = useMemo(
    () =>
      theatres.find(
        (theatre) =>
          theatre._id === selectedId
      ) || null,
    [theatres, selectedId]
  );

  useEffect(() => {
    setDraft(
      selected
        ? toDraft(selected)
        : null
    );
  }, [selected]);

  const original = useMemo(
    () => toDraft(selected),
    [selected]
  );

  const dirty =
    Boolean(selected && draft) &&
    !equal(draft, original);

  const filteredTheatres = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    if (!term) {
      return theatres;
    }

    return theatres.filter((theatre) =>
      [
        theatre.name,
        theatre.city,
        getAddress(theatre),
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term)
      )
    );
  }, [theatres, search]);

  const cityCount = new Set(
    theatres
      .map((theatre) =>
        String(theatre.city || "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  ).size;

  const selectTheatre = (theatreId) => {
    if (
      theatreId === selectedId ||
      saving ||
      savingScreen
    ) {
      return;
    }

    if (
      dirty &&
      !window.confirm(
        "Discard unsaved theatre changes?"
      )
    ) {
      return;
    }

    setSelectedId(theatreId);
    setEditingScreenId(null);
    setScreenName("");
  };

  // =====================================================
  // LOAD SCREENS / SHOWTIMES / BOOKINGS
  // =====================================================

  useEffect(() => {
    if (
      !isPartner ||
      !token ||
      !selectedId ||
      activeTab === "details"
    ) {
      setResourceLoading(false);
      return undefined;
    }

    const controller =
      new AbortController();

    const tab = activeTab;
    const theatreId = selectedId;

    setResource({
      theatreId,
      tab,
      items: [],
    });

    setResourceLoading(true);
    setResourceError("");

    axios
      .get(
        `${API}/${theatreId}/${tab}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
          signal: controller.signal,
          timeout: 15000,
        }
      )
      .then(({ data }) => {
        if (
          !data?.success ||
          !Array.isArray(data[tab])
        ) {
          throw new Error(
            "Invalid cinema data response."
          );
        }

        setResource({
          theatreId,
          tab,
          items: data[tab],
        });
      })
      .catch((requestError) => {
        if (controller.signal.aborted) {
          return;
        }

        setResourceError(
          getError(
            requestError,
            `Failed to load ${tab}.`
          )
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setResourceLoading(false);
        }
      });

    return () =>
      controller.abort();
  }, [
    isPartner,
    token,
    selectedId,
    activeTab,
    resourceRevision,
  ]);

  const currentItems =
    resource.theatreId === selectedId &&
    resource.tab === activeTab
      ? resource.items
      : [];

  // =====================================================
  // THEATRE EDITING
  // =====================================================

  const updateContact = (field, value) => {
    setDraft((current) => ({
      ...current,

      contact: {
        ...current.contact,
        [field]: value,
      },
    }));
  };

  const toggleAmenity = (amenity) => {
    setDraft((current) => {
      const exists =
        current.amenities.includes(amenity);

      return {
        ...current,

        amenities: exists
          ? current.amenities.filter(
              (item) => item !== amenity
            )
          : [
              ...current.amenities,
              amenity,
            ],
      };
    });
  };

  const resetChanges = () => {
    if (selected) {
      setDraft(toDraft(selected));
    }
  };

  const saveTheatre = async (event) => {
    event.preventDefault();

    if (
      !selected ||
      !draft ||
      !dirty ||
      saving ||
      !token
    ) {
      return;
    }

    const updates = {};

    if (
      draft.description !==
      original.description
    ) {
      updates.description =
        draft.description.trim();
    }

    if (
      !equal(
        draft.amenities,
        original.amenities
      )
    ) {
      updates.amenities = draft.amenities;
    }

    const contactChanges = {};

    Object.keys(draft.contact).forEach(
      (field) => {
        if (
          draft.contact[field] !==
          original.contact[field]
        ) {
          contactChanges[field] =
            draft.contact[field].trim();
        }
      }
    );

    if (Object.keys(contactChanges).length) {
      updates.contact = contactChanges;
    }

    if (!Object.keys(updates).length) {
      return;
    }

    setSaving(true);

    try {
      const { data } = await axios.patch(
        `${API}/${selected._id}`,
        updates,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
          timeout: 15000,
        }
      );

      if (
        !data?.success ||
        !data.theatre
      ) {
        throw new Error(
          "The update was not confirmed."
        );
      }

      setTheatres((current) =>
        current.map((theatre) =>
          theatre._id ===
          data.theatre._id
            ? data.theatre
            : theatre
        )
      );

      setDraft(
        toDraft(data.theatre)
      );

      toast.success(
        "Theatre information updated."
      );
    } catch (requestError) {
      toast.error(
        getError(
          requestError,
          "Unable to save theatre details."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // SCREEN RENAMING
  // =====================================================

  const startScreenEdit = (screen) => {
    setEditingScreenId(screen._id);
    setScreenName(screen.name || "");
  };

  const cancelScreenEdit = () => {
    setEditingScreenId(null);
    setScreenName("");
  };

  const renameScreen = async (
    event,
    screenId
  ) => {
    event.preventDefault();

    if (
      savingScreen ||
      !selectedId ||
      !token
    ) {
      return;
    }

    const name =
      screenName.trim();

    if (
      name.length < 2 ||
      name.length > 100
    ) {
      toast.error(
        "Screen name must contain 2–100 characters."
      );
      return;
    }

    setSavingScreen(true);

    try {
      const { data } = await axios.patch(
        `${API}/${selectedId}/screens/${screenId}`,
        { name },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
          timeout: 15000,
        }
      );

      if (
        !data?.success ||
        !data.screen
      ) {
        throw new Error(
          "The screen update was not confirmed."
        );
      }

      setResource((current) => ({
        ...current,

        items: current.items.map(
          (screen) =>
            screen._id ===
            data.screen._id
              ? data.screen
              : screen
        ),
      }));

      cancelScreenEdit();

      toast.success(
        "Screen name updated."
      );
    } catch (requestError) {
      toast.error(
        getError(
          requestError,
          "Unable to update screen."
        )
      );
    } finally {
      setSavingScreen(false);
    }
  };

  // =====================================================
  // REFRESH
  // =====================================================

  const refresh = () => {
    if (saving || savingScreen) {
      return;
    }

    if (
      dirty &&
      !window.confirm(
        "Discard unsaved changes and refresh?"
      )
    ) {
      return;
    }

    setRevision(
      (current) => current + 1
    );

    setResourceRevision(
      (current) => current + 1
    );
  };

  // =====================================================
  // AUTHORIZATION
  // =====================================================

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] text-white/60">
        <Loader2
          size={22}
          className="mr-3 animate-spin text-[#D71935]"
        />

        Verifying partner access...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth"
        replace
      />
    );
  }

  if (!isPartner) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-[#09090b] pt-16 text-white">
      <main className="mx-auto max-w-[1480px] px-5 pb-24 pt-12 sm:px-8 lg:px-12">
        {/* HEADER */}

        <motion.header
          initial={
            reducedMotion
              ? false
              : {
                  opacity: 0,
                  y: 20,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.55,
            ease: [
              0.22,
              1,
              0.36,
              1,
            ],
          }}
          className="flex flex-wrap items-end justify-between gap-6"
        >
          <div>
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[#D71935]" />

              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f27890]">
                Cinema operations
              </p>
            </div>

            <h1 className="mt-5 text-[clamp(2.5rem,5vw,4.75rem)] font-semibold leading-none tracking-[-0.07em]">
              Partner portal
              <span className="text-[#D71935]">
                .
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/50">
              Manage your assigned cinema
              locations, screens, showtime
              schedules and booking activity.
            </p>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={
              loading ||
              saving ||
              savingScreen
            }
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-medium transition hover:border-[#D71935]/60 hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>
        </motion.header>

        {/* SUMMARY */}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className={`${PANEL_CLASS} p-6`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">
                Assigned cinemas
              </span>

              <Building2
                size={19}
                className="text-[#ec647d]"
              />
            </div>

            <p className="mt-5 text-4xl font-semibold tabular-nums tracking-tight">
              {theatres.length}
            </p>

            <p className="mt-2 text-xs text-white/35">
              Active locations assigned to your account
            </p>
          </div>

          <div className={`${PANEL_CLASS} p-6`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">
                Cities represented
              </span>

              <MapPin
                size={19}
                className="text-[#ec647d]"
              />
            </div>

            <p className="mt-5 text-4xl font-semibold tabular-nums tracking-tight">
              {cityCount}
            </p>

            <p className="mt-2 text-xs text-white/35">
              Across your assigned cinema locations
            </p>
          </div>
        </div>

        {/* ERRORS */}

        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
          >
            <CircleAlert
              size={19}
              className="shrink-0"
            />

            {error}
          </div>
        )}

        {/* WORKSPACE */}

        <div className="mt-10 grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* CINEMA SELECTION */}

          <section className={PANEL_CLASS}>
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">
                  Your cinemas
                </h2>

                <span className="text-xs text-white/40">
                  {theatres.length}
                </span>
              </div>

              <div className="relative mt-5">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Find a cinema"
                  aria-label="Search assigned cinemas"
                  className={`${INPUT_CLASS} pl-10`}
                />
              </div>
            </div>

            <div className="max-h-[600px] space-y-2 overflow-y-auto p-3">
              {loading &&
                !theatres.length && (
                  <PanelLoading />
                )}

              {!loading &&
                !filteredTheatres.length && (
                  <EmptyState
                    icon={Building2}
                    title={
                      theatres.length
                        ? "No matching cinemas"
                        : "No cinemas assigned"
                    }
                    description={
                      theatres.length
                        ? "Try a different search."
                        : "A platform administrator must assign a cinema to your account."
                    }
                  />
                )}

              {filteredTheatres.map(
                (theatre) => {
                  const active =
                    theatre._id ===
                    selectedId;

                  return (
                    <button
                      key={theatre._id}
                      type="button"
                      disabled={
                        saving ||
                        savingScreen
                      }
                      onClick={() =>
                        selectTheatre(
                          theatre._id
                        )
                      }
                      aria-pressed={active}
                      className={`group flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors ${
                        active
                          ? "border-[#D71935]/50 bg-[#D71935]/10"
                          : "border-transparent bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {theatre.name}
                        </p>

                        <p className="mt-2 flex items-center gap-1.5 text-xs text-white/45">
                          <MapPin size={12} />

                          {theatre.city}
                        </p>
                      </div>

                      <ChevronRight
                        size={17}
                        className={
                          active
                            ? "shrink-0 text-[#f27a90]"
                            : "shrink-0 text-white/30 transition-transform group-hover:translate-x-1"
                        }
                      />
                    </button>
                  );
                }
              )}
            </div>
          </section>

          {/* ACTIVE LOCATION */}

          <section className={`${PANEL_CLASS} min-w-0`}>
            {!selected ? (
              <EmptyState
                icon={Building2}
                title={
                  loading
                    ? "Loading your workspace"
                    : "Select a cinema"
                }
                description="Choose an assigned cinema to view its operations and management tools."
              />
            ) : (
              <>
                {/* LOCATION HEADER */}

                <div className="border-b border-white/10 p-6 sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f27890]">
                        Location management
                      </p>

                      <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
                        {selected.name}
                      </h2>

                      <p className="mt-3 flex items-start gap-2 text-sm text-white/45">
                        <MapPin
                          size={16}
                          className="mt-0.5 shrink-0"
                        />

                        {getAddress(selected)}
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-3 py-2 text-xs text-white/60">
                      <ShieldCheck size={14} />

                      Assigned location
                    </span>
                  </div>

                  <Link
                    to="/cinemas"
                    className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-white/60 transition hover:text-white"
                  >
                    View public cinema listings

                    <ArrowUpRight
                      size={14}
                    />
                  </Link>
                </div>

                {/* TABS */}

                <div className="border-b border-white/10 px-4 sm:px-7">
                  <div
                    role="tablist"
                    aria-label="Cinema management sections"
                    className="flex gap-1 overflow-x-auto"
                  >
                    {TABS.map((tab) => {
                      const Icon =
                        tab.icon;

                      const active =
                        activeTab ===
                        tab.id;

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={
                            active
                          }
                          onClick={() => {
                            setActiveTab(
                              tab.id
                            );

                            cancelScreenEdit();
                          }}
                          className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-5 text-xs font-semibold transition-colors ${
                            active
                              ? "text-white"
                              : "text-white/40 hover:text-white/75"
                          }`}
                        >
                          <Icon
                            size={15}
                          />

                          {tab.label}

                          {active && (
                            <motion.span
                              layoutId="partner-tab-indicator"
                              className="absolute inset-x-3 bottom-0 h-[2px] bg-[#D71935]"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ============================== */}
                {/* THEATRE DETAILS */}
                {/* ============================== */}

                {activeTab ===
                  "details" &&
                  draft && (
                    <form
                      onSubmit={
                        saveTheatre
                      }
                    >
                      <div className="space-y-9 p-6 sm:p-8">
                        <div>
                          <h3 className="text-base font-semibold">
                            Cinema description
                          </h3>

                          <p className="mt-2 text-xs leading-5 text-white/45">
                            Describe the experience
                            visitors can expect at
                            this location.
                          </p>

                          <textarea
                            value={
                              draft.description
                            }
                            onChange={(
                              event
                            ) =>
                              setDraft(
                                (
                                  current
                                ) => ({
                                  ...current,
                                  description:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            rows={5}
                            maxLength={1500}
                            className={`${INPUT_CLASS} mt-5 resize-y leading-6`}
                            placeholder="Describe your cinema..."
                          />

                          <p className="mt-2 text-right text-xs text-white/35">
                            {
                              draft
                                .description
                                .length
                            }
                            /1500
                          </p>
                        </div>

                        <div>
                          <h3 className="text-base font-semibold">
                            Contact information
                          </h3>

                          <p className="mt-2 text-xs leading-5 text-white/45">
                            Public contact
                            information for this
                            cinema.
                          </p>

                          <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <Field
                              label="Phone"
                              value={
                                draft
                                  .contact
                                  .phone
                              }
                              onChange={(
                                value
                              ) =>
                                updateContact(
                                  "phone",
                                  value
                                )
                              }
                              placeholder="Contact number"
                              type="tel"
                            />

                            <Field
                              label="WhatsApp"
                              value={
                                draft
                                  .contact
                                  .whatsapp
                              }
                              onChange={(
                                value
                              ) =>
                                updateContact(
                                  "whatsapp",
                                  value
                                )
                              }
                              placeholder="WhatsApp number"
                              type="tel"
                            />

                            <div className="sm:col-span-2">
                              <Field
                                label="Email"
                                value={
                                  draft
                                    .contact
                                    .email
                                }
                                onChange={(
                                  value
                                ) =>
                                  updateContact(
                                    "email",
                                    value
                                  )
                                }
                                placeholder="contact@cinema.com"
                                type="email"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-base font-semibold">
                            Cinema amenities
                          </h3>

                          <p className="mt-2 text-xs leading-5 text-white/45">
                            Select the facilities
                            available at this
                            location.
                          </p>

                          <div className="mt-5 grid gap-2 sm:grid-cols-2">
                            {[
                              ...new Set([
                                ...AMENITY_OPTIONS,
                                ...draft.amenities,
                              ]),
                            ].map(
                              (amenity) => {
                                const active =
                                  draft.amenities.includes(
                                    amenity
                                  );

                                return (
                                  <label
                                    key={
                                      amenity
                                    }
                                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                                      active
                                        ? "border-[#D71935]/50 bg-[#D71935]/10"
                                        : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        active
                                      }
                                      onChange={() =>
                                        toggleAmenity(
                                          amenity
                                        )
                                      }
                                      className="sr-only"
                                    />

                                    <span
                                      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${
                                        active
                                          ? "border-[#D71935] bg-[#D71935]"
                                          : "border-white/30"
                                      }`}
                                    >
                                      {active && (
                                        <Check
                                          size={13}
                                        />
                                      )}
                                    </span>

                                    {amenity}
                                  </label>
                                );
                              }
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-white/[0.025] p-5 sm:px-8">
                        <p className="max-w-sm text-xs leading-5 text-white/40">
                          Ownership, address and
                          activation are managed
                          by a platform
                          administrator.
                        </p>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={
                              resetChanges
                            }
                            disabled={
                              !dirty ||
                              saving
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm transition hover:bg-white/5 disabled:opacity-40"
                          >
                            <RotateCcw
                              size={15}
                            />

                            Discard
                          </button>

                          <button
                            type="submit"
                            disabled={
                              !dirty ||
                              saving
                            }
                            className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-5 py-3 text-sm font-semibold transition hover:bg-[#ed2544] disabled:opacity-40"
                          >
                            {saving ? (
                              <Loader2
                                size={16}
                                className="animate-spin"
                              />
                            ) : (
                              <Save
                                size={16}
                              />
                            )}

                            {saving
                              ? "Saving..."
                              : "Save changes"}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                {/* ============================== */}
                {/* SCREENS */}
                {/* ============================== */}

                {activeTab ===
                  "screens" && (
                    <div className="p-6 sm:p-8">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-semibold tracking-tight">
                            Cinema screens
                          </h3>

                          <p className="mt-2 text-sm text-white/45">
                            Review screen
                            configurations and
                            manage display names.
                          </p>
                        </div>

                        <Monitor
                          size={22}
                          className="text-[#ec647d]"
                        />
                      </div>

                      {resourceError && (
                        <p
                          role="alert"
                          className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
                        >
                          {resourceError}
                        </p>
                      )}

                      {resourceLoading ? (
                        <PanelLoading />
                      ) : !currentItems.length ? (
                        <EmptyState
                          icon={Monitor}
                          title="No screens available"
                          description="Screen inventory for this location is not available yet."
                        />
                      ) : (
                        <div className="mt-7 space-y-3">
                          {currentItems.map(
                            (screen) => {
                              const editing =
                                editingScreenId ===
                                screen._id;

                              return (
                                <div
                                  key={
                                    screen._id
                                  }
                                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                                        Screen{" "}
                                        {
                                          screen.screenNumber
                                        }
                                      </p>

                                      <h4 className="mt-2 text-lg font-semibold">
                                        {
                                          screen.name
                                        }
                                      </h4>
                                    </div>

                                    <Status
                                      status={
                                        screen.isActive
                                          ? "ACTIVE"
                                          : "INACTIVE"
                                      }
                                    />
                                  </div>

                                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/60">
                                    {[
                                      readable(
                                        screen.format
                                      ),
                                      readable(
                                        screen.audio
                                      ),
                                      `${screen.totalSeats || 0} seats`,
                                    ].map(
                                      (
                                        value
                                      ) => (
                                        <span
                                          key={
                                            value
                                          }
                                          className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5"
                                        >
                                          {
                                            value
                                          }
                                        </span>
                                      )
                                    )}
                                  </div>

                                  {editing ? (
                                    <form
                                      onSubmit={(
                                        event
                                      ) =>
                                        renameScreen(
                                          event,
                                          screen._id
                                        )
                                      }
                                      className="mt-5 flex flex-wrap items-center gap-2"
                                    >
                                      <input
                                        autoFocus
                                        value={
                                          screenName
                                        }
                                        maxLength={100}
                                        onChange={(
                                          event
                                        ) =>
                                          setScreenName(
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        aria-label="New screen name"
                                        className={`${INPUT_CLASS} min-w-[180px] flex-1`}
                                      />

                                      <button
                                        type="submit"
                                        disabled={
                                          savingScreen
                                        }
                                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D71935] disabled:opacity-50"
                                        aria-label="Save screen name"
                                      >
                                        {savingScreen ? (
                                          <Loader2
                                            size={17}
                                            className="animate-spin"
                                          />
                                        ) : (
                                          <Check
                                            size={17}
                                          />
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={
                                          cancelScreenEdit
                                        }
                                        disabled={
                                          savingScreen
                                        }
                                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15"
                                        aria-label="Cancel rename"
                                      >
                                        <X
                                          size={17}
                                        />
                                      </button>
                                    </form>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        startScreenEdit(
                                          screen
                                        )
                                      }
                                      disabled={
                                        !screen.isActive
                                      }
                                      className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-white/60 transition hover:text-white disabled:opacity-35"
                                    >
                                      <Pencil
                                        size={14}
                                      />

                                      Rename screen
                                    </button>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  )}

                {/* ============================== */}
                {/* SHOWTIMES */}
                {/* ============================== */}

                {activeTab ===
                  "shows" && (
                    <div className="p-6 sm:p-8">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-semibold tracking-tight">
                            Showtime schedule
                          </h3>

                          <p className="mt-2 text-sm text-white/45">
                            Recent scheduled,
                            completed and cancelled
                            shows at this cinema.
                          </p>
                        </div>

                        <CalendarDays
                          size={22}
                          className="text-[#ec647d]"
                        />
                      </div>

                      {resourceError && (
                        <p
                          role="alert"
                          className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
                        >
                          {resourceError}
                        </p>
                      )}

                      {resourceLoading ? (
                        <PanelLoading />
                      ) : !currentItems.length ? (
                        <EmptyState
                          icon={CalendarDays}
                          title="No showtimes found"
                          description="No showtime records are available for this location."
                        />
                      ) : (
                        <div className="mt-7 space-y-3">
                          {currentItems.map(
                            (show) => (
                              <article
                                key={
                                  show._id
                                }
                                className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <h4 className="text-base font-semibold">
                                      {show.movie
                                        ?.title ||
                                        "Movie unavailable"}
                                    </h4>

                                    <p className="mt-2 text-xs text-white/45">
                                      {show.screen
                                        ?.name ||
                                        "Screen unavailable"}
                                    </p>
                                  </div>

                                  <Status
                                    status={
                                      show.status
                                    }
                                  />
                                </div>

                                <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
                                  <div>
                                    <p className="text-[11px] text-white/35">
                                      Starts
                                    </p>

                                    <p className="mt-1.5 flex items-center gap-2 text-sm text-white/80">
                                      <Clock3
                                        size={14}
                                      />

                                      {formatDate(
                                        show.startTime
                                      )}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-[11px] text-white/35">
                                      Ends
                                    </p>

                                    <p className="mt-1.5 text-sm text-white/80">
                                      {formatDate(
                                        show.endTime
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-5 flex flex-wrap gap-2">
                                  <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">
                                    {readable(
                                      show.format
                                    )}
                                  </span>

                                  {show.language && (
                                    <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">
                                      {
                                        show.language
                                      }
                                    </span>
                                  )}

                                  {Array.isArray(
                                    show.pricing
                                  ) &&
                                    show.pricing.map(
                                      (
                                        price
                                      ) => (
                                        <span
                                          key={
                                            price.seatType
                                          }
                                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55"
                                        >
                                          {readable(
                                            price.seatType
                                          )}
                                          :{" "}
                                          {formatMoney(
                                            price.price
                                          )}
                                        </span>
                                      )
                                    )}
                                </div>
                              </article>
                            )
                          )}
                        </div>
                      )}

                      <p className="mt-6 text-xs leading-5 text-white/35">
                        Showing up to 200 recent
                        showtime records. Editing
                        an existing schedule remains
                        restricted to protect
                        reservations already in
                        progress.
                      </p>
                    </div>
                  )}

                {/* ============================== */}
                {/* BOOKINGS */}
                {/* ============================== */}

                {activeTab ===
                  "bookings" && (
                    <div className="p-6 sm:p-8">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-semibold tracking-tight">
                            Booking activity
                          </h3>

                          <p className="mt-2 text-sm text-white/45">
                            Recent reservations
                            associated with this
                            cinema.
                          </p>
                        </div>

                        <CreditCard
                          size={22}
                          className="text-[#ec647d]"
                        />
                      </div>

                      {resourceError && (
                        <p
                          role="alert"
                          className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
                        >
                          {resourceError}
                        </p>
                      )}

                      {resourceLoading ? (
                        <PanelLoading />
                      ) : !currentItems.length ? (
                        <EmptyState
                          icon={Ticket}
                          title="No recent bookings"
                          description="Booking activity for this location will appear here."
                        />
                      ) : (
                        <div className="mt-7 space-y-3">
                          {currentItems.map(
                            (
                              booking
                            ) => (
                              <article
                                key={
                                  booking._id
                                }
                                className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">
                                      Booking
                                    </p>

                                    <h4 className="mt-2 break-all font-mono text-sm font-semibold tracking-wide">
                                      {booking.bookingCode ||
                                        "Unavailable"}
                                    </h4>
                                  </div>

                                  <Status
                                    status={
                                      booking.status
                                    }
                                  />
                                </div>

                                <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2">
                                  <div>
                                    <p className="text-[11px] text-white/35">
                                      Movie
                                    </p>

                                    <p className="mt-2 text-sm font-medium">
                                      {booking.show
                                        ?.movie
                                        ?.title ||
                                        "Unavailable"}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-[11px] text-white/35">
                                      Showtime
                                    </p>

                                    <p className="mt-2 text-sm text-white/75">
                                      {formatDate(
                                        booking.show
                                          ?.startTime
                                      )}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-[11px] text-white/35">
                                      Seats
                                    </p>

                                    <p className="mt-2 text-sm text-white/75">
                                      {Array.isArray(
                                        booking.seats
                                      )
                                        ? booking.seats.join(
                                            ", "
                                          ) ||
                                          "Unavailable"
                                        : "Unavailable"}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-[11px] text-white/35">
                                      Total amount
                                    </p>

                                    <p className="mt-2 text-sm font-semibold text-white">
                                      {formatMoney(
                                        booking.totalAmount,
                                        booking.currency
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <p className="mt-5 text-xs text-white/35">
                                  Created{" "}
                                  {formatDate(
                                    booking.createdAt
                                  )}
                                </p>
                              </article>
                            )
                          )}
                        </div>
                      )}

                      <p className="mt-6 text-xs leading-5 text-white/35">
                        Displays up to 100 recent
                        bookings. Payment actions,
                        refunds and customer account
                        information are not
                        accessible from this portal.
                      </p>
                    </div>
                  )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
