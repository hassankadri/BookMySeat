
import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import axios from "axios";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Armchair,
  BarChart3,
  Building2,
  CalendarPlus,
  CheckCircle2,
  Clapperboard,
  Film,
  LayoutDashboard,
  Menu,
  QrCode,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Ticket,
  Users,
  X,
} from "lucide-react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageShell from "../../components/ui/PageShell";
import "./adminTheme.css";

const API_URL = (
  process.env.REACT_APP_BACKEND_URL || ""
).replace(/\/+$/, "");

const EASE = [0.22, 1, 0.36, 1];

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

// These links correspond to the nested /admin routes in App.js.
const NAV_GROUPS = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        to: "/admin",
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: "Analytics",
        to: "/admin/analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    title: "Cinema network",
    items: [
      {
        label: "Movies",
        to: "/admin/movies",
        icon: Film,
      },
      {
        label: "Theatres",
        to: "/admin/theatres",
        icon: Building2,
      },
      {
        label: "Screens",
        to: "/admin/screens",
        icon: Armchair,
      },
    ],
  },
  {
    title: "Bookings & shows",
    items: [
      {
        label: "Add show",
        to: "/admin/add-show",
        icon: CalendarPlus,
      },
      {
        label: "Showtimes",
        to: "/admin/shows",
        icon: Activity,
      },
      {
        label: "Bookings",
        to: "/admin/bookings",
        icon: Ticket,
      },
      {
        label: "Ticket scanner",
        to: "/admin/scanner",
        icon: QrCode,
      },
    ],
  },
  {
    title: "Platform controls",
    items: [
      {
        label: "Dynamic pricing",
        to: "/admin/pricing",
        icon: SlidersHorizontal,
      },
      {
        label: "Risk monitoring",
        to: "/admin/risk",
        icon: ShieldAlert,
      },
      {
        label: "Users",
        to: "/admin/users",
        icon: Users,
      },
    ],
  },
];

