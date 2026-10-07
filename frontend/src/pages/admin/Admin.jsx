import React, { useEffect, useState } from "react";

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Activity,
  Armchair,
  BarChart3,
  Building2,
  CalendarPlus,
  Film,
  IndianRupee,
  LayoutDashboard,
  Menu,
  QrCode,
  Ticket,
  Users,
  X,
} from "lucide-react";

import { motion } from "framer-motion";

import axios from "axios";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const navigation = [
  {
    label: "Dashboard",
    path: "/admin",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Analytics",
    path: "/admin/analytics",
    icon: BarChart3,
  },
  {
    label: "Movies",
    path: "/admin/movies",
    icon: Film,
  },
  {
    label: "Theatres",
    path: "/admin/theatres",
    icon: Building2,
  },
  {
    label: "Screens",
    path: "/admin/screens",
    icon: Armchair,
  },
  {
    label: "Add Show",
    path: "/admin/add-show",
    icon: CalendarPlus,
  },
  {
    label: "Shows",
    path: "/admin/shows",
    icon: Activity,
  },
  {
    label: "Users",
    path: "/admin/users",
    icon: Users,
  },
  {
    label: "Bookings",
    path: "/admin/bookings",
    icon: Ticket,
  },
  {
    label: "QR Scanner",
    path: "/admin/scanner",
    icon: QrCode,
  },
];

