
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight, Bot, ChartNoAxesCombined, IndianRupee,
  RefreshCw, Send, Sparkles, Ticket, TrendingUp, Users,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useAuth } from "../../context/AuthContext";

const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const number = (value) => Number(value || 0).toLocaleString("en-IN");
const card = "rounded-[24px] border border-white/[0.09] bg-[#141417]";
const easing = [0.22, 1, 0.36, 1];
const questions = [
  "Give me a performance summary",
  "Which movies are performing best?",
  "Which upcoming shows have weak occupancy?",
  "What time slots generate the most revenue?",
  "What should I consider scheduling more often?",
];

function Stat({ icon: Icon, label, value, info }) {
  return (
    <div className="min-w-0 border-b border-white/10 py-5 sm:border-b-0 sm:border-r sm:px-6 first:sm:pl-0 last:sm:border-r-0">
      <div className="flex items-center gap-2 text-[#9595a0]"><Icon size={15} className="text-[#ff5e78]" /><span className="text-xs">{label}</span></div>
      <p className="mt-3 break-words text-[clamp(1.6rem,2.4vw,2.5rem)] font-semibold tracking-[-0.055em] text-[#f3f3f4] tabular-nums">{value}</p>
      <p className="mt-2 text-[11px] text-[#767680]">{info}</p>
    </div>
  );
}

function AnalyticsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/15 bg-[#242126] px-4 py-3 shadow-2xl">
      <p className="text-xs text-[#aaa2a8]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{money(payload[0]?.value)}</p>
    </div>
  );
}

