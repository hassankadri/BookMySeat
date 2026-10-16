
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

import {
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  Shield,
  User,
  UserRoundCog,
  Users,
  XCircle,
} from "lucide-react";

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

const API_URL = (
  process.env.REACT_APP_BACKEND_URL || ""
).replace(/\/+$/, "");

const PAGE_SIZE = 20;

const PARTNER_API =
  `${API_URL}/api/admin/partner-assignments`;

function getError(error, fallback) {
  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    fallback
  );
}

function partnerIdOf(value) {
  if (!value) return "";

  return String(
    typeof value === "object"
      ? value._id || ""
      : value
  );
}

const AdminUsers = () => {
  const {
    token,
    user: currentUser,
  } = useAuth();

  // =====================================================
  // EXISTING USER MANAGEMENT
  // =====================================================

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] =
    useState("all");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] =
    useState({
      page: 1,
      pages: 1,
      total: 0,
    });

  const [changingRole, setChangingRole] =
    useState(null);

  const [grantingPartner, setGrantingPartner] =
    useState(null);

  // =====================================================
  // FEATURE 7 — PARTNER ASSIGNMENTS
  // =====================================================

  const [partners, setPartners] = useState([]);
  const [theatres, setTheatres] = useState([]);

  const [
    selectedAssignments,
    setSelectedAssignments,
  ] = useState({});

  const [
    assignmentsLoading,
    setAssignmentsLoading,
  ] = useState(true);

  const [
    assignmentsError,
    setAssignmentsError,
  ] = useState("");

  const [
    savingTheatre,
    setSavingTheatre,
  ] = useState(null);

  const [
    assignmentRevision,
    setAssignmentRevision,
  ] = useState(0);

  const currentUserId = String(
    currentUser?._id ||
    currentUser?.id ||
    ""
  );

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

        const { data } = await axios.get(
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

        setUsers(data.users || []);

        setPagination(
          data.pagination || {
            page: 1,
            pages: 1,
            total: 0,
          }
        );
      } catch (error) {
        if (controller.signal.aborted) return;

        toast.error(
          getError(
            error,
            "Could not load users."
          )
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
  }, [
    search,
    roleFilter,
    page,
    token,
  ]);

  // =====================================================
  // LOAD PARTNERS AND THEATRE OWNERSHIP
  // =====================================================

  useEffect(() => {
    if (!token) {
      setAssignmentsLoading(false);
      return undefined;
    }

    const controller = new AbortController();

    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    };

    setAssignmentsLoading(true);
    setAssignmentsError("");

    Promise.all([
      axios.get(
        `${PARTNER_API}/partners`,
        config
      ),
      axios.get(
        `${PARTNER_API}/theatres`,
        config
      ),
    ])
      .then(([partnerResponse, theatreResponse]) => {
        if (controller.signal.aborted) return;

        const partnerList =
          partnerResponse.data.partners || [];

        const theatreList =
          theatreResponse.data.theatres || [];

        setPartners(partnerList);
        setTheatres(theatreList);

        const assignments = {};

        theatreList.forEach((theatre) => {
          assignments[theatre._id] =
            partnerIdOf(theatre.partner);
        });

        setSelectedAssignments(assignments);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        setAssignmentsError(
          getError(
            error,
            "Could not load cinema partner assignments."
          )
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setAssignmentsLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, assignmentRevision]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const stats = useMemo(
    () => ({
      admins: users.filter(
        (item) => item.role === "admin"
      ).length,

      verified: users.filter(
        (item) => item.emailVerified !== false
      ).length,

      google: users.filter(
        (item) => Boolean(item.googleId)
      ).length,
    }),
    [users]
  );

  const updateSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const updateRoleFilter = (value) => {
    setRoleFilter(value);
    setPage(1);
  };

  // =====================================================
  // EXISTING ADMIN ROLE MANAGEMENT
  // =====================================================

  const changeRole = async (
    userId,
    newRole
  ) => {
    const targetUser = users.find(
      (item) =>
        String(item._id) === String(userId)
    );

    if (
      !targetUser ||
      changingRole ||
      grantingPartner
    ) {
      return;
    }

    // Partner privileges must not be changed
    // through the general admin-role toggle.
    if (
      !["user", "admin"].includes(
        targetUser.role
      )
    ) {
      toast.error(
        "Manage partner accounts through partner assignments."
      );

      return;
    }

    if (
      String(userId) === currentUserId
    ) {
      toast.error(
        "You cannot change your own admin role."
      );
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
      const { data } = await axios.patch(
        `${API_URL}/api/admin/users/${userId}/role`,
        {
          role: newRole,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUsers((current) =>
        current.map((item) =>
          String(item._id) === String(userId)
            ? data.user || {
                ...item,
                role: newRole,
              }
            : item
        )
      );

      toast.success(
        newRole === "admin"
          ? "Admin access granted."
          : "Admin access removed."
      );
    } catch (error) {
      toast.error(
        getError(
          error,
          "Could not update user role."
        )
      );
    } finally {
      setChangingRole(null);
    }
  };

  // =====================================================
  // GRANT PARTNER ROLE
  // =====================================================

  const grantPartner = async (targetUser) => {
    if (
      !targetUser ||
      targetUser.role !== "user" ||
      targetUser.emailVerified === false ||
      changingRole ||
      grantingPartner
    ) {
      return;
    }

    if (
      !window.confirm(
        `Grant cinema partner access to ${targetUser.name}?`
      )
    ) {
      return;
    }

    setGrantingPartner(targetUser._id);

    try {
      const { data } = await axios.patch(
        `${PARTNER_API}/users/${targetUser._id}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!data.success) {
        throw new Error(
          "Partner access was not confirmed."
        );
      }

      setUsers((current) =>
        current.map((item) =>
          item._id === targetUser._id
            ? {
                ...item,
                role: "partner",
              }
            : item
        )
      );

      setAssignmentRevision(
        (current) => current + 1
      );

      toast.success(
        "Cinema partner access granted."
      );
    } catch (error) {
      toast.error(
        getError(
          error,
          "Could not grant partner access."
        )
      );
    } finally {
      setGrantingPartner(null);
    }
  };

  // =====================================================
  // ASSIGN / UNASSIGN THEATRE
  // =====================================================

  const saveAssignment = async (theatre) => {
    if (savingTheatre) return;

    const partnerId =
      selectedAssignments[theatre._id] || "";

    const oldPartnerId =
      partnerIdOf(theatre.partner);

    if (partnerId === oldPartnerId) {
      return;
    }

    const partner = partners.find(
      (item) => item._id === partnerId
    );

    const confirmed = window.confirm(
      partnerId
        ? `Assign ${theatre.name} to ${partner?.name || "this partner"}?`
        : `Remove the current partner from ${theatre.name}?`
    );

    if (!confirmed) return;

    setSavingTheatre(theatre._id);

    try {
      const { data } = await axios.patch(
        `${PARTNER_API}/theatres/${theatre._id}`,
        {
          partnerId: partnerId || null,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!data.success) {
        throw new Error(
          "Theatre assignment was not confirmed."
        );
      }

      setAssignmentRevision(
        (current) => current + 1
      );

      toast.success(
        partnerId
          ? "Cinema partner assigned."
          : "Cinema partner assignment removed."
      );
    } catch (error) {
      toast.error(
        getError(
          error,
          "Could not update theatre assignment."
        )
      );
    } finally {
      setSavingTheatre(null);
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
        subtitle="Manage customer accounts, administrator access and cinema partnerships."
      />

      {/* ACCOUNT STATISTICS */}

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
          title="Cinema partners"
          value={partners.length}
          icon={Building2}
          delay={0.15}
        />
      </div>

      {/* ACCOUNT SEARCH AND FILTER */}

      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center">
        <AdminSearch
          value={search}
          onChange={(event) =>
            updateSearch(event.target.value)
          }
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

      {/* EXISTING USERS TABLE */}

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
            <table className="w-full min-w-[1000px]">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className={th}>User</th>
                  <th className={th}>Verification</th>
                  <th className={th}>Login method</th>
                  <th className={th}>Joined</th>
                  <th className={th}>Role</th>
                  <th className={`${th} text-right`}>
                    Access
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map((item, index) => {
                  const isCurrent =
                    String(item._id) === currentUserId;

                  const isAdmin =
                    item.role === "admin";

                  const isPartner =
                    item.role === "partner";

                  const canGrantPartner =
                    item.role === "user" &&
                    item.emailVerified !== false &&
                    !isCurrent;

                  const joined = item.createdAt
                    ? new Intl.DateTimeFormat(
                        "en-IN",
                        {
                          dateStyle: "medium",
                        }
                      ).format(new Date(item.createdAt))
                    : "—";

                  return (
                    <motion.tr
                      key={item._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        delay: Math.min(
                          index * 0.02,
                          0.25
                        ),
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
                            ) : isPartner ? (
                              <Building2 className="h-5 w-5 text-[#e45b73]" />
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
                                <Pill tone="crimson">
                                  You
                                </Pill>
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
                          <Mail className="h-3.5 w-3.5" />
                          {item.googleId
                            ? "Google + email"
                            : "Email"}
                        </Pill>
                      </td>

                      <td className={`${td} text-sm text-zinc-400`}>
                        {joined}
                      </td>

                      <td className={td}>
                        <Pill
                          tone={
                            isAdmin
                              ? "crimson"
                              : isPartner
                                ? "info"
                                : "mute"
                          }
                        >
                          {isAdmin
                            ? "Admin"
                            : isPartner
                              ? "Partner"
                              : "User"}
                        </Pill>
                      </td>

                      <td className={`${td} text-right`}>
                        {isCurrent ? (
                          <span className="text-xs text-zinc-600">
                            Protected
                          </span>
                        ) : isPartner ? (
                          <span className="text-xs text-zinc-500">
                            Cinema partner
                          </span>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-2">
                            {canGrantPartner && (
                              <button
                                type="button"
                                disabled={Boolean(
                                  changingRole ||
                                  grantingPartner
                                )}
                                onClick={() =>
                                  grantPartner(item)
                                }
                                className="rounded-full border border-[#D71935]/40 px-4 py-2 text-xs font-semibold text-[#f19cad] transition hover:bg-[#D71935]/10 disabled:opacity-40"
                              >
                                {grantingPartner === item._id
                                  ? "Granting..."
                                  : "Make partner"}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={Boolean(
                                changingRole ||
                                grantingPartner
                              )}
                              onClick={() =>
                                changeRole(
                                  item._id,
                                  isAdmin
                                    ? "user"
                                    : "admin"
                                )
                              }
                              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-white/40 hover:text-white disabled:opacity-40"
                            >
                              {changingRole === item._id
                                ? "Updating..."
                                : isAdmin
                                  ? "Remove admin"
                                  : "Make admin"}
                            </button>
                          </div>
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
        <div className="mt-6">
          <Pager
            page={pagination.page}
            pages={pagination.pages}
            onPrev={() =>
              setPage((current) =>
                Math.max(1, current - 1)
              )
            }
            onNext={() =>
              setPage((current) =>
                Math.min(
                  pagination.pages,
                  current + 1
                )
              )
            }
          />
        </div>
      )}

      {/* ============================================= */}
      {/* FEATURE 7 — CINEMA PARTNER ASSIGNMENTS */}
      {/* ============================================= */}

      <section className="mt-16 border-t border-white/10 pt-12">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ee647b]">
              Cinema network / Access
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.055em] text-white sm:text-4xl">
              Partner assignments.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
              Assign verified cinema partner accounts to
              individual theatres. Each partner can access
              only their assigned locations.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setAssignmentRevision(
                (current) => current + 1
              )
            }
            disabled={
              assignmentsLoading ||
              Boolean(savingTheatre)
            }
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-white transition hover:border-[#D71935]/60 disabled:opacity-40"
          >
            <RefreshCw size={15} />
            Refresh assignments
          </button>
        </div>

        {assignmentsError && (
          <div
            role="alert"
            className="mt-7 rounded-xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-200"
          >
            {assignmentsError}
          </div>
        )}

        {assignmentsLoading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-zinc-400">
            <Loader2
              size={18}
              className="animate-spin text-[#D71935]"
            />
            Loading cinema assignments...
          </div>
        ) : theatres.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#121215] p-8 text-center">
            <Building2 className="mx-auto h-8 w-8 text-zinc-500" />

            <p className="mt-4 text-sm text-zinc-400">
              {assignmentsError
                ? "Cinema assignments are unavailable."
                : "No theatres are available for assignment."}
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-[24px] border border-white/10 bg-[#121215]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
              <p className="text-sm font-semibold text-white">
                Theatre ownership
              </p>

              <p className="text-xs text-zinc-500">
                {theatres.length} cinemas · {partners.length} partners
              </p>
            </div>

            <div className="divide-y divide-white/[0.07]">
              {theatres.map((theatre) => {
                const currentPartnerId =
                  partnerIdOf(theatre.partner);

                const chosenId =
                  selectedAssignments[theatre._id] || "";

                const changed =
                  chosenId !== currentPartnerId;

                const busy =
                  savingTheatre === theatre._id;

                return (
                  <div
                    key={theatre._id}
                    className="grid items-center gap-5 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_minmax(230px,340px)_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {theatre.name}
                      </p>

                      <p className="mt-1.5 text-xs text-zinc-500">
                        {theatre.city || "Location unavailable"}
                        {!theatre.isActive && " · Inactive"}
                      </p>

                      <p className="mt-2 text-xs text-zinc-400">
                        {theatre.partner?.name
                          ? `Current partner: ${theatre.partner.name}`
                          : "Currently unassigned"}
                      </p>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-[11px] font-medium text-zinc-500">
                        Assigned partner
                      </span>

                      <select
                        value={chosenId}
                        disabled={
                          Boolean(savingTheatre) ||
                          assignmentsLoading
                        }
                        onChange={(event) =>
                          setSelectedAssignments(
                            (current) => ({
                              ...current,
                              [theatre._id]:
                                event.target.value,
                            })
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#202025] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D71935] disabled:opacity-50"
                      >
                        <option value="">
                          Unassigned
                        </option>

                        {partners.map((partner) => (
                          <option
                            key={partner._id}
                            value={partner._id}
                          >
                            {partner.name} — {partner.email}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        saveAssignment(theatre)
                      }
                      disabled={
                        !changed ||
                        Boolean(savingTheatre)
                      }
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-xs font-semibold text-white transition hover:bg-[#e22b47] disabled:cursor-not-allowed disabled:opacity-35 xl:self-end"
                    >
                      {busy && (
                        <Loader2
                          size={14}
                          className="animate-spin"
                        />
                      )}

                      {busy
                        ? "Saving..."
                        : "Save assignment"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="mt-5 text-xs leading-6 text-zinc-500">
          To add a new partner, find a verified customer
          account above and select "Make partner".
          Theatre reassignment takes effect through
          backend ownership checks.
        </p>
      </section>
    </div>
  );
};

export default AdminUsers;
