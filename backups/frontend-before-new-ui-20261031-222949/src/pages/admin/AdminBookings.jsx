
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  IndianRupee,
  MapPin,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  Search,
  ShieldCheck,
  Ticket,
  User,
  X,
  XCircle,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

// Admin refund approval is separate from manual refunds.
// Customer requests: /api/customer-bookings/:id/refund-request
// Admin approvals: /api/customer-bookings/admin/refund-requests/:id/approve

const API_URL = (
  process.env.REACT_APP_BACKEND_URL || ""
).replace(/\/$/, "");

const STATUSES = [
  "ALL",
  "REFUND_PENDING",
  "CONFIRMED",
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
];

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const friendly = (value) =>
  String(value || "UNKNOWN").replaceAll("_", " ");

const bookingCode = (booking) =>
  booking.bookingCode ||
  booking.bookingReference ||
  String(booking._id || "").slice(-8);

function dateLabel(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function statusStyle(status) {
  switch (status) {
    case "CONFIRMED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";

    case "REFUND_PENDING":
      return "border-violet-500/25 bg-violet-500/10 text-violet-300";

    case "REFUNDED":
      return "border-sky-500/20 bg-sky-500/10 text-sky-300";

    case "PENDING_PAYMENT":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";

    default:
      return "border-white/10 bg-white/[0.05] text-white/60";
  }
}

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-[23px] border border-white/[0.08] bg-white/[0.035] p-5">
      <div className="flex items-center justify-between text-white/40">
        <span className="text-[11px] uppercase tracking-[0.18em]">
          {label}
        </span>
        <Icon size={17} />
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
    </div>
  );
}

function Info({ icon: Icon, label, value, secondary }) {
  return (
    <div className="min-w-0 rounded-[16px] border border-white/[0.055] bg-white/[0.023] p-3.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-white/40">
        <Icon
          size={13}
          className="text-[#d64c64]"
        />
        {label}
      </div>

      <p className="mt-2 break-words text-sm font-medium text-white/85">
        {value || "—"}
      </p>

      {secondary && (
        <p className="mt-1 break-words text-xs text-white/40">
          {secondary}
        </p>
      )}
    </div>
  );
}

