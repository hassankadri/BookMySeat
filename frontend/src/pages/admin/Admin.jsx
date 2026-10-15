
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity, ArrowUpRight, Armchair, BarChart3, Building2,
  CalendarPlus, Film, LayoutDashboard, Menu,
  QrCode, RefreshCw, Ticket, Users, X,
} from "lucide-react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const INR = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const NUMBER = (value) => Number(value || 0).toLocaleString("en-IN");

const GROUPS = [
  { title: "Overview", items: [
    { name: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
    { name: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  ] },
  { title: "Your cinemas", items: [
    { name: "Movies", to: "/admin/movies", icon: Film },
    { name: "Theatres", to: "/admin/theatres", icon: Building2 },
    { name: "Screens", to: "/admin/screens", icon: Armchair },
  ] },
  { title: "Operations", items: [
    { name: "Add show", to: "/admin/add-show", icon: CalendarPlus },
    { name: "Showtimes", to: "/admin/shows", icon: Activity },
    { name: "Bookings", to: "/admin/bookings", icon: Ticket },
    { name: "Users", to: "/admin/users", icon: Users },
    { name: "Ticket scanner", to: "/admin/scanner", icon: QrCode },
  ] },
];

const easing = [0.22, 1, 0.36, 1];
const surface = "border border-white/[0.09] bg-[#121215]";

function Sidebar({ onClose }) {
  const [hovered, setHovered] = useState(null);
  const hoverScope = useId();

  return (
    <div className="flex h-full flex-col bg-[#0f0f12]">
      <div className="flex items-start justify-between px-8 pb-9 pt-10">
        <Link
          to="/admin"
          onClick={onClose}
          aria-label="BookMySeat administration home"
          className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D71935]"
        >
          <span className="block text-[20px] font-bold leading-none tracking-[-0.055em] text-[#f5f3f1]">
            BookMySeat<span className="text-[#D71935]">.</span>
          </span>
          <span className="mt-3 block text-[11px] font-medium tracking-[0.08em] text-[#81818c]">
            Cinema administration
          </span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="rounded-md p-2 text-[#9999a3] transition hover:bg-white/5 hover:text-white lg:hidden"
        >
          <X size={19} />
        </button>
      </div>

      <div className="mx-8 h-px bg-white/[0.09]" />

      <div
        className="min-h-0 flex-1 overflow-y-auto px-5 pb-12 pt-8"
        onMouseLeave={() => setHovered(null)}
      >
        {GROUPS.map((group, groupIndex) => (
          <nav
            key={group.title}
            aria-label={group.title}
            className={groupIndex ? "mt-9" : ""}
          >
            <p className="mb-3 px-4 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#858590]">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map(({ name, to, end, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onClose}
                  onMouseEnter={() => setHovered(to)}
                  onFocus={() => setHovered(to)}
                  className={({ isActive }) =>
                    `group relative flex min-h-[49px] items-center gap-4 overflow-hidden rounded-lg px-4 py-3 text-[15px] tracking-[-0.02em] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D71935] ${
                      isActive
                        ? "font-semibold text-[#f7f5f3]"
                        : "font-medium text-[#a6a6af] hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {hovered === to && (
                        <motion.span
                          layoutId={`bms-sidebar-hover-${hoverScope}`}
                          className="pointer-events-none absolute inset-0 rounded-lg bg-white/[0.055]"
                          transition={{ type: "spring", stiffness: 390, damping: 33 }}
                        />
                      )}
                      {isActive && (
                        <>
                          <span className="pointer-events-none absolute inset-0 rounded-lg bg-[linear-gradient(90deg,rgba(215,25,53,0.11),rgba(215,25,53,0.02)_68%,transparent)]" />
                          <motion.span
                            layoutId={`bms-sidebar-active-${hoverScope}`}
                            className="pointer-events-none absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-[#D71935]"
                            transition={{ type: "spring", stiffness: 360, damping: 32 }}
                          />
                        </>
                      )}
                      <Icon
                        size={19}
                        strokeWidth={1.65}
                        className={`relative shrink-0 transition-colors duration-300 ${
                          isActive
                            ? "text-[#f25c76]"
                            : "text-[#777782] group-hover:text-[#e4e2e3]"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="relative truncate">{name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, note, icon: Icon, delay = 0 }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: easing, delay }}
      whileHover={reduced ? undefined : { y: -4 }}
      className={`${surface} group relative overflow-hidden rounded-[22px] p-6 transition-colors hover:border-[#D71935]/45`}
    >
      <div className="absolute inset-x-0 top-0 h-[1px] origin-left scale-x-0 bg-[#D71935] transition-transform duration-500 group-hover:scale-x-100" />
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#92929b]">{label}</p>
        <Icon size={18} className="text-[#df3b54]" />
      </div>
      <p className="mt-6 text-[clamp(2rem,3.3vw,3rem)] font-semibold tracking-[-0.065em] text-white tabular-nums">{NUMBER(value)}</p>
      <p className="mt-2 text-xs text-[#777780]">{note}</p>
    </motion.div>
  );
}

function Dashboard() {
  const { token } = useAuth();
  const reduced = useReducedMotion();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  // Show successful refresh feedback for five seconds only.
  useEffect(() => {
    if (!feedback) return undefined;
    const timeoutId = window.setTimeout(() => setFeedback(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const [syncedAt, setSyncedAt] = useState(null);
  const refreshController = useRef(null);

  const loadStats = useCallback(async (signal) => {
    if (!token) return false;
    setError("");
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (signal?.aborted) return false;
      setStats(data.stats || null);
      setSyncedAt(new Date());
      return true;
    } catch (err) {
      if (signal?.aborted || axios.isCancel(err)) return false;
      setError(err.response?.data?.error || "Dashboard data could not be loaded.");
      return false;
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadStats(controller.signal).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [loadStats]);

  useEffect(() => () => refreshController.current?.abort(), []);

  const handleRefresh = async () => {
    if (loading || refreshing) return;
    const controller = new AbortController();
    refreshController.current = controller;
    setRefreshing(true);
    setFeedback("");

    try {
      const [success] = await Promise.all([
        loadStats(controller.signal),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
      if (controller.signal.aborted) return;
      if (success) {
        setFeedback("Dashboard data refreshed successfully.");
        toast.success("Dashboard data refreshed successfully.");
      } else {
        toast.error("Refresh failed. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
      if (refreshController.current === controller) refreshController.current = null;
    }
  };

  const confirmed = Number(stats?.confirmedBookings || 0);
  const total = Number(stats?.totalBookings || 0);
  const confirmedPct = total > 0 ? Math.max(0, Math.min(100, (confirmed / total) * 100)) : 0;
  const cardBase = "rounded-[26px] border border-white/[0.09] bg-[#141417]";

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-[#ff627b]">
            <span className="h-px w-9 bg-[#D71935]" /> Overview / 01
          </p>
          <h1 className="mt-4 text-[clamp(2.25rem,3.8vw,4rem)] font-semibold leading-[0.95] tracking-[-0.075em] text-[#f2f0ec]">
            The control<span className="text-[#e13c57]">.</span><br />room
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#a0a0aa]">
            One view of the entire cinema network. Built for decisions, not decoration.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            disabled={loading || refreshing}
            onClick={handleRefresh}
            aria-busy={refreshing}
            className="inline-flex items-center gap-3 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-[#ededed] transition-colors duration-300 hover:border-[#D71935] hover:bg-[#D71935]/10 disabled:cursor-wait disabled:opacity-70"
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
          <p role="status" aria-live="polite" className="min-h-4 text-xs text-emerald-300">
            {feedback}
          </p>
        </div>
      </header>

      {error && (
        <div role="alert" className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error} <button type="button" onClick={handleRefresh} disabled={refreshing || loading} className="ml-3 underline disabled:opacity-40">Retry</button>
        </div>
      )}

      <section className="mt-10 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easing }}
          className="relative min-h-[350px] overflow-hidden rounded-[28px] border border-[#D71935]/20 bg-[#191318] p-7 sm:p-10"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75" style={{ background: "radial-gradient(circle at 85% 15%,rgba(215,25,53,.30),transparent 42%),repeating-linear-gradient(130deg,transparent 0px,transparent 43px,rgba(255,255,255,.025) 44px,transparent 45px)" }} />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.23em] text-[#f4adb9]">01 — Revenue / confirmed bookings</p>
              <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#bbbbc3]">All time</span>
            </div>
            <div className="py-10">
              {loading && !stats ? (
                <div className="h-24 max-w-md animate-pulse rounded-xl bg-white/10" />
              ) : (
                <p className="break-words text-[clamp(3.1rem,7vw,6.6rem)] font-semibold leading-none tracking-[-0.08em] text-white tabular-nums">
                  {INR(stats?.totalRevenue)}
                </p>
              )}
              <p className="mt-6 text-sm text-[#bcb0b7]">
                {NUMBER(confirmed)} confirmed of {NUMBER(total)} total bookings
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5">
              <span className="text-xs text-[#958c94]">{syncedAt ? `Last refreshed ${syncedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Waiting for account data"}</span>
              <Link to="/admin/analytics" className="group inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-[#ff657e]">
                View detailed analytics <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </Link>
            </div>
          </div>
        </motion.div>

        <div className={`${cardBase} flex flex-col justify-between p-7 sm:p-9`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#ff647d]">Booking conversion</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Confirmed share</h2>
            </div>
            <Ticket className="text-[#D71935]" size={24} />
          </div>
          <div className="flex items-center justify-center py-6">
            <div
              role="img"
              aria-label={`${confirmedPct.toFixed(1)} percent of bookings confirmed`}
              className="relative flex h-52 w-52 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#D71935 0% ${confirmedPct}%, #303035 ${confirmedPct}% 100%)` }}
            >
              <div className="flex h-[calc(100%-23px)] w-[calc(100%-23px)] flex-col items-center justify-center rounded-full bg-[#141417]">
                <span className="text-5xl font-semibold tracking-[-0.07em] tabular-nums text-white">{confirmedPct.toFixed(0)}%</span>
                <span className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[#898994]">Confirmed</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-5 text-xs text-[#9999a3]">
            <span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#D71935]" />Confirmed {NUMBER(confirmed)}</span>
            <span>Other {NUMBER(Math.max(0, total - confirmed))}</span>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform metrics">
        <Metric label="Active showtimes" value={stats?.activeShows} icon={Activity} note="Upcoming, scheduled screenings" delay={0.05} />
        <Metric label="Registered users" value={stats?.totalUsers} icon={Users} note="Accounts created" delay={0.1} />
        <Metric label="Available movies" value={stats?.totalMovies} icon={Film} note="Film catalogue entries" delay={0.15} />
        <Metric label="Cinema locations" value={stats?.totalTheatres} icon={Building2} note={`${NUMBER(stats?.totalScreens)} screens across your network`} delay={0.2} />
      </section>

      <section className="mt-12" aria-label="Booking pipeline">
        <div className="mb-5 flex items-center gap-3">
          <span className="h-px w-8 bg-[#D71935]" />
          <h2 className="text-xl font-semibold text-white">Operational snapshot</h2>
        </div>
        <div className={`${surface} relative overflow-hidden rounded-[24px] p-7 sm:p-9`}>
          <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-44 w-44 opacity-30" style={{ background: "radial-gradient(circle,#D71935,transparent 65%)" }} />
          <p className="relative text-xs uppercase tracking-[0.19em] text-[#9999a4]">Booking pipeline</p>
          <div className="relative mt-7 grid gap-7 md:grid-cols-3 md:gap-10">
            {[
              { label: "Confirmed", value: confirmed, color: "#D71935" },
              { label: "Pending payment", value: Number(stats?.pendingBookings || 0), color: "#b09aa2" },
              { label: "Refunded", value: Number(stats?.refundedBookings || 0), color: "#797980" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-[#bebec5]">{item.label}</span>
                  <span className="text-lg font-semibold tabular-nums text-white">{NUMBER(item.value)}</span>
                </div>
                <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-white/[0.07]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${total > 0 ? Math.min(100, Math.max(0, (item.value / total) * 100)) : 0}%` }}
                    transition={{ duration: reduced ? 0 : 0.9, ease: easing }}
                    className="h-full rounded-full"
                    style={{ background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Admin() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDashboard = location.pathname.replace(/\/$/, "") === "/admin";

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, [mobileOpen]);

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#09090b] pt-16 text-[#aaaab2]" role="status"><RefreshCw className="mr-3 animate-spin text-[#D71935]" />Verifying admin access...</div>;
  }
  if (!isAuthenticated || user?.role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="relative min-h-screen bg-[#09090b] pt-16 text-white" style={{ fontFamily: "Manrope, system-ui, sans-serif" }}>
      <div className="relative flex min-h-[calc(100vh-4rem)]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[296px] shrink-0 border-r border-white/[0.08] bg-[#101013] lg:block">
          <Sidebar onClose={() => {}} />
        </aside>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.button type="button" aria-label="Close navigation" className="fixed inset-0 z-[85] bg-black/75 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
              <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "tween", duration: 0.27 }} className="fixed bottom-0 left-0 top-16 z-[90] w-[min(300px,85vw)] border-r border-white/10 bg-[#101013] lg:hidden"><Sidebar onClose={() => setMobileOpen(false)} /></motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="min-w-0 flex-1">
          <div className="px-5 pt-6 sm:px-9 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open admin navigation"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition hover:border-[#D71935]/60 hover:bg-white/5"
            >
              <Menu size={18} /> Menu
            </button>
          </div>
          <main className="min-w-0 px-5 pb-20 pt-9 sm:px-9 sm:pt-12 lg:px-10">
            {isDashboard ? <Dashboard /> : <Outlet />}
          </main>
        </div>
      </div>
    </div>
  );
}