function Analyst({ token }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (messages.length > 0 || sending) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  const ask = async (prompt) => {
    const value = String(prompt || "").trim();
    if (!value || !token || sending) return;
    setQuestion("");
    setSending(true);
    setMessages((existing) => [...existing, { role: "user", text: value }]);
    try {
      const response = await axios.post(
        `${API_URL}/api/admin/analytics/ai-insights`,
        { question: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((existing) => [...existing, {
        role: "assistant",
        text: response.data?.answer || "No insight was returned.",
        groundedIn: response.data?.groundedIn,
        aiUsed: response.data?.aiUsed,
      }]);
    } catch (error) {
      setMessages((existing) => [...existing, {
        role: "assistant",
        error: true,
        text: error.response?.data?.error || error.response?.data?.message || "The analyst is unavailable. Please retry.",
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`${card} flex h-full min-h-[530px] flex-col overflow-hidden`}>
      <div className="flex items-start gap-3 border-b border-white/10 px-6 py-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D71935]/15 text-[#ff5873]"><Bot size={21} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#ff6b82]">Cinema intelligence</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-white">Ask your data.</h3>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={() => setMessages([])} disabled={sending} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#a6a6b0] hover:text-white disabled:opacity-40">Clear</button>
        )}
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6" aria-live="polite" style={{ maxHeight: 490 }}>
        {messages.length === 0 && (
          <div>
            <p className="text-sm leading-6 text-[#a8a8b2]">Questions are answered using BookMySeat's real booking and screening analytics.</p>
            <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6e6e77]">Start with a question</p>
            <div className="mt-4 space-y-2">
              {questions.map((prompt, index) => (
                <button
                  type="button" key={prompt} onClick={() => ask(prompt)} disabled={sending}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-left text-xs leading-5 text-[#c6c6cf] transition hover:border-[#D71935]/50 hover:text-white disabled:opacity-40"
                >
                  <span><span className="mr-3 text-[#c4415a]">0{index + 1}</span>{prompt}</span>
                  <ArrowUpRight size={14} className="shrink-0 opacity-40 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "ml-6 rounded-2xl rounded-br-sm bg-[#D71935] p-4 text-sm leading-6 text-white" : "border-l-2 border-[#D71935]/70 pl-4 text-sm leading-6 text-[#d3d3db]"}>
            {message.role === "assistant" && <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#ff6980]"><Sparkles size={13} /> Analyst {message.aiUsed === false && <span className="font-normal text-[#9999a5]">· fallback</span>}</p>}
            <p className={`whitespace-pre-wrap ${message.error ? "text-[#ff9aa9]" : ""}`}>{message.text}</p>
            {message.groundedIn && (
              <p className="mt-3 border-t border-white/10 pt-2 text-[11px] text-[#90909c]">Based on {number(message.groundedIn.confirmedBookings)} confirmed bookings and {number(message.groundedIn.upcomingShows)} upcoming shows.</p>
            )}
          </div>
        ))}
        {sending && <p className="flex items-center gap-2 text-sm text-[#aaaab4]"><span className="h-3 w-3 animate-pulse rounded-full bg-[#D71935]" /> Analysing...</p>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={(event) => { event.preventDefault(); ask(question); }} className="flex items-center gap-2 border-t border-white/10 p-4">
        <input
          value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500}
          aria-label="Question for AI analyst" placeholder="Ask the analyst..."
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#222226] px-4 py-3 text-sm text-white outline-none placeholder:text-[#6f6f7a] focus:border-[#D71935]/70"
        />
        <button type="submit" disabled={!question.trim() || sending} aria-label="Send question" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D71935] text-white transition hover:bg-[#ee2846] disabled:opacity-35"><Send size={17} /></button>
      </form>
    </div>
  );
}

export default function AdminAnalytics() {
  const { token } = useAuth();
  const reduced = useReducedMotion();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState("");

  // Clear successful refresh feedback after five seconds.
  useEffect(() => {
    if (!refreshFeedback) return undefined;
    const timeoutId = window.setTimeout(() => setRefreshFeedback(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [refreshFeedback]);

  const refreshController = useRef(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState(6);

  const loadData = useCallback(async (signal) => {
    if (!token) return false;
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_URL}/api/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` }, signal,
      });
      if (signal?.aborted) return false;
      setData(response.data);
      return true;
    } catch (problem) {
      if (signal?.aborted || axios.isCancel(problem)) return false;
      setError(problem.response?.data?.error || "Analytics could not be loaded.");
      return false;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  useEffect(() => () => refreshController.current?.abort(), []);

  const handleRefresh = async () => {
    if (loading || refreshing) return;
    const controller = new AbortController();
    refreshController.current = controller;
    setRefreshing(true);
    setRefreshFeedback("");
    try {
      const [success] = await Promise.all([
        loadData(controller.signal),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
      if (controller.signal.aborted) return;
      if (success) {
        const confirmation = "Analytics refreshed successfully.";
        setRefreshFeedback(confirmation);
        toast.success(confirmation);
      } else {
        toast.error("Could not refresh analytics.");
      }
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
      if (refreshController.current === controller) refreshController.current = null;
    }
  };

  const summary = data?.summary || {};
  const trend = Array.isArray(data?.revenueTrend) ? data.revenueTrend : [];
  const displayedTrend = useMemo(() => trend.slice(-range).map((item) => ({
    ...item, label: item.label || `${item.month}/${item.year}`, revenue: Number(item.revenue || 0),
  })), [trend, range]);
  const topMovies = Array.isArray(data?.topMovies) ? data.topMovies.slice(0, 6) : [];
  const maxMovieRevenue = Math.max(1, ...topMovies.map((item) => Number(item.revenue || 0)));
  const statuses = Array.isArray(data?.statusBreakdown) ? data.statusBreakdown : [];
  const statusTotal = statuses.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const lowOccupancy = Array.isArray(data?.lowOccupancyShows) ? data.lowOccupancyShows.slice(0, 5) : [];
  const timeSlots = Array.isArray(data?.timeSlotPerformance) ? data.timeSlotPerformance.slice(0, 5) : [];
  const totalUpcoming = Array.isArray(data?.upcomingShows) ? data.upcomingShows.length : Number(summary.upcomingShows || 0);

  return (
    <div className="mx-auto max-w-[1540px] text-white">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.27em] text-[#ff607b]"><span className="h-px w-8 bg-[#D71935]" /> Intelligence / 02</p>
          <h1 className="mt-4 text-[clamp(2.25rem,3.8vw,4rem)] font-semibold leading-[0.97] tracking-[-0.075em] text-[#f2f0ed]">Behind the<br /><span className="text-[#d83b55]">numbers.</span></h1>
          <p className="mt-5 text-sm leading-7 text-[#9f9fa9]">Revenue, audience demand and screening performance, without the guesswork.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          aria-busy={refreshing}
          className="inline-flex items-center gap-3 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-[#ededed] transition-colors duration-300 hover:border-[#D71935] hover:bg-[#D71935]/10 disabled:cursor-wait disabled:opacity-60"
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
          {refreshing ? "Refreshing..." : "Refresh insights"}
        </button>
      </header>

      <p role="status" aria-live="polite" className="mt-2 min-h-4 text-xs text-emerald-300">{refreshFeedback}</p>
      {error && <div role="alert" className="mt-7 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error} <button type="button" className="ml-2 underline" onClick={handleRefresh}>Retry</button></div>}
      {loading && !data ? (
        <div role="status" className="mt-12 grid gap-4 lg:grid-cols-2"><div className="h-[430px] animate-pulse rounded-3xl bg-white/[0.06]" /><div className="h-[430px] animate-pulse rounded-3xl bg-white/[0.06]" /></div>
      ) : (
        <>
          <div className="mt-10 grid gap-3 border-y border-white/10 py-2 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={IndianRupee} label="Confirmed revenue" value={money(summary.revenue)} info="Total reported by analytics" />
            <Stat icon={Ticket} label="Tickets sold" value={number(summary.ticketsSold)} info={`${number(summary.confirmedBookings)} confirmed bookings`} />
            <Stat icon={TrendingUp} label="Average booking" value={money(summary.averageOrderValue)} info="Confirmed booking value" />
            <Stat icon={Users} label="Refund rate" value={`${Number(summary.refundRate || 0)}%`} info="Reported refund percentage" />
          </div>

          <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(310px,0.9fr)]">
            <motion.section initial={reduced ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: easing }} className={`${card} overflow-hidden p-6 sm:p-8`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.23em] text-[#ff5e78]">01 / Revenue stream</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">How business is moving.</h2>
                  <p className="mt-2 text-xs text-[#85858f]">Confirmed booking revenue by month</p>
                </div>
                <div className="flex rounded-full border border-white/10 bg-white/[0.025] p-1" role="group" aria-label="Revenue date range">
                  {[3, 6].map((months) => <button key={months} type="button" onClick={() => setRange(months)} aria-pressed={range === months} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${range === months ? "bg-[#D71935] text-white" : "text-[#9999a4] hover:text-white"}`}>{months}M</button>)}
                </div>
              </div>
              <div className="mt-9 h-[290px] w-full min-w-0">
                {displayedTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayedTrend} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                      <defs><linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D71935" stopOpacity={0.34} /><stop offset="95%" stopColor="#D71935" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid stroke="#29292d" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="label" stroke="#777780" tick={{ fill: "#93939f", fontSize: 11 }} axisLine={false} tickLine={false} dy={12} />
                      <YAxis stroke="#777780" tick={{ fill: "#93939f", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`} />
                      <Tooltip content={<AnalyticsTooltip />} cursor={{ stroke: "#D71935", strokeDasharray: "4 4" }} />
                      <Area type="monotone" dataKey="revenue" stroke="#ed3653" strokeWidth={3} fill="url(#adminRevenueFill)" activeDot={{ r: 6, fill: "#ff5972", stroke: "#141417", strokeWidth: 3 }} isAnimationActive={!reduced} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="flex h-full items-center justify-center text-sm text-[#888893]">Revenue history will appear after confirmed bookings.</div>}
              </div>
            </motion.section>
            <Analyst token={token} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className={`${card} p-6 sm:p-8`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.21em] text-[#ff6079]">02 / Audience favourites</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">Films driving revenue</h2>
              <div className="mt-7 space-y-5">
                {topMovies.length ? topMovies.map((movie, index) => (
                  <div key={movie._id || index} className="group flex items-center gap-4">
                    <span className="w-7 shrink-0 font-mono text-xl text-[#d6445c]">{String(index + 1).padStart(2, "0")}</span>
                    {movie.poster ? <img src={movie.poster} alt="" className="h-16 w-11 shrink-0 rounded-md object-cover" loading="lazy" /> : <div className="h-16 w-11 shrink-0 rounded-md bg-[#303035]" />}
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex justify-between gap-2 text-sm"><span className="truncate font-semibold text-white">{movie.title || "Untitled"}</span><span className="shrink-0 font-semibold tabular-nums text-[#dedee1]">{money(movie.revenue)}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><motion.div initial={{ width: 0 }} whileInView={{ width: `${Math.max(0, Math.min(100, (Number(movie.revenue || 0) / maxMovieRevenue) * 100))}%` }} viewport={{ once: true }} transition={{ duration: reduced ? 0 : 0.8, ease: easing }} className="h-full rounded-full bg-[#D71935]" /></div>
                      <p className="mt-2 text-[11px] text-[#777781]">{number(movie.bookings)} bookings · {number(movie.tickets)} tickets</p>
                    </div>
                  </div>
                )) : <p className="py-12 text-center text-sm text-[#8b8b94]">No confirmed movie revenue yet.</p>}
              </div>
            </section>

            <section className={`${card} p-6 sm:p-8`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.21em] text-[#ff6079]">03 / Transaction mix</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">Where bookings stand</h2>
              {statuses.length ? (
                <>
                  <div className="mt-8 flex h-3 overflow-hidden rounded-full bg-white/[0.05]">
                    {statuses.map((item, index) => <div key={item.status || index} title={`${item.status}: ${item.count}`} className="h-full" style={{ width: `${statusTotal ? Number(item.count || 0) / statusTotal * 100 : 0}%`, background: ["#D71935", "#f1eee9", "#a28a91", "#67676f", "#424248", "#2d2d32"][index % 6] }} />)}
                  </div>
                  <div className="mt-6 space-y-2">
                    {statuses.map((item, index) => (
                      <div key={item.status || index} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm">
                        <span className="flex items-center gap-3 text-[#c2c2ca]"><i className="h-2 w-2 rounded-full" style={{ background: ["#D71935", "#f1eee9", "#a28a91", "#67676f", "#424248", "#2d2d32"][index % 6] }} />{String(item.status || "Unknown").replace(/_/g, " ")}</span>
                        <span className="font-semibold tabular-nums">{number(item.count)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="py-12 text-center text-sm text-[#8b8b94]">No booking status data yet.</p>}
            </section>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className={`${card} p-6 sm:p-8`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.21em] text-[#ff6079]">04 / Demand watch</p>
              <div className="flex items-end justify-between gap-3"><h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">Low occupancy</h2><span className="text-xs text-[#878792]">Next 7 days</span></div>
              <p className="mt-2 text-xs text-[#85858f]">{number(totalUpcoming)} upcoming shows in the reporting window</p>
              <div className="mt-6 space-y-4">
                {lowOccupancy.length ? lowOccupancy.map((show, index) => {
                  const pct = Math.max(0, Math.min(100, Number(show.occupancy || 0)));
                  return <div key={show.showId || index} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">{show.movie || "Film"}</p><p className="mt-1 text-xs text-[#8d8d96]">{show.theatre || "Cinema"} · {show.startTime ? new Date(show.startTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"}</p></div><span className="text-lg font-semibold tabular-nums text-[#ff6079]">{pct.toFixed(0)}%</span></div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#D71935]" style={{ width: `${pct}%` }} /></div>
                    <p className="mt-2 text-[11px] text-[#787882]">{number(show.ticketsSold)} / {number(show.capacity)} seats sold</p>
                  </div>;
                }) : <p className="py-12 text-center text-sm text-[#8b8b94]">No upcoming occupancy data yet.</p>}
              </div>
            </section>
            <section className={`${card} p-6 sm:p-8`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.21em] text-[#ff6079]">05 / Screening hours</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">Best-performing slots</h2>
              <p className="mt-2 text-xs text-[#85858f]">Time slots ranked by confirmed revenue</p>
              <div className="mt-6 divide-y divide-white/[0.07]">
                {timeSlots.length ? timeSlots.map((slot, index) => (
                  <div key={`${slot.hour}-${index}`} className="flex items-center justify-between gap-3 py-5">
                    <div className="flex items-center gap-4"><span className="font-mono text-xl text-[#d64159]">{String(index + 1).padStart(2, "0")}</span><div><p className="text-sm font-semibold text-white">{slot.label || `${slot.hour}:00`}</p><p className="mt-1 text-xs text-[#8a8a94]">{number(slot.bookings)} bookings · {number(slot.tickets)} tickets</p></div></div>
                    <span className="font-semibold tabular-nums text-[#e6e6e9]">{money(slot.revenue)}</span>
                  </div>
                )) : <p className="py-12 text-center text-sm text-[#8b8b94]">No showtime performance data yet.</p>}
              </div>
            </section>
          </div>
          <p className="mt-8 flex items-center gap-2 text-xs text-[#777782]"><ChartNoAxesCombined size={14} /> Figures reflect the current backend reporting period, not simulated data.</p>
        </>
      )}
    </div>
  );
}