function AdminSidebar({ onNavigate }) {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(null);
  const animationScope = useId();

  return (
    <div className="bms-admin-sidebar flex h-full flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-6 pb-7 pt-8 sm:px-7">
        <Link
          to="/admin"
          onClick={onNavigate}
          aria-label="BookMySeat admin dashboard"
          className="group flex min-w-0 items-center gap-3"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-[#D71935]/35 bg-[#D71935]/10 text-[#ff5772] transition-colors duration-300 group-hover:bg-[#D71935]/20">
            <Clapperboard
              size={21}
              strokeWidth={1.65}
            />
          </span>

          <span className="min-w-0">
            <span className="cine-head block truncate text-[20px] leading-none text-white">
              BookMySeat
              <span className="text-[#ff4968]">.</span>
            </span>
            <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Administration
            </span>
          </span>
        </Link>

        <button
          type="button"
          aria-label="Close navigation"
          onClick={onNavigate}
          className="rounded-full border border-white/10 p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X size={17} />
        </button>
      </div>

      <div
        className="bms-admin-nav min-h-0 flex-1 space-y-8 overflow-y-auto px-4 pb-10 pt-7 sm:px-5"
        onMouseLeave={() => setHovered(null)}
      >
        {NAV_GROUPS.map((group) => (
          <nav
            key={group.title}
            aria-label={group.title}
          >
            <p className="mb-3 px-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              {group.title}
            </p>

            <div className="space-y-1">
              {group.items.map(
                ({ label, to, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    onFocus={() => setHovered(to)}
                    onMouseEnter={() => setHovered(to)}
                    className={({ isActive }) =>
                      `group relative flex min-h-[45px] items-center gap-3 overflow-hidden rounded-xl px-4 py-3 text-[13px] transition-colors duration-200 ${
                        isActive
                          ? "font-semibold text-white"
                          : "font-medium text-zinc-400 hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {hovered === to && !reducedMotion && (
                          <motion.span
                            layoutId={`admin-hover-${animationScope}`}
                            className="pointer-events-none absolute inset-0 rounded-xl bg-white/[0.055]"
                            transition={{
                              type: "spring",
                              stiffness: 430,
                              damping: 38,
                            }}
                          />
                        )}

                        {isActive && (
                          <>
                            <span className="pointer-events-none absolute inset-0 rounded-xl border border-[#D71935]/20 bg-[linear-gradient(90deg,rgba(215,25,53,.16),rgba(215,25,53,.035)_70%)]" />
                            <motion.span
                              layoutId={`admin-active-${animationScope}`}
                              className="pointer-events-none absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[#ff4968]"
                              transition={
                                reducedMotion
                                  ? { duration: 0 }
                                  : {
                                      type: "spring",
                                      stiffness: 420,
                                      damping: 38,
                                    }
                              }
                            />
                          </>
                        )}

                        <Icon
                          size={17}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          className={`relative shrink-0 transition-colors duration-200 ${
                            isActive
                              ? "text-[#ff5772]"
                              : "text-zinc-500 group-hover:text-zinc-200"
                          }`}
                        />

                        <span className="relative min-w-0 flex-1 truncate">
                          {label}
                        </span>

                        {isActive && (
                          <span
                            className="relative h-1 w-1 shrink-0 rounded-full bg-[#ff4968]"
                            aria-hidden="true"
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                )
              )}
            </div>
          </nav>
        ))}
      </div>

      <div className="shrink-0 border-t border-white/[0.08] px-7 py-5">
        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">
          BookMySeat / Operations
        </p>
      </div>
    </div>
  );
}

function Eyebrow({ children, index }) {
  return (
    <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.23em] text-[#ff526e] sm:text-[11px]">
      <span className="h-px w-7 shrink-0 bg-[#D71935]" />
      {children}
      <span className="text-zinc-600">
        / {index}
      </span>
    </p>
  );
}

function MetricCard({
  label,
  value,
  caption,
  icon: Icon,
  delay = 0,
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.article
      initial={
        reducedMotion
          ? false
          : { opacity: 0, y: 12 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: reducedMotion ? 0 : delay,
        ease: EASE,
      }}
      whileHover={
        reducedMotion
          ? undefined
          : { y: -3 }
      }
      className="group relative overflow-hidden rounded-[20px] border border-white/10 bg-[#111114]/90 p-5 transition-colors duration-300 hover:border-[#D71935]/35 sm:p-6"
    >
      <div
        className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-[#D71935] transition-transform duration-500 group-hover:scale-x-100"
        aria-hidden="true"
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400">
          {label}
        </span>
        <Icon
          size={17}
          strokeWidth={1.7}
          className="text-[#ff526e]"
          aria-hidden="true"
        />
      </div>

      <p className="cine-head mt-5 text-[clamp(1.9rem,3vw,2.6rem)] leading-none text-white tabular-nums">
        {formatNumber(value)}
      </p>

      <p className="mt-3 text-[11px] leading-5 text-zinc-500">
        {caption}
      </p>
    </motion.article>
  );
}

function AdminDashboard() {
  const { token } = useAuth();
  const reducedMotion = useReducedMotion();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);

  const refreshController = useRef(null);

  const loadStats = useCallback(
    async (signal) => {
      if (!token) return false;

      setError("");

      try {
        const response = await axios.get(
          `${API_URL}/api/admin/stats`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal,
          }
        );

        if (signal?.aborted) return false;

        setStats(response.data?.stats ?? null);
        setSyncedAt(new Date());
        return true;
      } catch (requestError) {
        if (
          signal?.aborted ||
          axios.isCancel(requestError)
        ) {
          return false;
        }

        setError(
          requestError.response?.data?.error ||
            "Dashboard data could not be loaded."
        );

        return false;
      }
    },
    [token]
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    loadStats(controller.signal).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    });

    return () => controller.abort();
  }, [loadStats]);

  useEffect(
    () => () => refreshController.current?.abort(),
    []
  );

  useEffect(() => {
    if (!feedback) return undefined;

    const timerId = window.setTimeout(
      () => setFeedback(false),
      5000
    );

    return () => window.clearTimeout(timerId);
  }, [feedback]);

  const handleRefresh = async () => {
    if (loading || refreshing) return;

    const controller = new AbortController();
    refreshController.current = controller;

    setRefreshing(true);
    setFeedback(false);

    try {
      const [success] = await Promise.all([
        loadStats(controller.signal),
        new Promise((resolve) =>
          window.setTimeout(resolve, 750)
        ),
      ]);

      if (!controller.signal.aborted && success) {
        setFeedback(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        setRefreshing(false);
      }

      if (refreshController.current === controller) {
        refreshController.current = null;
      }
    }
  };

  const total = Number(
    stats?.totalBookings || 0
  );
  const confirmed = Number(
    stats?.confirmedBookings || 0
  );

  const confirmedPercent =
    total > 0
      ? Math.min(
          100,
          Math.max(0, (100 * confirmed) / total)
        )
      : 0;

  const pipeline = [
    {
      label: "Confirmed",
      value: confirmed,
      color: "#D71935",
    },
    {
      label: "Pending payment",
      value: Number(stats?.pendingBookings || 0),
      color: "#b69a9e",
    },
    {
      label: "Refunded",
      value: Number(stats?.refundedBookings || 0),
      color: "#73737e",
    },
  ];

  return (
    <div className="mx-auto max-w-[1460px]">
      <motion.header
        initial={
          reducedMotion
            ? false
            : { opacity: 0, y: 16 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.6,
          ease: EASE,
        }}
        className="flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-7"
      >
        <div>
          <Eyebrow index="01">
            Operations overview
          </Eyebrow>

          <h1 className="cine-display mt-5 text-[clamp(2.6rem,4.7vw,4.6rem)]">
            The control{" "}
            <span className="text-[#ff4562]">
              room.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
            Your cinema network, bookings and
            performance in one clear view.
          </p>
        </div>

        <div className="flex min-w-[190px] flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            aria-busy={refreshing}
            className="group inline-flex min-h-[44px] items-center gap-3 rounded-full border border-white/20 bg-white/[0.035] px-5 py-3 text-xs font-semibold text-zinc-200 transition-all duration-300 hover:border-[#D71935]/60 hover:bg-[#D71935]/10 hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            <motion.span
              className="inline-flex text-[#ff526e]"
              animate={
                refreshing && !reducedMotion
                  ? { rotate: 360 }
                  : { rotate: 0 }
              }
              transition={
                refreshing && !reducedMotion
                  ? {
                      duration: 1.2,
                      repeat: Infinity,
                      ease: "linear",
                    }
                  : { duration: 0.2 }
              }
            >
              <RefreshCw
                size={16}
                strokeWidth={1.8}
              />
            </motion.span>

            {refreshing
              ? "Refreshing data..."
              : "Refresh data"}
          </button>

          <div
            className="min-h-[20px]"
            aria-live="polite"
          >
            <AnimatePresence mode="wait">
              {feedback && (
                <motion.p
                  key="success"
                  role="status"
                  initial={
                    reducedMotion
                      ? false
                      : { opacity: 0, y: -5 }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-2 text-xs text-emerald-300"
                >
                  <CheckCircle2 size={15} />
                  Data refreshed
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-[#D71935]/30 bg-[#D71935]/10 p-4 text-sm text-rose-200"
        >
          {error}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="ml-3 font-semibold underline disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      <section
        aria-label="Revenue and conversion"
        className="mt-8 grid gap-4 xl:grid-cols-[1.45fr_1fr]"
      >
        <motion.article
          initial={
            reducedMotion
              ? false
              : { opacity: 0, y: 18 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.65,
            ease: EASE,
          }}
          className="relative flex min-h-[330px] flex-col justify-between overflow-hidden rounded-[24px] border border-[#D71935]/25 bg-[#171014] p-6 sm:p-9"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 95% 0%,rgba(215,25,53,.25),transparent 60%)",
            }}
          />

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff8ca0]">
              Revenue / Confirmed bookings
            </p>

            <span className="rounded-full border border-white/15 bg-white/[0.035] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-zinc-400">
              All time
            </span>
          </div>

          <div className="relative py-10">
            {loading && !stats ? (
              <div className="cine-skeleton h-20 w-full max-w-[370px] rounded-xl" />
            ) : (
              <p className="cine-display break-words text-[clamp(2.7rem,6vw,5.7rem)] tabular-nums text-white">
                {formatMoney(
                  stats?.totalRevenue
                )}
              </p>
            )}

            <p className="mt-5 text-sm text-zinc-400">
              {formatNumber(confirmed)} confirmed
              of {formatNumber(total)} bookings
            </p>
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5">
            <span className="text-[11px] text-zinc-500">
              {syncedAt
                ? `Updated ${syncedAt.toLocaleTimeString(
                    "en-IN",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}`
                : "Awaiting latest figures"}
            </span>

            <Link
              to="/admin/analytics"
              className="group inline-flex items-center gap-2 text-xs font-semibold text-white transition-colors hover:text-[#ff7189]"
            >
              Explore analytics
              <ArrowUpRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>
        </motion.article>

        <article className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-[#111114]/90 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff526e]">
                Booking performance
              </p>

              <h2 className="cine-head mt-3 text-[22px] text-white">
                Confirmed share
              </h2>
            </div>

            <Ticket
              size={19}
              className="mt-1 text-[#ff526e]"
            />
          </div>

          <div className="flex justify-center py-6">
            <div
              className="relative flex h-[188px] w-[188px] items-center justify-center rounded-full"
              role="img"
              aria-label={`${confirmedPercent.toFixed(
                1
              )} percent confirmed bookings`}
              style={{
                background: `conic-gradient(#D71935 0% ${confirmedPercent}%,#303036 ${confirmedPercent}% 100%)`,
              }}
            >
              <div className="flex h-[166px] w-[166px] flex-col items-center justify-center rounded-full bg-[#111114]">
                <span className="cine-head text-5xl tabular-nums text-white">
                  {confirmedPercent.toFixed(0)}%
                </span>

                <span className="mt-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  Confirmed
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-5 text-xs text-zinc-400">
            <span>
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#D71935]" />
              {formatNumber(confirmed)} confirmed
            </span>

            <span>
              {formatNumber(
                Math.max(0, total - confirmed)
              )}{" "}
              other
            </span>
          </div>
        </article>
      </section>

      <section
        aria-label="Platform metrics"
        className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Active showtimes"
          value={stats?.activeShows}
          caption="Upcoming screenings"
          icon={Activity}
          delay={0.04}
        />
        <MetricCard
          label="Registered users"
          value={stats?.totalUsers}
          caption="Customer accounts"
          icon={Users}
          delay={0.08}
        />
        <MetricCard
          label="Available movies"
          value={stats?.totalMovies}
          caption="Films in the catalogue"
          icon={Film}
          delay={0.12}
        />
        <MetricCard
          label="Cinema locations"
          value={stats?.totalTheatres}
          caption={`${formatNumber(
            stats?.totalScreens
          )} screens in the network`}
          icon={Building2}
          delay={0.16}
        />
      </section>

      <section
        aria-label="Booking pipeline"
        className="mt-10"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Eyebrow index="02">
              Network activity
            </Eyebrow>

            <h2 className="cine-head mt-4 text-[clamp(1.5rem,2.6vw,2rem)] text-white">
              Booking pipeline
            </h2>
          </div>

          <Link
            to="/admin/bookings"
            className="group inline-flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white"
          >
            View all bookings
            <ArrowRight
              size={15}
              className="text-[#ff526e] transition-transform group-hover:translate-x-1"
            />
          </Link>
        </div>

        <div className="grid gap-5 rounded-[22px] border border-white/10 bg-[#111114]/90 p-6 md:grid-cols-3 sm:p-8">
          {pipeline.map(
            ({ label, value, color }) => (
              <div key={label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-zinc-400">
                    {label}
                  </span>

                  <span className="cine-head text-lg tabular-nums text-white">
                    {formatNumber(value)}
                  </span>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <motion.div
                    initial={
                      reducedMotion
                        ? false
                        : { width: 0 }
                    }
                    animate={{
                      width: `${
                        total > 0
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                (value * 100) /
                                  total
                              )
                            )
                          : 0
                      }%`,
                    }}
                    transition={{
                      duration: reducedMotion
                        ? 0
                        : 0.8,
                      ease: EASE,
                    }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}

export default function Admin() {
  const {
    isAuthenticated,
    loading: authLoading,
    user,
  } = useAuth();

  const reducedMotion = useReducedMotion();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const isDashboard =
    location.pathname.replace(/\/$/, "") ===
    "/admin";

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previous =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previous;
    };
  }, [mobileOpen]);

  if (authLoading) {
    return (
      <PageShell
        glow="left"
        className="bms-admin-shell"
      >
        <div
          className="flex min-h-[75vh] items-center justify-center gap-3 text-sm text-zinc-400"
          role="status"
        >
          <RefreshCw
            className={
              reducedMotion
                ? "text-[#D71935]"
                : "animate-spin text-[#D71935]"
            }
            size={20}
          />
          Verifying administrator access…
        </div>
      </PageShell>
    );
  }

  if (
    !isAuthenticated ||
    user?.role !== "admin"
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageShell
      glow="left"
      className="bms-admin-shell"
    >
      <div className="relative flex min-h-[calc(100vh-4rem)]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[304px] shrink-0 border-r border-white/[0.08] bg-[#0e0e11]/90 lg:block xl:w-[320px]">
          <AdminSidebar
            onNavigate={() => {}}
          />
        </aside>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.button
                type="button"
                aria-label="Close navigation overlay"
                onClick={() =>
                  setMobileOpen(false)
                }
                className="fixed inset-0 z-[85] bg-black/75 lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />

              <motion.aside
                initial={
                  reducedMotion
                    ? false
                    : { x: -320 }
                }
                animate={{ x: 0 }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { x: -320 }
                }
                transition={{
                  duration: reducedMotion
                    ? 0
                    : 0.3,
                  ease: EASE,
                }}
                className="fixed bottom-0 left-0 top-16 z-[90] w-[min(320px,90vw)] border-r border-white/10 bg-[#0e0e11] lg:hidden"
              >
                <AdminSidebar
                  onNavigate={() =>
                    setMobileOpen(false)
                  }
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="min-w-0 flex-1">
          <div className="px-5 pt-5 sm:px-8 lg:hidden">
            <button
              type="button"
              onClick={() =>
                setMobileOpen(true)
              }
              aria-label="Open admin navigation"
              aria-expanded={mobileOpen}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:border-[#D71935]/60 hover:bg-[#D71935]/10"
            >
              <Menu size={17} />
              Admin menu
            </button>
          </div>

          <main
            className="bms-admin-content min-w-0 px-5 pb-20 pt-9 sm:px-8 sm:pt-10 xl:px-12"
            id="admin-main"
          >
            {isDashboard
              ? <AdminDashboard />
              : <Outlet />}
          </main>
        </div>
      </div>
    </PageShell>
  );
}