export default function AdminBookings() {
  const { token } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState("");

  // Clear successful refresh text after five seconds.
  useEffect(() => {
    if (!refreshFeedback) return undefined;

    const timer = window.setTimeout(
      () => setRefreshFeedback(""),
      5000
    );

    return () => window.clearTimeout(timer);
  }, [refreshFeedback]);

  const refreshController = useRef(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusMenuRef = useRef(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchBookings = useCallback(
    async (silent = false, signal) => {
      if (!token) return false;

      if (!silent) setLoading(true);

      try {
        const params = { limit: 100 };

        if (status !== "ALL") {
          params.status = status;
        }

        const response = await axios.get(
          `${API_URL}/api/admin/bookings`,
          {
            params,
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal,
          }
        );

        if (signal?.aborted) return false;

        setBookings(response.data?.bookings || []);
        return true;
      } catch (error) {
        if (signal?.aborted || axios.isCancel(error)) {
          return false;
        }

        console.error(
          "Admin bookings load:",
          error
        );

        toast.error(
          error.response?.data?.error ||
          "Could not load bookings."
        );

        return false;
      } finally {
        if (!signal?.aborted && !silent) {
          setLoading(false);
        }
      }
    },
    [token, status]
  );

  useEffect(() => {
    const controller = new AbortController();

    fetchBookings(false, controller.signal);

    return () => controller.abort();
  }, [fetchBookings]);

  useEffect(
    () => () => refreshController.current?.abort(),
    []
  );

  useEffect(() => {
    if (!statusOpen) return undefined;

    const dismiss = (event) => {
      if (
        event.type === "keydown" &&
        event.key === "Escape"
      ) {
        setStatusOpen(false);
      } else if (
        event.type === "pointerdown" &&
        !statusMenuRef.current?.contains(
          event.target
        )
      ) {
        setStatusOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      dismiss
    );

    document.addEventListener(
      "keydown",
      dismiss
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        dismiss
      );

      document.removeEventListener(
        "keydown",
        dismiss
      );
    };
  }, [statusOpen]);

  const handleRefresh = async () => {
    if (loading || refreshing) return;

    const controller = new AbortController();

    refreshController.current = controller;
    setRefreshing(true);
    setRefreshFeedback("");

    try {
      const [success] = await Promise.all([
        fetchBookings(true, controller.signal),
        new Promise((resolve) =>
          setTimeout(resolve, 1200)
        ),
      ]);

      if (controller.signal.aborted) return;

      if (success) {
        const confirmation =
          "Bookings refreshed successfully.";

        setRefreshFeedback(confirmation);
        toast.success(confirmation);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return bookings;

    return bookings.filter((booking) =>
      [
        bookingCode(booking),
        booking.user?.name,
        booking.user?.email,
        booking.movie?.title,
        booking.show?.theatre?.name,
        booking.show?.screen?.name,
        booking.status,
        booking.paymentStatus,
        booking.cancellationReason,
        ...(booking.seats || []),
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(q)
        )
    );
  }, [bookings, search]);

  const counts = useMemo(
    () => ({
      total: bookings.length,

      confirmed: bookings.filter(
        (b) => b.status === "CONFIRMED"
      ).length,

      requests: bookings.filter(
        (b) =>
          b.status === "REFUND_PENDING" &&
          b.refundRequest?.requestedAt
      ).length,

      revenue: bookings
        .filter(
          (b) => b.status === "CONFIRMED"
        )
        .reduce(
          (sum, b) =>
            sum + Number(b.totalAmount || 0),
          0
        ),
    }),
    [bookings]
  );

  function openAction(booking, type) {
    setSelected(booking);
    setAction(type);
    setReason("");
  }

  function closeAction() {
    if (processing) return;

    setSelected(null);
    setAction(null);
    setReason("");
  }

  async function submitAction() {
    if (!selected || !action || processing) {
      return;
    }

    if (
      action === "refund" &&
      !reason.trim()
    ) {
      toast.error(
        "Enter a reason for this manual refund."
      );
      return;
    }

    setProcessing(true);

    try {
      let path;
      let body = {};

      if (action === "approve") {
        path =
          `${API_URL}/api/customer-bookings/admin/refund-requests/` +
          `${selected._id}/approve`;
      } else if (action === "refund") {
        path =
          `${API_URL}/api/admin/bookings/` +
          `${selected._id}/refund`;

        body = {
          reason: reason.trim(),
        };
      } else {
        path =
          `${API_URL}/api/admin/bookings/` +
          `${selected._id}/cancel`;

        body = {
          reason:
            reason.trim() ||
            "Cancelled by admin",
        };
      }

      const response = await axios.post(
        path,
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success(
        response.data?.message ||
        "Booking updated."
      );

      setSelected(null);
      setAction(null);
      setReason("");

      await fetchBookings(true);
    } catch (error) {
      console.error(
        "Admin booking action:",
        error
      );

      toast.error(
        error.response?.data?.message ||
        error.response?.data?.error ||
        "The action could not be completed."
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="text-white">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#ea536b]">
            Transactions
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Bookings & refunds
          </h1>

          <p className="mt-2 text-sm leading-6 text-white/45">
            Manage bookings, review customer cancellations
            and approve Stripe refunds.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            aria-busy={refreshing}
            className="inline-flex items-center gap-3 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-[#ededed] transition-colors duration-300 hover:border-[#D71935] hover:bg-[#D71935]/10 disabled:cursor-wait disabled:opacity-60"
          >
            <motion.span
              className="inline-flex h-4 w-4 items-center justify-center"
              animate={
                refreshing
                  ? { rotate: 360 }
                  : { rotate: 0 }
              }
              transition={
                refreshing
                  ? {
                      duration: 2.4,
                      repeat: Infinity,
                      ease: "linear",
                    }
                  : {
                      duration: 0.25,
                      ease: "easeOut",
                    }
              }
            >
              <RefreshCw size={16} />
            </motion.span>

            {refreshing
              ? "Refreshing..."
              : "Refresh data"}
          </button>

          <p
            role="status"
            aria-live="polite"
            className="min-h-4 text-xs text-emerald-300"
          >
            {refreshFeedback}
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat
          label="Loaded bookings"
          value={counts.total}
          icon={Ticket}
        />

        <MiniStat
          label="Confirmed"
          value={counts.confirmed}
          icon={CheckCircle2}
        />

        <MiniStat
          label="Refund requests"
          value={counts.requests}
          icon={RotateCcw}
        />

        <MiniStat
          label="Visible revenue"
          value={money(counts.revenue)}
          icon={IndianRupee}
        />
      </div>

      <div className="mt-7 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search booking, customer, movie, seat or reason..."
            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#D71935]/60"
          />
        </div>

        <div
          ref={statusMenuRef}
          className="relative w-full shrink-0 lg:w-64"
        >
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={statusOpen}
            aria-controls="bookings-status-options"
            onClick={() =>
              setStatusOpen((open) => !open)
            }
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border bg-[#19191d] px-4 py-3 text-left text-sm text-[#ededf0] outline-none transition-colors duration-200 focus-visible:border-[#D71935] ${
              statusOpen
                ? "border-[#D71935]/60"
                : "border-white/[0.10] hover:border-white/25"
            }`}
          >
            <span>
              {status === "ALL"
                ? "All statuses"
                : friendly(status)}
            </span>

            <motion.span
              animate={{
                rotate: statusOpen ? 180 : 0,
              }}
              transition={{ duration: 0.22 }}
            >
              <ChevronDown
                size={16}
                className="text-[#9d9da9]"
              />
            </motion.span>
          </button>

          <AnimatePresence>
            {statusOpen && (
              <motion.div
                id="bookings-status-options"
                role="listbox"
                aria-label="Filter booking status"
                initial={{
                  opacity: 0,
                  y: -7,
                  scale: 0.985,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: -5,
                  scale: 0.985,
                }}
                transition={{
                  duration: 0.2,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-white/[0.13] bg-[#202025] p-1.5 shadow-[0_24px_65px_rgba(0,0,0,0.55)]"
              >
                {STATUSES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="option"
                    aria-selected={status === item}
                    onClick={() => {
                      setStatus(item);
                      setStatusOpen(false);
                      setRefreshFeedback("");
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-[13px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D71935] ${
                      status === item
                        ? "bg-[#D71935]/15 text-[#fff0f3]"
                        : "text-[#c6c6ce] hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <span>
                      {item === "ALL"
                        ? "All statuses"
                        : friendly(item)}
                    </span>

                    {status === item && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-[#f15a75]"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-white/45">
          Loading bookings...
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-[25px] border border-white/[0.08] bg-white/[0.025] py-20 text-center text-white/45">
          No bookings match your filters.
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {filtered.map((booking, index) => {
            const confirmed =
              booking.status === "CONFIRMED";

            const unpaid =
              booking.status === "PENDING_PAYMENT";

            const request =
              booking.status === "REFUND_PENDING" &&
              Boolean(
                booking.refundRequest?.requestedAt
              );

            const requestStage =
              booking.refundRequest?.status ||
              "REQUESTED";

            const seatReleased = Boolean(
              booking.refundRequest?.seatReleasedAt
            );

            return (
              <motion.article
                key={booking._id}
                initial={{
                  opacity: 0,
                  y: 12,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: Math.min(
                    index * 0.02,
                    0.2
                  ),
                }}
                className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(130deg,rgba(255,255,255,0.04),rgba(255,255,255,0.014))]"
              >
                <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
                  <div className="min-w-0 xl:w-64 xl:shrink-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-white/75">
                        #{bookingCode(booking)}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.09em] ${statusStyle(
                          booking.status
                        )}`}
                      >
                        {friendly(booking.status)}
                      </span>
                    </div>

                    <h2 className="mt-3 text-xl font-semibold tracking-tight">
                      {booking.movie?.title ||
                        "Movie"}
                    </h2>

                    <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-white/45">
                      <MapPin
                        size={15}
                        className="mt-0.5 shrink-0 text-[#D71935]"
                      />
                      {booking.show?.theatre?.name ||
                        "Cinema"}{" "}
                      ·{" "}
                      {booking.show?.screen?.name ||
                        "Screen"}
                    </p>
                  </div>

                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Info
                      icon={User}
                      label="Customer"
                      value={booking.user?.name}
                      secondary={
                        booking.user?.email
                      }
                    />

                    <Info
                      icon={CalendarDays}
                      label="Show"
                      value={dateLabel(
                        booking.show?.startTime
                      )}
                    />

                    <Info
                      icon={Ticket}
                      label="Seats"
                      value={
                        booking.seats?.join(", ") ||
                        "—"
                      }
                    />

                    <Info
                      icon={IndianRupee}
                      label="Amount"
                      value={money(
                        booking.totalAmount
                      )}
                    />
                  </div>
                </div>

                {request && (
                  <div className="mx-5 mb-4 rounded-[18px] border border-violet-500/20 bg-violet-500/[0.06] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-violet-200">
                        <ShieldCheck size={16} />
                        Customer refund request
                      </span>

                      <span className="text-xs text-violet-200/70">
                        {requestStage === "REQUESTED"
                          ? "Awaiting admin approval"
                          : `Stripe / approval: ${friendly(
                              requestStage
                            )}`}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-white/75">
                      <span className="text-white/40">
                        Reason:
                      </span>{" "}
                      {booking.cancellationReason ||
                        "No reason provided"}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/45">
                      <span>
                        Requested:{" "}
                        {dateLabel(
                          booking.refundRequest?.requestedAt
                        )}
                      </span>

                      <span>
                        Seats:{" "}
                        {seatReleased
                          ? "Released"
                          : "Release needs attention"}
                      </span>
                    </div>

                    {booking.refundRequest?.lastError && (
                      <p className="mt-2 text-xs leading-5 text-amber-200">
                        Attention:{" "}
                        {booking.refundRequest.lastError}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-white/[0.06] bg-black/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-5 text-xs text-white/45">
                    <span className="flex items-center gap-2">
                      <CreditCard size={15} />
                      {friendly(
                        booking.paymentStatus ||
                          booking.payment?.status
                      )}
                    </span>

                    <span className="flex items-center gap-2">
                      <Clock3 size={15} />
                      {dateLabel(
                        booking.createdAt
                      )}
                    </span>

                    {booking.ticketUsed && (
                      <span className="text-violet-300">
                        Ticket used
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {unpaid && (
                      <button
                        onClick={() =>
                          openAction(
                            booking,
                            "cancel"
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/[0.07] px-4 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/10"
                      >
                        <XCircle size={15} />
                        Cancel unpaid booking
                      </button>
                    )}

                    {confirmed &&
                      !booking.ticketUsed && (
                        <button
                          onClick={() =>
                            openAction(
                              booking,
                              "refund"
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/[0.07] px-4 py-2 text-xs font-medium text-sky-300 hover:bg-sky-500/10"
                        >
                          <RotateCcw size={15} />
                          Manual full refund
                        </button>
                      )}

                    {request && (
                      <button
                        onClick={() =>
                          openAction(
                            booking,
                            "approve"
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/15 px-5 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-400/20"
                      >
                        <ShieldCheck size={15} />
                        {requestStage ===
                        "REQUESTED"
                          ? "Approve & refund"
                          : "Check Stripe refund"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && action && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-lg"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-action-heading"
              initial={{
                opacity: 0,
                y: 15,
                scale: 0.97,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                scale: 0.97,
              }}
              className="w-full max-w-lg rounded-[27px] border border-white/10 bg-[#151519] p-6 shadow-2xl sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#e25670]">
                    Booking action
                  </p>

                  <h2
                    id="admin-action-heading"
                    className="mt-2 text-xl font-semibold"
                  >
                    {action === "approve"
                      ? "Approve customer refund"
                      : action === "refund"
                        ? "Manual full refund"
                        : "Cancel unpaid booking"}
                  </h2>

                  <p className="mt-2 font-mono text-xs text-white/40">
                    #{bookingCode(selected)}
                  </p>
                </div>

                <button
                  onClick={closeAction}
                  disabled={processing}
                  aria-label="Close"
                  className="rounded-full border border-white/10 p-2 text-white/50 hover:text-white disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-6 rounded-[18px] border border-white/[0.07] bg-white/[0.035] p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={19}
                    className="mt-0.5 shrink-0 text-amber-300"
                  />

                  <div className="text-sm leading-6 text-white/65">
                    {action === "approve" ? (
                      <>
                        <p className="text-white/85">
                          Approve the customer's
                          cancellation and initiate
                          the full{" "}
                          {money(
                            selected.totalAmount
                          )}{" "}
                          Stripe refund?
                        </p>

                        <p className="mt-2">
                          The ticket was invalidated
                          when the customer requested
                          cancellation. Its seat must
                          be safely released before
                          Stripe is refunded.
                        </p>

                        <p className="mt-2">
                          Customer reason:{" "}
                          {selected.cancellationReason ||
                            "Not provided"}
                        </p>
                      </>
                    ) : action === "refund" ? (
                      "This manual admin action issues a Stripe refund for a paid booking. It does not require a customer request."
                    ) : (
                      "This will cancel the selected unpaid booking."
                    )}
                  </div>
                </div>
              </div>

              {action !== "approve" && (
                <>
                  <label
                    htmlFor="admin-reason"
                    className="mt-5 block text-sm text-white/70"
                  >
                    Reason
                  </label>

                  <textarea
                    id="admin-reason"
                    rows={3}
                    maxLength={500}
                    value={reason}
                    onChange={(e) =>
                      setReason(e.target.value)
                    }
                    placeholder="Explain this action..."
                    className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white outline-none focus:border-[#D71935]/70"
                  />
                </>
              )}

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  disabled={processing}
                  onClick={closeAction}
                  className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/80 disabled:opacity-50"
                >
                  Go back
                </button>

                <button
                  disabled={processing}
                  onClick={submitAction}
                  className="rounded-full bg-[#D71935] px-4 py-3 text-sm font-semibold text-white hover:bg-[#e62e49] disabled:opacity-50"
                >
                  {processing
                    ? "Processing..."
                    : action === "approve"
                      ? "Approve & refund"
                      : action === "refund"
                        ? "Confirm refund"
                        : "Confirm cancellation"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
