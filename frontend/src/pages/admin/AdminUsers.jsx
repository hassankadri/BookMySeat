import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Search,
  Shield,
  User,
  Users,
  XCircle,
} from "lucide-react";

import {
  motion,
} from "framer-motion";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useAuth,
} from "../../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const AdminUsers = () => {
  const {
    token,
    user: currentUser,
  } = useAuth();

  const [
    users,
    setUsers,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState("all");

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  const [
    changingRole,
    setChangingRole,
  ] = useState(null);

  // ===================================================
  // FETCH USERS
  // ===================================================

  const fetchUsers =
    async () => {
      setLoading(true);

      try {
        const params = {
          page,
          limit: 20,
        };

        if (
          search.trim()
        ) {
          params.search =
            search.trim();
        }

        if (
          roleFilter !==
          "all"
        ) {
          params.role =
            roleFilter;
        }

        const response =
          await axios.get(
            `${API_URL}/api/admin/users`,
            {
              params,

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        setUsers(
          response.data.users ||
            []
        );

        setPagination(
          response.data.pagination ||
            {
              page: 1,
              pages: 1,
              total: 0,
            }
        );
      } catch (error) {
        console.error(
          "Users load error:",
          error
        );

        toast.error(
          "Could not load users."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    const timer =
      setTimeout(() => {
        fetchUsers();
      }, 300);

    return () =>
      clearTimeout(timer);
  }, [
    search,
    roleFilter,
    page,
    token,
  ]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [
    search,
    roleFilter,
  ]);

  // ===================================================
  // CURRENT USER ID
  // ===================================================

  const currentUserId =
    currentUser?._id ||
    currentUser?.id;

  // ===================================================
  // USER COUNTS
  // ===================================================

  const stats =
    useMemo(() => {
      const admins =
        users.filter(
          (item) =>
            item.role ===
            "admin"
        ).length;

      const verified =
        users.filter(
          (item) =>
            item.emailVerified !==
            false
        ).length;

      const google =
        users.filter(
          (item) =>
            Boolean(
              item.googleId
            )
        ).length;

      return {
        admins,
        verified,
        google,
      };
    }, [users]);

  // ===================================================
  // CHANGE ROLE
  // ===================================================

  const changeRole =
    async (
      userId,
      newRole
    ) => {
      const targetUser =
        users.find(
          (item) =>
            String(
              item._id
            ) ===
            String(
              userId
            )
        );

      if (!targetUser) {
        return;
      }

      if (
        String(userId) ===
        String(
          currentUserId
        )
      ) {
        toast.error(
          "You cannot change your own admin role."
        );

        return;
      }

      const confirmed =
        window.confirm(
          newRole ===
            "admin"
            ? `Give admin access to ${targetUser.name}?`
            : `Remove admin access from ${targetUser.name}?`
        );

      if (!confirmed) {
        return;
      }

      setChangingRole(
        userId
      );

      try {
        const response =
          await axios.patch(
            `${API_URL}/api/admin/users/${userId}/role`,

            {
              role:
                newRole,
            },

            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        setUsers(
          (current) =>
            current.map(
              (item) =>
                item._id ===
                userId
                  ? response.data
                      .user
                  : item
            )
        );

        toast.success(
          newRole ===
            "admin"
            ? "Admin access granted."
            : "Admin access removed."
        );
      } catch (error) {
        console.error(
          "Role update error:",
          error
        );

        toast.error(
          error.response
            ?.data
            ?.error ||
            "Could not update user role."
        );
      } finally {
        setChangingRole(
          null
        );
      }
    };

  // ===================================================
  // UI
  // ===================================================

  return (
    <div>

      {/* HEADER */}

      <div>

        <p className="text-sm uppercase tracking-[0.3em] text-red-500">
          Accounts
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Users
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          View registered accounts and control admin access.
        </p>

      </div>

      {/* STATS */}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Total Users"
          value={
            pagination.total ||
            0
          }
          icon={Users}
        />

        <StatCard
          title="Admins on Page"
          value={
            stats.admins
          }
          icon={Shield}
        />

        <StatCard
          title="Verified on Page"
          value={
            stats.verified
          }
          icon={
            CheckCircle2
          }
        />

        <StatCard
          title="Google Users"
          value={
            stats.google
          }
          icon={Mail}
        />

      </div>

      {/* FILTERS */}

      <div className="mt-8 flex flex-col gap-3 lg:flex-row">

        <div className="relative flex-1">

          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

          <input
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search by name or email..."
            className="w-full rounded-xl border border-white/10 bg-zinc-900 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-red-500"
          />

        </div>

        <select
          value={
            roleFilter
          }
          onChange={(
            event
          ) =>
            setRoleFilter(
              event.target.value
            )
          }
          className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-red-500"
        >

          <option value="all">
            All Roles
          </option>

          <option value="user">
            Users
          </option>

          <option value="admin">
            Admins
          </option>

        </select>

      </div>

      {/* TABLE */}

      {loading ? (
        <div className="py-24 text-center text-zinc-500">
          Loading users...
        </div>
      ) : users.length ===
        0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 py-24 text-center">

          <Users className="mx-auto h-10 w-10 text-zinc-700" />

          <p className="mt-4 text-zinc-500">
            No users found.
          </p>

        </div>
      ) : (
        <motion.div
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="mt-8 overflow-hidden rounded-2xl border border-white/10"
        >

          <div className="overflow-x-auto">

            <table className="w-full min-w-[900px]">

              <thead className="bg-white/[0.03]">

                <tr className="text-left text-xs uppercase tracking-wider text-zinc-600">

                  <th className="px-5 py-4">
                    User
                  </th>

                  <th className="px-5 py-4">
                    Verification
                  </th>

                  <th className="px-5 py-4">
                    Login Method
                  </th>

                  <th className="px-5 py-4">
                    Joined
                  </th>

                  <th className="px-5 py-4">
                    Role
                  </th>

                  <th className="px-5 py-4 text-right">
                    Access
                  </th>

                </tr>

              </thead>

              <tbody>

                {users.map(
                  (
                    item,
                    index
                  ) => {
                    const isCurrent =
                      String(
                        item._id
                      ) ===
                      String(
                        currentUserId
                      );

                    const isAdmin =
                      item.role ===
                      "admin";

                    return (
                      <motion.tr
                        key={
                          item._id
                        }
                        initial={{
                          opacity: 0,
                        }}
                        animate={{
                          opacity: 1,
                        }}
                        transition={{
                          delay:
                            Math.min(
                              index *
                                0.02,
                              0.25
                            ),
                        }}
                        className="border-t border-white/5 transition hover:bg-white/[0.02]"
                      >

                        {/* USER */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                                isAdmin
                                  ? "bg-red-500/10"
                                  : "bg-white/5"
                              }`}
                            >

                              {isAdmin ? (
                                <Shield className="h-5 w-5 text-red-500" />
                              ) : (
                                <User className="h-5 w-5 text-zinc-500" />
                              )}

                            </div>

                            <div className="min-w-0">

                              <div className="flex items-center gap-2">

                                <p className="truncate font-medium">
                                  {
                                    item.name
                                  }
                                </p>

                                {isCurrent && (
                                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                                    YOU
                                  </span>
                                )}

                              </div>

                              <p className="mt-1 truncate text-sm text-zinc-600">
                                {
                                  item.email
                                }
                              </p>

                            </div>

                          </div>

                        </td>

                        {/* VERIFIED */}

                        <td className="px-5 py-4">

                          {item.emailVerified !==
                          false ? (
                            <div className="flex items-center gap-2 text-sm text-green-400">

                              <CheckCircle2 className="h-4 w-4" />

                              Verified

                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-yellow-400">

                              <XCircle className="h-4 w-4" />

                              Pending

                            </div>
                          )}

                        </td>

                        {/* LOGIN TYPE */}

                        <td className="px-5 py-4">

                          <span
                            className={`rounded-full px-3 py-1.5 text-xs ${
                              item.googleId
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {item.googleId
                              ? "Google + Email"
                              : "Email"}
                          </span>

                        </td>

                        {/* JOINED */}

                        <td className="px-5 py-4 text-sm text-zinc-500">

                          {item.createdAt
                            ? new Intl.DateTimeFormat(
                                "en-IN",
                                {
                                  dateStyle:
                                    "medium",
                                }
                              ).format(
                                new Date(
                                  item.createdAt
                                )
                              )
                            : "—"}

                        </td>

                        {/* ROLE */}

                        <td className="px-5 py-4">

                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                              isAdmin
                                ? "bg-red-500/10 text-red-400"
                                : "bg-white/5 text-zinc-400"
                            }`}
                          >
                            {isAdmin
                              ? "Admin"
                              : "User"}
                          </span>

                        </td>

                        {/* ACTION */}

                        <td className="px-5 py-4 text-right">

                          {isCurrent ? (
                            <span className="text-xs text-zinc-700">
                              Protected
                            </span>
                          ) : (
                            <button
                              disabled={
                                changingRole ===
                                item._id
                              }
                              onClick={() =>
                                changeRole(
                                  item._id,

                                  isAdmin
                                    ? "user"
                                    : "admin"
                                )
                              }
                              className={`rounded-lg border px-4 py-2 text-xs font-medium transition disabled:opacity-40 ${
                                isAdmin
                                  ? "border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
                                  : "border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white"
                              }`}
                            >
                              {changingRole ===
                              item._id
                                ? "Updating..."
                                : isAdmin
                                ? "Remove Admin"
                                : "Make Admin"}
                            </button>
                          )}

                        </td>

                      </motion.tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </motion.div>
      )}

      {/* PAGINATION */}

      {!loading &&
        pagination.pages >
          1 && (
          <div className="mt-6 flex items-center justify-between">

            <p className="text-sm text-zinc-600">
              Page{" "}
              {
                pagination.page
              }{" "}
              of{" "}
              {
                pagination.pages
              }
            </p>

            <div className="flex gap-2">

              <button
                disabled={
                  page <= 1
                }
                onClick={() =>
                  setPage(
                    (current) =>
                      Math.max(
                        1,
                        current - 1
                      )
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-zinc-500 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                disabled={
                  page >=
                  pagination.pages
                }
                onClick={() =>
                  setPage(
                    (current) =>
                      Math.min(
                        pagination.pages,
                        current + 1
                      )
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-zinc-500 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

            </div>

          </div>
        )}

    </div>
  );
};

// =====================================================
// STAT CARD
// =====================================================

const StatCard = ({
  title,
  value,
  icon: Icon,
}) => (
  <motion.div
    initial={{
      opacity: 0,
      y: 12,
    }}
    animate={{
      opacity: 1,
      y: 0,
    }}
    whileHover={{
      y: -3,
    }}
    className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5"
  >

    <div className="flex items-center justify-between">

      <div>

        <p className="text-xs text-zinc-600">
          {title}
        </p>

        <p className="mt-2 text-2xl font-bold">
          {value}
        </p>

      </div>

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
        <Icon className="h-5 w-5 text-red-500" />
      </div>

    </div>

  </motion.div>
);

export default AdminUsers;