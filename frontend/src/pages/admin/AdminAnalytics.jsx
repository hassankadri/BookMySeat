
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  IndianRupee,
  RefreshCw,
  Send,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../context/AuthContext";

const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const EASE = [0.22, 1, 0.36, 1];
const surface = "overflow-hidden rounded-[22px] border border-white/10 bg-[#111114]/90";
const number = (value) => Number(value || 0).toLocaleString("en-IN");
const money = (value) => `₹${number(value)}`;
const suggestions = [
  "Give me a performance summary",
  "Which movies are performing best?",
  "Which upcoming shows have weak occupancy?",
  "What time slots generate the most revenue?",
  "What should I consider scheduling more often?",
];
const STATUS_COLORS = ["#D71935", "#f2e9e9", "#ae9097", "#777078", "#55525a", "#36343b"];

function SectionLabel({ index, children }) {
  return (
    <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff5874]">
      <span className="h-px w-7 bg-[#D71935]" />
      <span>{children}</span>
      <span className="text-zinc-600">/ {index}</span>
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value, detail }) {
  return (
    <div className={`${surface} group p-5 transition-colors duration-300 hover:border-[#D71935]/35 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400">{label}</span>
        <Icon size={17} className="text-[#ff5874]" strokeWidth={1.8} />
      </div>
      <p className="cine-head mt-5 break-words text-[clamp(1.65rem,2.6vw,2.65rem)] leading-none tabular-nums text-white">{value}</p>
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/15 bg-[#201c21] px-4 py-3 shadow-2xl">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="cine-head mt-1 text-lg text-white">{money(payload[0].value)}</p>
    </div>
  );
}

function EmptyData({ children }) {
  return <p className="py-12 text-center text-sm leading-6 text-zinc-500">{children}</p>;
}

function DataAnalyst({ token, reducedMotion }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!messages.length && !sending) return;
    bottomRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [messages, sending, reducedMotion]);

  const ask = async (raw) => {
    const value = String(raw || "").trim();
    if (!value || !token || sending) return;
    setQuestion("");
    setSending(true);
    setMessages((previous) => [...previous, { role: "user", text: value }]);
    try {
      const response = await axios.post(
        `${API_URL}/api/admin/analytics/ai-insights`,
        { question: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((previous) => [...previous, {
        role: "assistant",
        text: response.data?.answer || "No insight was returned.",
        groundedIn: response.data?.groundedIn,
        aiUsed: response.data?.aiUsed,
      }]);
    } catch (error) {
      setMessages((previous) => [...previous, {
        role: "assistant",
        error: true,
        text: error.response?.data?.error || error.response?.data?.message || "The analyst is unavailable. Please retry.",
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={`${surface} flex h-full min-h-[535px] flex-col`} aria-label="AI analytics assistant">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D71935]/35 bg-[#D71935]/10 text-[#ff5874]">
          <Bot size={20} strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff5874]">Cinema intelligence</p>
          <h3 className="cine-head mt-1 text-lg text-white">Ask your data.</h3>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            disabled={sending}
            onClick={() => setMessages([])}
            className="rounded-full border border-white/15 px-3.5 py-2 text-xs text-zinc-400 transition-colors hover:border-white/30 hover:text-white disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-6" style={{ maxHeight: 490 }} aria-live="polite">
        {!messages.length && (
          <>
            <p className="text-sm leading-7 text-zinc-400">Explore booking and screening performance using your platform's actual analytics.</p>
            <p className="pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Start with a question</p>
            <div className="space-y-2">
              {suggestions.map((prompt, index) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={sending || !token}
                  onClick={() => void ask(prompt)}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3.5 text-left text-xs leading-5 text-zinc-300 transition-all duration-300 hover:border-[#D71935]/50 hover:bg-[#D71935]/10 hover:text-white disabled:opacity-40"
                >
                  <span><span className="mr-3 text-[#ff5874]">{String(index + 1).padStart(2, "0")}</span>{prompt}</span>
                  <ArrowUpRight size={15} className="shrink-0 text-zinc-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#ff5874]" />
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map((message, index) => (
          <motion.article
            key={index}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={message.role === "user"
              ? "ml-6 rounded-2xl rounded-tr-sm border border-[#D71935]/35 bg-[#321b22] p-4 text-sm leading-7 text-white"
              : "border-l-2 border-[#D71935] py-1 pl-4 text-sm leading-7 text-zinc-200"}
          >
            {message.role === "assistant" && (
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff5874]">
                Analyst {message.aiUsed === false && <span className="font-normal normal-case tracking-normal text-zinc-500">· Standard analysis</span>}
              </p>
            )}
            <p className={`whitespace-pre-wrap break-words ${message.error ? "text-rose-300" : ""}`}>{message.text}</p>
            {message.groundedIn && (
              <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-5 text-zinc-500">
                Based on {number(message.groundedIn.confirmedBookings)} confirmed bookings and {number(message.groundedIn.upcomingShows)} upcoming shows.
              </p>
            )}
          </motion.article>
        ))}
        {sending && (
          <p role="status" className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#D71935]" /> Analysing your data...
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => { event.preventDefault(); void ask(question); }}
        className="flex gap-2 border-t border-white/10 bg-[#151417] p-4"
      >
        <input
          aria-label="Question for analytics assistant"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about revenue, bookings, demand..."
          maxLength={500}
          disabled={!token || sending}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#222025] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-[#D71935]/70 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!question.trim() || sending || !token}
          aria-label="Send analytics question"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D71935] text-white transition-colors hover:bg-[#ee304d] disabled:opacity-35"
        >
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}

export default function AdminAnalytics() {
  const { token } = useAuth();
  const reducedMotion = useReducedMotion();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [error, setError] = useState("");
  const [range, setRange] = useState(6);
  const controllerRef = useRef(null);

  const loadData = useCallback(async (signal) => {
    if (!token) return false;
    setError("");
    try {
      const response = await axios.get(`${API_URL}/api/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` }, signal,
      });
      if (signal.aborted) return false;
      setData(response.data);
      return true;
    } catch (requestError) {
      if (signal.aborted || axios.isCancel(requestError)) return false;
      setError(requestError.response?.data?.error || "Analytics could not be loaded.");
      return false;
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadData(controller.signal).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [loadData]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (!refreshSuccess) return undefined;
    const timer = window.setTimeout(() => setRefreshSuccess(false), 5000);
    return () => window.clearTimeout(timer);
  }, [refreshSuccess]);

  const handleRefresh = async () => {
    if (loading || refreshing || !token) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRefreshing(true);
    setRefreshSuccess(false);
    try {
      const [success] = await Promise.all([
        loadData(controller.signal),
        new Promise((resolve) => window.setTimeout(resolve, 700)),
      ]);
      if (!controller.signal.aborted && success) setRefreshSuccess(true);
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const summary = data?.summary || {};
  const trend = Array.isArray(data?.revenueTrend) ? data.revenueTrend : [];
  const displayedTrend = useMemo(() => trend.slice(-range).map((item) => ({
    ...item,
    label: item.label || `${item.month}/${item.year}`,
    revenue: Number(item.revenue || 0),
  })), [trend, range]);
  const topMovies = Array.isArray(data?.topMovies) ? data.topMovies.slice(0, 6) : [];
  const maximumRevenue = Math.max(1, ...topMovies.map((item) => Number(item.revenue || 0)));
  const statuses = Array.isArray(data?.statusBreakdown) ? data.statusBreakdown : [];
  const statusTotal = statuses.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const lowOccupancy = Array.isArray(data?.lowOccupancyShows) ? data.lowOccupancyShows.slice(0, 5) : [];
  const timeSlots = Array.isArray(data?.timeSlotPerformance) ? data.timeSlotPerformance.slice(0, 5) : [];
  const upcomingCount = Array.isArray(data?.upcomingShows)
    ? data.upcomingShows.length : Number(summary.upcomingShows || 0);

  return (
    <div className="mx-auto max-w-[1460px] text-white">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-7">
        <div>
          <SectionLabel index="02">Cinema intelligence</SectionLabel>
          <h1 className="cine-display mt-5 text-[clamp(2.6rem,4.7vw,4.6rem)] leading-[.95]">
            Behind the <span className="text-[#ff4562]">numbers.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
            Revenue, audience demand and screening performance — all in one place.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            aria-busy={refreshing}
            className="group inline-flex min-h-[44px] items-center gap-3 rounded-full border border-white/20 bg-white/[0.035] px-5 py-3 text-xs font-semibold text-zinc-200 transition-all duration-300 hover:border-[#D71935]/60 hover:bg-[#D71935]/10 hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            <motion.span
              className="inline-flex text-[#ff526e]"
              animate={refreshing && !reducedMotion ? { rotate: 360 } : { rotate: 0 }}
              transition={refreshing && !reducedMotion
                ? { duration: 1.15, repeat: Infinity, ease: "linear" }
                : { duration: 0.2 }}
            >
              <RefreshCw size={17} strokeWidth={1.7} />
            </motion.span>
            {refreshing ? "Refreshing analytics..." : "Refresh insights"}
          </button>
          <div className="min-h-[20px]" aria-live="polite" aria-atomic="true">
            <AnimatePresence>
              {refreshSuccess && (
                <motion.p
                  key="refreshed"
                  role="status"
                  initial={reducedMotion ? false : { opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-xs font-medium text-emerald-300"
                >
                  <CheckCircle2 size={15} /> Analytics updated
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-[#D71935]/35 bg-[#D71935]/10 p-4 text-sm text-rose-200">
          {error}{" "}
          <button type="button" disabled={loading || refreshing} onClick={handleRefresh} className="font-semibold underline disabled:opacity-50">Retry</button>
        </div>
      )}

      {loading && !data ? (
        <div role="status" className="mt-8 grid gap-5 xl:grid-cols-2">
          <div className="h-[330px] animate-pulse rounded-[22px] bg-white/[0.05]" />
          <div className="h-[330px] animate-pulse rounded-[22px] bg-white/[0.05]" />
        </div>
      ) : (
        <>
          <section aria-label="Key analytics" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric icon={IndianRupee} label="Confirmed revenue" value={money(summary.revenue)} detail="Revenue reported by analytics" />
            <SummaryMetric icon={Ticket} label="Tickets sold" value={number(summary.ticketsSold)} detail={`${number(summary.confirmedBookings)} confirmed bookings`} />
            <SummaryMetric icon={TrendingUp} label="Average booking" value={money(summary.averageOrderValue)} detail="Confirmed booking value" />
            <SummaryMetric icon={Users} label="Refund rate" value={`${Number(summary.refundRate || 0)}%`} detail="Reported refund percentage" />
          </section>

          <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
            <section className={`${surface} p-5 sm:p-7`} aria-label="Revenue trend">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <SectionLabel index="01">Revenue stream</SectionLabel>
                  <h2 className="cine-head mt-4 text-[clamp(1.45rem,2.5vw,2rem)]">How business is moving.</h2>
                  <p className="mt-2 text-xs text-zinc-500">Confirmed booking revenue by month</p>
                </div>
                <div className="flex rounded-full border border-white/10 bg-[#1b1a1f] p-1" role="group" aria-label="Revenue history range">
                  {[3, 6].map((months) => (
                    <button
                      key={months} type="button" aria-pressed={range === months}
                      onClick={() => setRange(months)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${range === months ? "bg-[#D71935] text-white" : "text-zinc-400 hover:text-white"}`}
                    >{months}M</button>
                  ))}
                </div>
              </div>
              <div className="mt-8 h-[290px] min-w-0">
                {displayedTrend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayedTrend} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="adminAnalyticsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#D71935" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#D71935" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#303037" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#9a98a1", fontSize: 11 }} tickLine={false} axisLine={false} dy={12} />
                      <YAxis tick={{ fill: "#9a98a1", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)} />
                      <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "#D71935", strokeDasharray: "4 4" }} />
                      <Area
                        type="monotone" dataKey="revenue" stroke="#ee3856" strokeWidth={3}
                        fill="url(#adminAnalyticsRevenueFill)" isAnimationActive={!reducedMotion}
                        activeDot={{ r: 5, fill: "#ff5874", stroke: "#111114", strokeWidth: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="flex h-full items-center justify-center"><EmptyData>Revenue history appears when confirmed bookings are available.</EmptyData></div>}
              </div>
            </section>
            <DataAnalyst token={token} reducedMotion={reducedMotion} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className={`${surface} p-5 sm:p-7`} aria-label="Top performing films">
              <SectionLabel index="02">Audience favourites</SectionLabel>
              <h2 className="cine-head mt-4 text-[clamp(1.45rem,2.5vw,2rem)]">Films driving revenue</h2>
              <div className="mt-7 space-y-5">
                {topMovies.length ? topMovies.map((film, index) => (
                  <div key={film._id || index} className="flex items-center gap-4">
                    <span className="w-7 shrink-0 text-lg tabular-nums text-[#ff5874]">{String(index + 1).padStart(2, "0")}</span>
                    {film.poster ? (
                      <img src={film.poster} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded-md bg-[#262329] object-cover" />
                    ) : <div className="h-16 w-11 shrink-0 rounded-md bg-[#262329]" />}
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="cine-head truncate text-white">{film.title || "Untitled"}</span>
                        <span className="shrink-0 tabular-nums text-zinc-200">{money(film.revenue)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        <motion.div
                          initial={reducedMotion ? false : { width: 0 }}
                          whileInView={{ width: `${Math.min(100, Math.max(0, Number(film.revenue || 0) / maximumRevenue * 100))}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: reducedMotion ? 0 : 0.8, ease: EASE }}
                          className="h-full rounded-full bg-[#D71935]"
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-500">{number(film.bookings)} bookings · {number(film.tickets)} tickets</p>
                    </div>
                  </div>
                )) : <EmptyData>No confirmed movie revenue yet.</EmptyData>}
              </div>
            </section>

            <section className={`${surface} p-5 sm:p-7`} aria-label="Booking status distribution">
              <SectionLabel index="03">Transaction mix</SectionLabel>
              <h2 className="cine-head mt-4 text-[clamp(1.45rem,2.5vw,2rem)]">Where bookings stand</h2>
              {statuses.length ? (
                <>
                  <div className="mt-8 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                    {statuses.map((item, index) => (
                      <div key={`${item.status}-${index}`} title={`${item.status}: ${item.count}`}
                        style={{ width: `${statusTotal ? Number(item.count || 0) / statusTotal * 100 : 0}%`, backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }} />
                    ))}
                  </div>
                  <div className="mt-5 space-y-2">
                    {statuses.map((item, index) => (
                      <div key={`${item.status}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm">
                        <span className="flex min-w-0 items-center gap-3 text-zinc-300">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }} />
                          <span className="truncate">{String(item.status || "Unknown").replace(/_/g, " ")}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-white">{number(item.count)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <EmptyData>No booking status data yet.</EmptyData>}
            </section>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className={`${surface} p-5 sm:p-7`} aria-label="Low occupancy screening report">
              <SectionLabel index="04">Demand watch</SectionLabel>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
                <h2 className="cine-head text-[clamp(1.45rem,2.5vw,2rem)]">Low occupancy</h2>
                <span className="text-xs text-zinc-500">Next 7 days</span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{number(upcomingCount)} upcoming shows in the reporting window</p>
              <div className="mt-6 space-y-3">
                {lowOccupancy.length ? lowOccupancy.map((show, index) => {
                  const percentage = Math.min(100, Math.max(0, Number(show.occupancy || 0)));
                  return (
                    <div key={show.showId || index} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="cine-head truncate text-sm text-white">{show.movie || "Film"}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            {show.theatre || "Cinema"} · {show.startTime
                              ? new Date(show.startTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
                              : "—"}
                          </p>
                        </div>
                        <span className="cine-head shrink-0 text-xl tabular-nums text-[#ff5874]">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[#D71935]" style={{ width: `${percentage}%` }} />
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-500">{number(show.ticketsSold)} / {number(show.capacity)} seats sold</p>
                    </div>
                  );
                }) : <EmptyData>No upcoming occupancy data yet.</EmptyData>}
              </div>
            </section>

            <section className={`${surface} p-5 sm:p-7`} aria-label="Showtime revenue report">
              <SectionLabel index="05">Screening hours</SectionLabel>
              <h2 className="cine-head mt-4 text-[clamp(1.45rem,2.5vw,2rem)]">Best-performing slots</h2>
              <p className="mt-2 text-xs text-zinc-500">Time slots ranked by confirmed revenue</p>
              <div className="mt-6 divide-y divide-white/[0.08]">
                {timeSlots.length ? timeSlots.map((slot, index) => (
                  <div key={`${slot.hour}-${index}`} className="flex items-center justify-between gap-4 py-5">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="text-lg tabular-nums text-[#ff5874]">{String(index + 1).padStart(2, "0")}</span>
                      <div className="min-w-0">
                        <p className="cine-head truncate text-sm text-white">{slot.label || `${slot.hour}:00`}</p>
                        <p className="mt-1 text-xs text-zinc-500">{number(slot.bookings)} bookings · {number(slot.tickets)} tickets</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-200">{money(slot.revenue)}</span>
                  </div>
                )) : <EmptyData>No showtime performance data yet.</EmptyData>}
              </div>
            </section>
          </div>
          <p className="mt-7 flex items-center gap-2 text-xs text-zinc-500">
            <BarChart3 size={15} className="text-[#ff5874]" /> Reports use current platform data, not simulated figures.
          </p>
        </>
      )}
    </div>
  );
}
