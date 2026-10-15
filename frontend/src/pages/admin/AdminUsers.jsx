
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Mail,
  Shield,
  User,
  Users,
  XCircle,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

import {
  AdminHeader,
  AdminSearch,
  AdminStat,
  Empty,
  Loading,
  Pager,
  Pill,
  Segmented,
  TableCard,
  td,
  th,
} from "../../components/ui/admin";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.REACT_APP_BACKEND_URL;
const PAGE_SIZE = 20;

const AdminUsers = () => {
  const { token, user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });
  const [changingRole, setChangingRole] = useState(null);

  // =====================================================
  // LOAD USERS
  // =====================================================

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const params = {
          page,
          limit: PAGE_SIZE,
        };

        if (search.trim()) {
          params.search = search.trim();
        }

        if (roleFilter !== "all") {
          params.role = roleFilter;
        }

        const response = await axios.get(
          `${API_URL}/api/admin/users`,
          {
            params,
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (controller.signal.aborted) return;

        setUsers(response.data.users || []);

        setPagination(
          response.data.pagination || {
            page: 1,
            pages: 1,
            total: 0,
          }
        );
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("Users load error:", error);

        toast.error(
          error.response?.data?.error ||
            "Could not load users."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, roleFilter, page, token]);

  const updateSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const updateRoleFilter = (value) => {
    setRoleFilter(value);
    setPage(1);
  };

  // =====================================================
  // COUNTS AND CURRENT USER
  // =====================================================

  const currentUserId = String(
    currentUser?._id || currentUser?.id || ""
  );

  const stats = useMemo(
    () => ({
      admins: users.filter((item) => item.role === "admin").length,
      verified: users.filter(
        (item) => item.emailVerified !== false
      ).length,
      google: users.filter((item) => Boolean(item.googleId)).length,
    }),
    [users]
  );

  // =====================================================
  // UPDATE USER ROLE
  // =====================================================

  const changeRole = async (userId, newRole) => {
    const targetUser = users.find(
      (item) => String(item._id) === String(userId)
    );

    if (!targetUser || changingRole) return;

    if (String(userId) === currentUserId) {
      toast.error("You cannot change your own admin role.");
      return;
    }

    const confirmed = window.confirm(
      newRole === "admin"
        ? `Give admin access to ${targetUser.name}?`
        : `Remove admin access from ${targetUser.name}?`
    );

    if (!confirmed) return;

    setChangingRole(userId);

    try {
      const response = await axios.patch(
        `${API_URL}/api/admin/users/${userId}/role`,
        { role: newRole },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUsers((current) =>
        current.map((item) =>
          String(item._id) === String(userId)
            ? response.data.user || { ...item, role: newRole }
            : item
        )
      );

      toast.success(
        newRole === "admin"
          ? "Admin access granted."
          : "Admin access removed."
      );
    } catch (error) {
      console.error("Role update error:", error);

      toast.error(
        error.response?.data?.error ||
          "Could not update user role."
      );
    } finally {
      setChangingRole(null);
    }
  };

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div>
      <AdminHeader
        kicker="Accounts"
        title="Users."
        subtitle="View registered accounts and manage administrator access."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat
          title="Total users"
          value={pagination.total || 0}
          icon={Users}
        />
        <AdminStat
          title="Admins on page"
          value={stats.admins}
          icon={Shield}
          delay={0.05}
        />
        <AdminStat
          title="Verified on page"
          value={stats.verified}
          icon={CheckCircle2}
          delay={0.1}
        />
        <AdminStat
          title="Google users on page"
          value={stats.google}
          icon={Mail}
          delay={0.15}
        />
      </div>

      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center">
        <AdminSearch
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
          placeholder="Search by name or email"
          className="flex-1"
        />

        <Segmented
          label="Role"
          value={roleFilter}
          onChange={updateRoleFilter}
          options={[
            ["all", "All roles"],
            ["user", "Users"],
            ["admin", "Admins"],
          ]}
        />
      </div>

      <div className="mt-8">
        {loading ? (
          <Loading label="Loading users" />
        ) : users.length === 0 ? (
          <Empty
            icon={Users}
            title="No users found"
            body="Try a different search or role."
          />
        ) : (
          <TableCard>
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className={th}>User</th>
                  <th className={th}>Verification</th>
                  <th className={th}>Login method</th>
                  <th className={th}>Joined</th>
                  <th className={th}>Role</th>
                  <th className={`${th} text-right`}>Access</th>
                </tr>
              </thead>

              <tbody>
                {users.map((item, index) => {
                  const isCurrent =
                    String(item._id) === currentUserId;
                  const isAdmin = item.role === "admin";

                  const joined = item.createdAt
                    ? new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                      }).format(new Date(item.createdAt))
                    : "—";

                  return (
                    <motion.tr
                      key={item._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        delay: Math.min(index * 0.02, 0.25),
                      }}
                      className="border-t border-white/5 transition-colors hover:bg-white/[0.03]"
                    >
                      <td className={td}>
                        <div className="flex items-center gap-4">
                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                              isAdmin
                                ? "border-crimson/40 bg-crimson/10"
                                : "border-white/10 bg-white/[0.04]"
                            }`}
                          >
                            {isAdmin ? (
                              <Shield className="h-5 w-5 text-crimson" />
                            ) : (
                              <User className="h-5 w-5 text-zinc-500" />
                            )}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-bone">
                                {item.name}
                              </p>
                              {isCurrent && (
                                <Pill tone="crimson">You</Pill>
                              )}
                            </div>

                            <p className="mt-0.5 truncate text-sm text-zinc-500">
                              {item.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className={td}>
                        {item.emailVerified !== false ? (
                          <Pill tone="good">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Verified
                          </Pill>
                        ) : (
                          <Pill tone="warn">
                            <XCircle className="h-3.5 w-3.5" />
                            Pending
                          </Pill>
                        )}
                      </td>

                      <td className={td}>
                        <Pill tone={item.googleId ? "info" : "mute"}>
                          {item.googleId ? "Google + email" : "Email"}
                        </Pill>
                      </td>

                      <td
                        className={`${td} cine-tabular text-sm text-zinc-400`}
                      >
                        {joined}
                      </td>

                      <td className={td}>
                        <Pill tone={isAdmin ? "crimson" : "mute"}>
                          {isAdmin ? "Admin" : "User"}
                        </Pill>
                      </td>

                      <td className={`${td} text-right`}>
                        {isCurrent ? (
                          <span className="text-xs text-zinc-600">
                            Protected
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(changingRole)}
                            onClick={() =>
                              changeRole(
                                item._id,
                                isAdmin ? "user" : "admin"
                              )
                            }
                            className={`rounded-full border px-5 py-2 text-xs font-semibold transition disabled:opacity-40 ${
                              isAdmin
                                ? "border-crimson/40 text-red-300 hover:bg-crimson/10"
                                : "border-white/15 text-zinc-300 hover:border-white/40 hover:text-white"
                            }`}
                          >
                            {changingRole === item._id
                              ? "Updating..."
                              : isAdmin
                              ? "Remove admin"
                              : "Make admin"}
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </TableCard>
        )}
      </div>

      {!loading && pagination.pages > 1 && (
        <Pager
          page={pagination.page}
          pages={pagination.pages}
          onPrev={() =>
            setPage((current) => Math.max(1, current - 1))
          }
          onNext={() =>
            setPage((current) =>
              Math.min(pagination.pages, current + 1)
            )
          }
        />
      )}
    </div>
  );
};

export default AdminUsers;
