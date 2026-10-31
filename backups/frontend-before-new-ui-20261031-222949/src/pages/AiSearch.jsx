
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Clapperboard,
  Film,
  MapPin,
  Plus,
  Send,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import PageShell from "../components/ui/PageShell";

const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const CHAT_KEY_PREFIX = "bookmyseat_ai_chat";
const ZONE = "Asia/Kolkata";
const EASE = [0.22, 1, 0.36, 1];

const QUICK_PROMPTS = [
  {
    title: "What's playing?",
    detail: "Explore current screenings",
    prompt: "Show me movies",
  },
  {
    title: "Something funny",
    detail: "Find a comedy for tonight",
    prompt: "Suggest a comedy",
  },
  {
    title: "Plan for tomorrow",
    detail: "Discover your next film",
    prompt: "Hindi movies tomorrow",
  },
  {
    title: "Stay within budget",
    detail: "Tickets under ₹300",
    prompt: "Anything under ₹300",
  },
];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: ZONE,
  }).format(date);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric", minute: "2-digit", timeZone: ZONE }).format(date);
}

function readCinema() {
  try {
    return {
      id: localStorage.getItem("bookmyseat_theatre") || "",
      name: localStorage.getItem("bookmyseat_theatre_name") || "",
      city: localStorage.getItem("bookmyseat_city") || "",
    };
  } catch {
    return { id: "", name: "", city: "" };
  }
}

function initialMessages(name) {
  return [{
    id: "assistant-welcome",
    role: "assistant",
    text: name
      ? `I'm here to help you find something worth watching at ${name}. Tell me what you're in the mood for, or ask to see what's playing.`
      : "Select a cinema to see real films and showtimes. I'll help you find the right one.",
    results: [],
    resultKind: null,
  }];
}

function Eyebrow({ children, suffix }) {
  return (
    <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.23em] text-[#ff526e] sm:text-[11px]">
      <span className="h-px w-7 shrink-0 bg-[#D71935]" />
      <span>{children}</span>
      {suffix && <span className="text-zinc-600">/ {suffix}</span>}
    </div>
  );
}