const StatCard = ({
  icon: Icon,
  value,
  title,
  subtitle,
  delay = 0,
}) => (
  <motion.div
    initial={{
      opacity: 0,
      y: 18,
    }}
    animate={{
      opacity: 1,
      y: 0,
    }}
    transition={{
      delay,
    }}
    whileHover={{
      y: -3,
    }}
    className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 transition hover:border-red-500/20"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-zinc-500">
          {title}
        </p>

        <p className="mt-3 text-3xl font-bold">
          {value}
        </p>

        {subtitle && (
          <p className="mt-2 text-xs text-zinc-600">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10">
        <Icon className="h-5 w-5 text-red-500" />
      </div>
    </div>
  </motion.div>
);

const Admin = () => {
  const {
    user,
    token,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const navigate = useNavigate();

  const location = useLocation();

  const [stats, setStats] = useState(null);

  const [loading, setLoading] = useState(true);

  const [mobileMenu, setMobileMenu] = useState(false);

  const isDashboard =
    location.pathname === "/admin" ||
    location.pathname === "/admin/";

  // ===================================================
  // ADMIN ACCESS CHECK
  // ===================================================

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (
      !isAuthenticated ||
      user?.role !== "admin"
    ) {
      navigate("/");
    }
  }, [
    authLoading,
    isAuthenticated,
    user,
    navigate,
  ]);

  // ===================================================
  // DASHBOARD STATS
  // ===================================================

  useEffect(() => {
    if (
      !token ||
      user?.role !== "admin"
    ) {
      return;
    }

    const fetchStats = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/admin/stats`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setStats(response.data.stats);
      } catch (error) {
        console.error(
          "Admin stats:",
          error
        );

        toast.error(
          "Could not load dashboard stats."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token, user]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090b]">
        <p className="text-zinc-500">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090b] pt-16 text-white">

      {/* MOBILE HEADER */}

      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 lg:hidden">

        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-500">
            BookMySeat
          </p>

          <p className="font-semibold">
            Admin Panel
          </p>
        </div>

        <button
          onClick={() =>
            setMobileMenu(
              (current) => !current
            )
          }
          className="rounded-xl border border-white/10 p-2"
        >
          {mobileMenu ? (
            <X />
          ) : (
            <Menu />
          )}
        </button>

      </div>

      <div className="flex">

        {/* SIDEBAR */}

        <aside
          className={`
            fixed bottom-0 left-0 top-16 z-40
            w-64 border-r border-white/10
            bg-[#0c0c0f]/95 backdrop-blur-xl
            transition-transform duration-300
            lg:sticky lg:translate-x-0

            ${
              mobileMenu
                ? "translate-x-0"
                : "-translate-x-full"
            }
          `}
        >
          <div className="flex h-full flex-col p-5">

            <div className="mb-8 hidden lg:block">

              <p className="text-xs uppercase tracking-[0.3em] text-red-500">
                Management
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Admin Panel
              </h2>

            </div>

            <nav className="space-y-1">

              {navigation.map(
                ({
                  label,
                  path,
                  icon: Icon,
                  end,
                }) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={end}
                    onClick={() =>
                      setMobileMenu(false)
                    }
                    className={({
                      isActive,
                    }) =>
                      `
                        flex items-center gap-3 rounded-xl px-4 py-3
                        text-sm font-medium transition

                        ${
                          isActive
                            ? "bg-red-600 text-white shadow-lg shadow-red-950/30"
                            : "text-zinc-500 hover:bg-white/5 hover:text-white"
                        }
                      `
                    }
                  >
                    <Icon className="h-5 w-5" />

                    {label}
                  </NavLink>
                )
              )}

            </nav>

            <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.02] p-4">

              <p className="text-xs text-zinc-600">
                Logged in as
              </p>

              <p className="mt-1 truncate text-sm font-medium">
                {user?.name}
              </p>

              <p className="truncate text-xs text-zinc-600">
                {user?.email}
              </p>

            </div>

          </div>
        </aside>

        {/* CONTENT */}

        <main className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">

          {isDashboard ? (
            <div>

              <motion.div
                initial={{
                  opacity: 0,
                  y: 12,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
              >
                <p className="text-sm uppercase tracking-[0.3em] text-red-500">
                  Overview
                </p>

                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                  Dashboard
                </h1>

                <p className="mt-2 text-sm text-zinc-500">
                  Manage your BookMySeat platform from one place.
                </p>
              </motion.div>

              {loading ? (
                <div className="py-20 text-center text-zinc-500">
                  Loading dashboard...
                </div>
              ) : (
                <>
                  {/* STATS */}

                  <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                    <StatCard
                      icon={IndianRupee}
                      title="Revenue"
                      value={`₹${Number(
                        stats?.totalRevenue || 0
                      ).toLocaleString(
                        "en-IN"
                      )}`}
                      subtitle="Confirmed bookings"
                    />

                    <StatCard
                      icon={Ticket}
                      title="Bookings"
                      value={
                        stats?.totalBookings ||
                        0
                      }
                      subtitle={`${
                        stats?.confirmedBookings ||
                        0
                      } confirmed`}
                      delay={0.05}
                    />

                    <StatCard
                      icon={Activity}
                      title="Active Shows"
                      value={
                        stats?.activeShows ||
                        0
                      }
                      subtitle="Upcoming scheduled shows"
                      delay={0.1}
                    />

                    <StatCard
                      icon={Users}
                      title="Users"
                      value={
                        stats?.totalUsers ||
                        0
                      }
                      subtitle="Registered accounts"
                      delay={0.15}
                    />

                    <StatCard
                      icon={Film}
                      title="Movies"
                      value={
                        stats?.totalMovies ||
                        0
                      }
                      delay={0.2}
                    />

                    <StatCard
                      icon={Building2}
                      title="Theatres"
                      value={
                        stats?.totalTheatres ||
                        0
                      }
                      delay={0.25}
                    />

                    <StatCard
                      icon={Armchair}
                      title="Screens"
                      value={
                        stats?.totalScreens ||
                        0
                      }
                      delay={0.3}
                    />

                    <StatCard
                      icon={Ticket}
                      title="Refunded"
                      value={
                        stats?.refundedBookings ||
                        0
                      }
                      subtitle={`${
                        stats?.pendingBookings ||
                        0
                      } pending payments`}
                      delay={0.35}
                    />

                  </div>

                  {/* QUICK ACTIONS */}

                  <div className="mt-10">

                    <h2 className="text-xl font-bold">
                      Quick Actions
                    </h2>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">

                      <button
                        onClick={() =>
                          navigate(
                            "/admin/add-show"
                          )
                        }
                        className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 text-left transition hover:border-red-500/30 hover:bg-zinc-900"
                      >
                        <CalendarPlus className="h-6 w-6 text-red-500" />

                        <p className="mt-4 font-semibold">
                          Add New Show
                        </p>

                        <p className="mt-1 text-sm text-zinc-600">
                          Schedule a movie screening.
                        </p>
                      </button>

                      <button
                        onClick={() =>
                          navigate(
                            "/admin/bookings"
                          )
                        }
                        className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 text-left transition hover:border-red-500/30 hover:bg-zinc-900"
                      >
                        <Ticket className="h-6 w-6 text-red-500" />

                        <p className="mt-4 font-semibold">
                          View Bookings
                        </p>

                        <p className="mt-1 text-sm text-zinc-600">
                          Review customer bookings.
                        </p>
                      </button>

                      <button
                        onClick={() =>
                          navigate(
                            "/admin/scanner"
                          )
                        }
                        className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 text-left transition hover:border-red-500/30 hover:bg-zinc-900"
                      >
                        <QrCode className="h-6 w-6 text-red-500" />

                        <p className="mt-4 font-semibold">
                          Scan Ticket
                        </p>

                        <p className="mt-1 text-sm text-zinc-600">
                          Verify and admit a guest.
                        </p>
                      </button>

                    </div>

                  </div>
                </>
              )}

            </div>
          ) : (
            <Outlet />
          )}

        </main>

      </div>

    </div>
  );
};

export default Admin;