function FilmPoster({ show }) {
  const [broken, setBroken] = useState(false);
  const poster = show.movie?.poster;

  useEffect(() => setBroken(false), [poster]);

  return (
    <div className="relative aspect-[2/3] overflow-hidden bg-[#19191e]">
      {poster && !broken ? (
        <img
          src={poster}
          alt={`${show.movie?.title || "Film"} poster`}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <Film size={22} strokeWidth={1.3} className="text-white/35" />
          <span className="text-xs text-zinc-500">{show.movie?.title || "Artwork unavailable"}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
    </div>
  );
}

function ResultCards({ results, kind, onSelect }) {
  if (!Array.isArray(results) || results.length === 0) return null;

  return (
    <section className="mt-6 border-t border-white/10 pt-5" aria-label="Film results">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff526e]">
          {kind === "MOVIES" ? "Films found" : "Matching showtimes"}
        </span>
        <span className="text-[10px] tabular-nums text-zinc-500">
          {String(results.length).padStart(2, "0")} results
        </span>
      </div>
      <div className="cine-scroll flex snap-x gap-3 overflow-x-auto pb-2">
        {results.map((show, index) => (
          <button
            key={`${show.showId || "show"}-${index}`}
            type="button"
            onClick={() => onSelect(show)}
            className="group w-[150px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-[#17171b] text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#D71935]/70 hover:bg-[#202025] sm:w-[172px]"
          >
            <FilmPoster show={show} />
            <div className="px-3 pb-3 pt-3">
              <p className="cine-head truncate text-sm text-white">{show.movie?.title || "Film"}</p>
              <p className="mt-2 truncate text-[11px] text-zinc-400">{formatDate(show.startTime)}</p>
              <p className="mt-1 truncate text-[11px] text-zinc-400">
                {formatTime(show.startTime)}
                {show.minPrice != null ? ` · ₹${show.minPrice}+` : ""}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] font-semibold text-[#ff637b]">
                <span>
                  {kind === "MOVIES" && Number(show.showCount) > 1
                    ? `${show.showCount} shows` : "View booking"}
                </span>
                <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ConversationMessage({ message, onSelect, reduceMotion }) {
  const isUser = message.role === "user";

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: EASE }}
      className={`flex min-w-0 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`min-w-0 ${isUser ? "max-w-[90%] sm:max-w-[76%]" : "w-full max-w-[720px]"}`}>
        <div className={`mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] ${isUser ? "justify-end text-zinc-500" : "text-[#ff526e]"}`}>
          {!isUser && <span className="h-1.5 w-1.5 rounded-full bg-[#D71935]" />}
          {isUser ? "You" : "Film concierge"}
        </div>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm border border-[#8a3445]/35 bg-[#321b22] px-4 py-3.5 text-[13px] leading-6 text-[#f4e7e9] sm:text-sm">
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          </div>
        ) : (
          <div className="border-l-2 border-[#D71935] py-0.5 pl-4 sm:pl-5">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.85] text-zinc-200 sm:text-sm">
              {message.text}
            </p>
            <ResultCards results={message.results} kind={message.resultKind} onSelect={onSelect} />
          </div>
        )}
      </div>
    </motion.article>
  );
}

export default function AiSearch() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const requestId = useRef(0);
  const messageId = useRef(0);

  const [cinema, setCinema] = useState(readCinema);
  const [availableCinemas, setAvailableCinemas] = useState([]);
  const [cinemasLoading, setCinemasLoading] = useState(true);
  const [cinemasError, setCinemasError] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => initialMessages(readCinema().name));
  const [intent, setIntent] = useState({});
  const [currentResults, setCurrentResults] = useState([]);
  const [currentResultKind, setCurrentResultKind] = useState(null);
  const [busy, setBusy] = useState(false);
  const [readyChatKey, setReadyChatKey] = useState("");

  const selectedId = cinema.id;
  const chatKey = `${CHAT_KEY_PREFIX}:${selectedId || "none"}`;
  const hasConversation = messages.some((message) => message.role === "user");

  // Keep existing cinema discovery and API contracts unchanged.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setCinemasLoading(true);
    setCinemasError(false);

    axios.get(`${API_URL}/api/theatres`, { signal: controller.signal })
      .then(({ data }) => {
        if (!active) return;
        const venues = Array.isArray(data) ? data : data?.theatres;
        setAvailableCinemas(
          Array.isArray(venues)
            ? venues.filter((venue) => venue._id && venue.isActive !== false)
            : []
        );
      })
      .catch((error) => {
        if (!active) return;
        console.error("Cinema discovery failed:", error);
        setCinemasError(true);
      })
      .finally(() => {
        if (active) setCinemasLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Conversations remain isolated per cinema and persist within this tab.
  useEffect(() => {
    let restored = null;
    try {
      const saved = sessionStorage.getItem(chatKey);
      if (saved) restored = JSON.parse(saved);
    } catch {
      // Storage may be unavailable.
    }

    if (restored && Array.isArray(restored.messages) && restored.messages.length) {
      setMessages(
        restored.messages
          .filter((message) => message && (message.role === "user" || message.role === "assistant"))
          .map((message, index) => ({
            id: message.id || `restored-${index}`,
            role: message.role,
            text: typeof message.text === "string" ? message.text : "",
            results: Array.isArray(message.results) ? message.results : [],
            resultKind: message.resultKind || null,
          }))
      );
      setIntent(restored.intent && typeof restored.intent === "object" ? restored.intent : {});
      setCurrentResults(Array.isArray(restored.currentResults)
        ? restored.currentResults
        : Array.isArray(restored.results) ? restored.results : []);
      setCurrentResultKind(restored.currentResultKind || restored.resultKind || null);
    } else {
      setMessages(initialMessages(cinema.name));
      setIntent({});
      setCurrentResults([]);
      setCurrentResultKind(null);
    }
    setReadyChatKey(chatKey);
  }, [chatKey, cinema.name]);

  useEffect(() => {
    if (!selectedId || readyChatKey !== chatKey) return;
    try {
      sessionStorage.setItem(chatKey, JSON.stringify({
        messages, intent, currentResults, currentResultKind,
      }));
    } catch {
      // The assistant continues without session storage.
    }
  }, [selectedId, readyChatKey, chatKey, messages, intent, currentResults, currentResultKind]);

  useEffect(() => {
    if (!hasConversation || !scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [messages, busy, hasConversation, reduceMotion]);

  function selectCinema(venue) {
    if (!venue?._id) return;
    requestId.current += 1;
    setBusy(false);
    setInput("");
    const next = {
      id: String(venue._id),
      name: venue.name || "",
      city: venue.city || "",
    };
    try {
      localStorage.setItem("bookmyseat_theatre", next.id);
      localStorage.setItem("bookmyseat_theatre_name", next.name);
      localStorage.setItem("bookmyseat_city", next.city);
    } catch {
      // Local state still holds the selection.
    }
    setCinema(next);
  }

  function changeCinema() {
    requestId.current += 1;
    setBusy(false);
    setInput("");
    try {
      localStorage.removeItem("bookmyseat_theatre");
      localStorage.removeItem("bookmyseat_theatre_name");
      localStorage.removeItem("bookmyseat_city");
    } catch {
      // Local state still holds the selection.
    }
    setCinema({ id: "", name: "", city: "" });
  }

  const openShow = useCallback((show) => {
    if (!show?.showId || !show?.movie?.id || !show?.theatre?.id) {
      toast.error("This show's booking details are incomplete.");
      return;
    }
    if (String(show.theatre.id) !== String(selectedId)) {
      toast.error("That screening is not at your selected cinema.");
      return;
    }
    try {
      localStorage.setItem("bookmyseat_show", show.showId);
      localStorage.setItem("bookmyseat_theatre", show.theatre.id);
      localStorage.setItem("bookmyseat_theatre_name", show.theatre.name || "");
      if (show.theatre.city) localStorage.setItem("bookmyseat_city", show.theatre.city);
    } catch {
      // Complete selection is also encoded in the route.
    }
    navigate(`/booking/${show.movie.id}?show=${encodeURIComponent(show.showId)}&theatre=${encodeURIComponent(show.theatre.id)}`);
  }, [navigate, selectedId]);

  async function sendText(rawText) {
    const text = String(rawText || "").trim();
    if (!text || busy) return;
    if (!selectedId) {
      toast.error("Choose your cinema first.");
      return;
    }

    const currentRequest = ++requestId.current;
    const createId = (kind) => `${kind}-${Date.now()}-${++messageId.current}`;
    setInput("");
    setMessages((history) => [...history, {
      id: createId("user"), role: "user", text, results: [], resultKind: null,
    }]);
    setBusy(true);

    try {
      const response = await axios.post(`${API_URL}/api/ai/assistant`, {
        message: text,
        intent,
        results: currentResults,
        theatreId: selectedId,
      });
      if (requestId.current !== currentRequest) return;
      const data = response.data || {};
      if (data.intent) setIntent(data.intent);
      if (Array.isArray(data.results)) setCurrentResults(data.results);
      if (data.resultKind) setCurrentResultKind(data.resultKind);
      setMessages((history) => [...history, {
        id: createId("assistant"),
        role: "assistant",
        text: data.message || "Here is what I found.",
        results: data.action === "SEARCH" && Array.isArray(data.results) ? data.results : [],
        resultKind: data.resultKind || null,
      }]);
      if (data.action === "SELECT_SHOW" && data.selectedShow) {
        const selection = data.selectedShow;
        window.setTimeout(() => {
          if (requestId.current === currentRequest) openShow(selection);
        }, 450);
      }
    } catch (error) {
      if (requestId.current !== currentRequest) return;
      console.error("AI assistant:", error);
      const errorMessage = error.response?.data?.message || "Couldn't reach the assistant. Please try again.";
      setMessages((history) => [...history, {
        id: createId("error"), role: "assistant", text: errorMessage,
        results: [], resultKind: null,
      }]);
      toast.error(errorMessage);
    } finally {
      if (requestId.current === currentRequest) setBusy(false);
    }
  }

  function startNewChat() {
    requestId.current += 1;
    setBusy(false);
    setInput("");
    setIntent({});
    setCurrentResults([]);
    setCurrentResultKind(null);
    setMessages(initialMessages(cinema.name));
    try {
      sessionStorage.removeItem(chatKey);
    } catch {
      // Local chat still resets.
    }
    inputRef.current?.focus();
  }

  function submit(event) {
    event.preventDefault();
    void sendText(input);
  }

  const entering = reduceMotion ? {} : {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.65, ease: EASE },
  };

  return (
    <PageShell glow="left">
      <main className="relative mx-auto max-w-[1480px] px-5 pb-20 pt-10 text-white md:px-10 md:pt-14">
        {/* Editorial introduction, shared with the Cinemas page's typography. */}
        <motion.header
          {...entering}
          className="mb-8 flex flex-col justify-between gap-6 border-b border-white/10 pb-7 lg:mb-10 lg:flex-row lg:items-end"
        >
          <div className="min-w-0">
            <Eyebrow suffix="06">The film concierge</Eyebrow>
            <h1 className="cine-display mt-5 text-[clamp(2.8rem,5.4vw,5.4rem)]">
              Less searching.<br className="hidden sm:block" />
              <span className="text-[#ff4562]"> More cinema.</span>
            </h1>
          </div>
          <div className="max-w-[370px] lg:pb-1">
            <p className="text-sm leading-relaxed text-zinc-400 md:text-base">
              Tell us what you feel like watching. Find real films, showtimes and seats at your cinema.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D71935]" />
              {selectedId ? `Exploring ${cinema.name || "your cinema"}` : "Choose your cinema to begin"}
            </div>
          </div>
        </motion.header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.65fr)] lg:gap-9">
          <motion.aside
            {...entering}
            transition={reduceMotion ? undefined : { duration: 0.65, delay: 0.08, ease: EASE }}
            className="space-y-5 lg:sticky lg:top-[85px]"
          >
            <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0e0e11]/85" aria-label="Cinema selection">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-6">
                <span className="text-[10px] font-semibold uppercase tracking-[0.23em] text-[#ff526e]">01 / Your cinema</span>
                <MapPin size={15} strokeWidth={1.5} className="text-zinc-500" />
              </div>
              <div className="p-5 sm:p-6">
                {selectedId ? (
                  <>
                    <p className="text-[10px] uppercase tracking-[0.17em] text-zinc-500">Selected destination</p>
                    <h2 className="cine-head mt-3 break-words text-[clamp(1.45rem,2vw,1.85rem)] leading-tight text-white">
                      {cinema.name || "Your cinema"}
                    </h2>
                    <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                      <MapPin size={14} className="text-[#ff526e]" />
                      {cinema.city || "Location not specified"}
                    </p>
                    <button
                      type="button"
                      onClick={changeCinema}
                      className="group mt-7 flex w-full items-center justify-between rounded-full border border-white/20 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-white transition-all duration-300 hover:border-[#D71935]/65 hover:bg-[#D71935]/10"
                    >
                      Change cinema
                      <ArrowUpRight size={16} className="text-[#ff637b] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="cine-head text-[26px] leading-tight text-white">Where to watch?</h2>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">Choose a destination to see what is actually playing.</p>
                    <div className="cine-scroll mt-5 max-h-[290px] space-y-1.5 overflow-y-auto">
                      {cinemasLoading && <p role="status" className="py-4 text-xs text-zinc-400">Loading cinemas…</p>}
                      {!cinemasLoading && cinemasError && (
                        <p role="alert" className="py-4 text-xs text-amber-200">Cinema list unavailable. Please try again later.</p>
                      )}
                      {!cinemasLoading && !cinemasError && availableCinemas.length === 0 && (
                        <p className="py-4 text-xs text-zinc-400">No cinemas are available right now.</p>
                      )}
                      {availableCinemas.map((venue, index) => (
                        <button
                          key={venue._id}
                          type="button"
                          onClick={() => selectCinema(venue)}
                          className="group flex w-full items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-left transition-all duration-300 hover:border-[#D71935]/45 hover:bg-white/[0.075]"
                        >
                          <span className="w-5 shrink-0 text-[10px] tabular-nums text-[#ff526e]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="cine-head block truncate text-[13px] text-zinc-200 group-hover:text-white">{venue.name}</span>
                            <span className="mt-0.5 block text-[11px] text-zinc-500">{venue.city || "Cinema"}</span>
                          </span>
                          <ChevronRight size={15} className="shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-[#ff526e]" />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/cinemas")}
                      className="group mt-5 inline-flex items-center gap-2 text-xs text-zinc-400 transition-colors hover:text-white"
                    >
                      Explore the cinema directory
                      <ArrowUpRight size={14} className="text-[#ff526e] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0e0e11]/85" aria-label="Suggested searches">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-6">
                <span className="text-[10px] font-semibold uppercase tracking-[0.23em] text-[#ff526e]">02 / Discover</span>
                <span className="text-[10px] text-zinc-500">Quick questions</span>
              </div>
              <div className="divide-y divide-white/[0.08] px-5 sm:px-6">
                {QUICK_PROMPTS.map(({ title, detail, prompt }, index) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendText(prompt)}
                    disabled={!selectedId || busy}
                    className="group flex w-full items-center gap-3 py-4 text-left transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <span className="w-5 shrink-0 text-[10px] tabular-nums text-[#ff526e]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="cine-head block text-sm text-zinc-200 transition-colors group-hover:text-white">{title}</span>
                      <span className="mt-1 block text-[11px] text-zinc-500">{detail}</span>
                    </span>
                    <ArrowUpRight size={16} className="shrink-0 text-zinc-600 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#ff526e]" />
                  </button>
                ))}
              </div>
            </section>
            <p className="px-1 text-[11px] leading-relaxed text-zinc-500">
              Recommendations use available films and showtimes at your chosen cinema.
            </p>
          </motion.aside>

          <motion.section
            {...entering}
            transition={reduceMotion ? undefined : { duration: 0.7, delay: 0.16, ease: EASE }}
            aria-label="BookMySeat assistant conversation"
            className="relative flex h-[680px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#0e0e11]/95 shadow-[0_30px_80px_rgba(0,0,0,0.24)] sm:h-[745px]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-[260px]"
              style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(215,25,53,.14), transparent 65%)" }}
            />
            <div className="relative flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D71935]/50 bg-[#D71935]/15">
                  <Clapperboard size={18} strokeWidth={1.6} className="text-[#ff526e]" />
                </span>
                <div className="min-w-0">
                  <h2 className="cine-head truncate text-lg text-white">Film concierge</h2>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                    {selectedId ? `For ${cinema.name || "your cinema"}` : "Your personal film guide"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={startNewChat}
                className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/[0.035] px-3.5 py-2.5 text-[11px] font-semibold text-zinc-200 transition-all duration-300 hover:border-[#D71935]/55 hover:bg-[#D71935]/10 hover:text-white sm:px-4"
              >
                <Plus size={15} className="text-[#ff526e] transition-transform group-hover:rotate-90" />
                New chat
              </button>
            </div>

            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="cine-scroll relative min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-7 sm:px-9 sm:py-9"
            >
              {!hasConversation ? (
                <div className="flex min-h-full flex-col justify-center pb-7">
                  <Eyebrow>Curated for your evening</Eyebrow>
                  <h2 className="cine-display mt-6 text-[clamp(2.5rem,5vw,4.65rem)]">
                    A good film.<br />
                    <span className="text-[#ff4562]">A great night.</span>
                  </h2>
                  <p className="mt-5 max-w-[480px] text-sm leading-[1.8] text-zinc-400">
                    {selectedId
                      ? `Tell me what you're in the mood for. I'll help you find a screening at ${cinema.name || "your cinema"}.`
                      : "Choose a cinema, then tell me what you're in the mood for. We'll find a film worth your evening."}
                  </p>
                  <div className="mt-9 border-t border-white/10 pt-5">
                    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Start with an idea</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { label: "What's playing tonight?", prompt: "What's playing tonight?" },
                        { label: "I want something funny", prompt: "Suggest a comedy" },
                        { label: "Find tickets under ₹300", prompt: "Anything under ₹300" },
                        { label: "Help me plan tomorrow", prompt: "Hindi movies tomorrow" },
                      ].map(({ label, prompt }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => void sendText(prompt)}
                          disabled={!selectedId || busy}
                          className="group flex min-h-[56px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left text-xs font-medium text-zinc-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D71935]/50 hover:bg-[#D71935]/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
                        >
                          <span>{label}</span>
                          <ArrowUpRight size={15} className="shrink-0 text-zinc-500 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#ff526e]" />
                        </button>
                      ))}
                    </div>
                  </div>
                  {!selectedId && <p className="mt-5 text-xs text-[#ff778b]">Choose a cinema from the panel to start chatting.</p>}
                </div>
              ) : (
                messages.map((message, index) => (
                  <ConversationMessage
                    key={message.id || index}
                    message={message}
                    onSelect={openShow}
                    reduceMotion={reduceMotion}
                  />
                ))
              )}
              {busy && (
                <div role="status" aria-label="Assistant is responding" className="flex items-center gap-3 border-l-2 border-[#D71935] py-1 pl-4">
                  <span className="text-xs text-zinc-400">Finding your next screening</span>
                  <span className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2].map((index) => (
                      <motion.span
                        key={index}
                        className="h-1 w-1 rounded-full bg-[#ff526e]"
                        animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.15 }}
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>

            <div className="relative shrink-0 border-t border-white/10 bg-[#131316] px-4 pb-4 pt-4 sm:px-7 sm:pb-5">
              <form
                onSubmit={submit}
                className="flex items-center gap-2 rounded-xl border border-white/[0.16] bg-[#1e1e23] p-1.5 pl-4 transition-all duration-300 focus-within:border-[#D71935]/75 focus-within:bg-[#242028]"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={!selectedId || busy}
                  maxLength={300}
                  autoComplete="off"
                  aria-label="Ask the cinema concierge"
                  placeholder={
                    !selectedId ? "Choose a cinema first…"
                      : currentResults.length ? "Ask a follow-up or refine your results…"
                        : "Ask about films, showtimes or ticket prices…"
                  }
                  className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-[13px] text-white outline-none placeholder:text-zinc-500 focus:outline-none focus:ring-0 disabled:cursor-not-allowed sm:text-sm"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={!selectedId || busy || !input.trim()}
                  className="group flex h-10 w-11 shrink-0 items-center justify-center rounded-lg bg-[#D71935] text-white transition-all duration-300 hover:bg-[#ed2a49] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Send size={17} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              </form>
              <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-zinc-500">
                <span>Real films. Real showtimes. Your cinema.</span>
                <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  Enter to send <ArrowRight size={12} />
                </span>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    </PageShell>
  );
}
