
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  ChevronRight,
  Film,
  MapPin,
  Plus,
  Send,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

// BookMySeat — cinema-specific film assistant.
// Existing API, chat persistence, multi-turn intent and booking navigation retained.
const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const CHAT_KEY_PREFIX = "bookmyseat_ai_chat";
const ZONE = "Asia/Kolkata";
const EASE = [0.22, 1, 0.36, 1];

const QUICK_PROMPTS = [
  { title: "What's playing?", detail: "Browse current screenings", prompt: "Show me movies" },
  { title: "Find a comedy", detail: "Something light to watch", prompt: "Suggest a comedy" },
  { title: "Plan for tomorrow", detail: "Explore another day", prompt: "Hindi movies tomorrow" },
  { title: "Stay within budget", detail: "Find tickets under ₹300", prompt: "Anything under ₹300" },
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
    hour: "numeric",
    minute: "2-digit",
    timeZone: ZONE,
  }).format(date);
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
  return [
    {
      id: "assistant-welcome",
      role: "assistant",
      text: name
        ? `I'm here to help you find something worth watching at ${name}. Tell me what you're in the mood for, or ask to see what's playing.`
        : "Select a cinema to see real films and showtimes. I'll help you find the right one.",
      results: [],
      resultKind: null,
    },
  ];
}

function FilmPoster({ show }) {
  const [broken, setBroken] = useState(false);
  const poster = show.movie?.poster;

  useEffect(() => setBroken(false), [poster]);

  return (
    <div className="relative aspect-[2/3] overflow-hidden bg-[#1c1b20]">
      {poster && !broken ? (
        <img
          src={poster}
          alt={`${show.movie?.title || "Film"} poster`}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 border-b border-white/10 px-3 text-center">
          <Film size={22} strokeWidth={1.25} className="text-white/30" />
          <span className="text-[12px] leading-5 text-white/50">
            {show.movie?.title || "Artwork unavailable"}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
    </div>
  );
}

function ResultCards({ results, kind, onSelect }) {
  if (!Array.isArray(results) || results.length === 0) return null;

  return (
    <section className="mt-6 border-t border-white/10 pt-5" aria-label="Film results">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ed6980]">
          {kind === "MOVIES" ? "Films found" : "Matching showtimes"}
        </p>
        <span className="text-[11px] text-[#86828a] tabular-nums">
          {String(results.length).padStart(2, "0")} results
        </span>
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto pb-3 [scrollbar-color:#444047_transparent] [scrollbar-width:thin]">
        {results.map((show, index) => (
          <button
            key={`${show.showId || "show"}-${index}`}
            type="button"
            onClick={() => onSelect(show)}
            className="group w-[156px] shrink-0 snap-start overflow-hidden rounded-[13px] border border-white/[0.09] bg-[#17171b] text-left transition-[border-color,transform,background] duration-300 hover:-translate-y-1 hover:border-[#c9455f]/55 hover:bg-[#1d1c21] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71935] sm:w-[174px]"
          >
            <FilmPoster show={show} />
            <span className="block px-3 pb-3 pt-3">
              <span className="block truncate text-[12px] font-semibold tracking-[-0.015em] text-white">
                {show.movie?.title || "Film"}
              </span>
              <span className="mt-2 block truncate text-[11px] leading-5 text-white/50">
                {formatDate(show.startTime)}
              </span>
              <span className="block truncate text-[11px] leading-5 text-white/50">
                {formatTime(show.startTime)}
                {show.minPrice != null ? ` · ₹${show.minPrice}+` : ""}
              </span>
              <span className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-[10px] font-semibold text-[#f18a9a]">
                <span>{kind === "MOVIES" && Number(show.showCount) > 1 ? `${show.showCount} shows` : "View booking"}</span>
                <ArrowUpRight size={13} />
              </span>
            </span>
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
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      className={`flex min-w-0 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`min-w-0 ${isUser ? "max-w-[88%] sm:max-w-[77%]" : "w-full max-w-[680px]"}`}>
        <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${isUser ? "text-right text-white/35" : "text-[#e37589]"}`}>
          {isUser ? "You" : "Concierge"}
        </p>
        {isUser ? (
          <div className="whitespace-pre-wrap break-words rounded-[14px] rounded-tr-[3px] border border-[#813444]/35 bg-[#29191e] px-4 py-3.5 text-[13px] leading-6 text-[#f5e9ec]">
            {message.text}
          </div>
        ) : (
          <div className="border-l-2 border-[#d71935] py-0.5 pl-4">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.85] text-[#e2dee1]">
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

  // Keep discovery, context and booking endpoints identical to the existing page.
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

  // Conversations are isolated per cinema and persist for this browser tab.
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
      setCurrentResults(
        Array.isArray(restored.currentResults)
          ? restored.currentResults
          : Array.isArray(restored.results) ? restored.results : []
      );
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
      // The assistant remains usable without storage.
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
      // Local state is sufficient.
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
      // Local state is sufficient.
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
        id: createId("error"), role: "assistant", text: errorMessage, results: [], resultKind: null,
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
      // Chat still resets in local state.
    }
    inputRef.current?.focus();
  }

  function submit(event) {
    event.preventDefault();
    void sendText(input);
  }

  const entering = reduceMotion ? {} : {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: EASE },
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#09090b] px-4 pb-14 pt-[105px] text-[#f5f2f1] sm:px-7 lg:pt-[112px]">
      <div className="mx-auto max-w-[1390px]">
        {/* Hero: matching BookMySeat's admin editorial typography and spacing. */}
        <motion.header
          {...entering}
          className="mb-8 flex flex-col justify-between gap-6 border-b border-white/[0.10] pb-7 md:flex-row md:items-end lg:mb-9"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.23em] text-[#e66a80]">
              <span className="h-px w-8 bg-[#d71935]" /> Discover / 01
            </p>
            <h1 className="mt-4 text-[clamp(2.45rem,3.85vw,4rem)] font-bold leading-[1.01] tracking-[-0.068em] text-[#f7f5f3]">
              The cinema <span className="text-[#db3654]">concierge.</span>
            </h1>
            <p className="mt-4 max-w-[640px] text-[13px] leading-[1.7] text-[#a6a2a9] sm:text-[14px]">
              Less searching, more watching. Find a film, a showtime, and the right seat at your cinema.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 self-start border-l border-white/[0.13] pl-4 md:self-end">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#d71935]" aria-hidden="true" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9d96a0]">Currently browsing</p>
              <p className="mt-1 max-w-[230px] truncate text-[12px] font-semibold text-white/85">
                {selectedId ? cinema.name || "Selected cinema" : "Choose a cinema to begin"}
              </p>
            </div>
          </div>
        </motion.header>

        <div className="grid items-start gap-5 lg:grid-cols-[302px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
          {/* Cinema context stays separate from the conversation. */}
          <motion.aside {...entering} className="space-y-4 lg:sticky lg:top-[84px]">
            <section className="overflow-hidden rounded-[18px] border border-white/[0.095] bg-[#131216]" aria-label="Cinema selection">
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.085] px-5 py-4 sm:px-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ec7083]">01 / Your cinema</span>
                <span className="text-[10px] text-white/35">Location</span>
              </div>
              <div className="px-5 pb-6 pt-6 sm:px-6">
                {selectedId ? (
                  <>
                    <p className="text-[11px] text-white/45">Selected venue</p>
                    <h2 className="mt-2 break-words text-[clamp(1.4rem,2vw,1.75rem)] font-bold leading-[1.16] tracking-[-0.045em] text-white">
                      {cinema.name || "Your cinema"}
                    </h2>
                    <p className="mt-3 flex items-center gap-2 text-[12px] text-white/55">
                      <MapPin size={14} strokeWidth={1.6} className="text-[#db536c]" />
                      {cinema.city || "Location not specified"}
                    </p>
                    <div className="mt-6 h-px bg-white/[0.08]" />
                    <button
                      type="button"
                      onClick={changeCinema}
                      className="group mt-4 flex w-full items-center justify-between rounded-lg border border-white/[0.12] bg-[#1e1d22] px-4 py-3 text-[12px] font-semibold text-white/85 transition-[border-color,background] hover:border-white/30 hover:bg-[#28262d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71935]"
                    >
                      Change cinema <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-[23px] font-bold leading-tight tracking-[-0.045em] text-white">Where are we watching?</h2>
                    <p className="mt-2 text-[12px] leading-6 text-white/50">Choose a venue to see its actual films and showtimes.</p>
                    <div className="mt-5 max-h-[300px] space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                      {cinemasLoading && <p role="status" className="py-4 text-[12px] text-white/50">Loading cinemas…</p>}
                      {!cinemasLoading && cinemasError && (
                        <p role="alert" className="py-4 text-[12px] text-amber-200/85">Cinema list unavailable. Please try again later.</p>
                      )}
                      {!cinemasLoading && !cinemasError && availableCinemas.length === 0 && (
                        <p className="py-4 text-[12px] text-white/50">No cinemas are available right now.</p>
                      )}
                      {availableCinemas.map((venue) => (
                        <button
                          key={venue._id}
                          type="button"
                          onClick={() => selectCinema(venue)}
                          className="group flex w-full items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 text-left transition-colors hover:border-[#d71935]/45 hover:bg-[#d71935]/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d71935]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-semibold text-white/85">{venue.name}</span>
                            <span className="mt-1 block text-[11px] text-white/40">{venue.city || "Cinema"}</span>
                          </span>
                          <ChevronRight size={15} className="shrink-0 text-white/40 transition-colors group-hover:text-[#ee7c8e]" />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/cinemas")}
                      className="mt-5 inline-flex items-center gap-2 text-[12px] text-white/60 transition-colors hover:text-white"
                    >
                      Browse all cinemas <ArrowUpRight size={14} />
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="rounded-[18px] border border-white/[0.095] bg-[#131216]" aria-label="Suggested searches">
              <div className="flex items-center justify-between border-b border-white/[0.085] px-5 py-4 sm:px-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ec7083]">02 / Explore</span>
                <span className="text-[10px] text-white/35">Suggestions</span>
              </div>
              <div className="divide-y divide-white/[0.075] px-5 sm:px-6">
                {QUICK_PROMPTS.map(({ title, detail, prompt }, index) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendText(prompt)}
                    disabled={!selectedId || busy}
                    className="group flex w-full items-center gap-3.5 py-[17px] text-left transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <span className="w-5 shrink-0 self-center text-[10px] font-semibold tabular-nums text-[#d3566d]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-semibold text-white/85 transition-colors group-hover:text-white">{title}</span>
                      <span className="mt-1 block text-[11px] text-white/40">{detail}</span>
                    </span>
                    <ArrowUpRight size={15} className="shrink-0 text-white/30 transition-[transform,color] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#f08395]" />
                  </button>
                ))}
              </div>
            </section>
            <p className="px-1 text-[11px] leading-[1.7] text-white/35">
              Recommendations are limited to actual films and screenings at your chosen cinema.
            </p>
          </motion.aside>

          {/* Clean editorial conversation, without bot artwork or decorative illustrations. */}
          <motion.section
            {...entering}
            aria-label="BookMySeat assistant conversation"
            className="flex h-[670px] min-w-0 flex-col overflow-hidden rounded-[18px] border border-white/[0.11] bg-[#111014] sm:h-[745px]"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.09] px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#d71935] text-[18px] font-bold tracking-[-0.09em] text-white" aria-hidden="true">B.</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold tracking-[-0.025em] text-white">Film concierge</span>
                  <span className="mt-0.5 block truncate text-[11px] text-white/45">
                    {selectedId ? `For ${cinema.name || "your cinema"}` : "Choose a cinema to start"}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={startNewChat}
                className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.035] px-3.5 py-2.5 text-[11px] font-semibold text-white/75 transition-colors hover:border-white/30 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d71935] sm:px-4"
              >
                <Plus size={14} strokeWidth={1.75} /> New chat
              </button>
            </div>

            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-7 [scrollbar-color:#403841_transparent] [scrollbar-width:thin] sm:px-9 sm:py-9"
            >
              {!hasConversation ? (
                <div className="flex min-h-full flex-col justify-center pb-10">
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.19em] text-[#df7285]">
                    <span className="h-px w-7 bg-[#d71935]" /> Your next screening
                  </div>
                  <h2 className="mt-6 max-w-[590px] text-[clamp(2.25rem,4.1vw,4.4rem)] font-bold leading-[1.04] tracking-[-0.065em] text-white">
                    Good film.<br />Great night<span className="text-[#db3654]">.</span>
                  </h2>
                  <p className="mt-5 max-w-[480px] text-[13px] leading-[1.85] text-[#b0abb3] sm:text-[14px]">
                    Tell me what you're in the mood for. I'll help you find a real screening at {selectedId ? cinema.name || "your cinema" : "a cinema you choose"}.
                  </p>
                  <div className="mt-9 border-t border-white/[0.11] pt-5">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Start a conversation</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { label: "What's playing tonight?", prompt: "What's playing tonight?" },
                        { label: "I want something funny", prompt: "Suggest a comedy" },
                        { label: "Find seats under ₹300", prompt: "Anything under ₹300" },
                        { label: "Help me plan tomorrow", prompt: "Hindi movies tomorrow" },
                      ].map(({ label, prompt }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => void sendText(prompt)}
                          disabled={!selectedId || busy}
                          className="group flex min-h-[50px] items-center justify-between gap-3 rounded-lg border border-white/[0.10] bg-[#1a191e] px-4 py-3 text-left text-[12px] font-medium text-white/75 transition-[background,border-color] hover:border-[#d71935]/45 hover:bg-[#25191f] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <span>{label}</span>
                          <ArrowUpRight size={14} className="shrink-0 text-white/40 transition-colors group-hover:text-[#ef7286]" />
                        </button>
                      ))}
                    </div>
                  </div>
                  {!selectedId && <p className="mt-5 text-[12px] text-[#f18899]">Select a cinema to unlock recommendations.</p>}
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
                <div role="status" aria-label="Assistant is responding" className="flex items-center gap-3 border-l-2 border-[#d71935] py-1 pl-4">
                  <span className="text-[12px] text-white/65">Looking through the programme</span>
                  <span className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2].map((index) => (
                      <motion.span
                        key={index}
                        className="h-1 w-1 rounded-full bg-[#e96a81]"
                        animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.15 }}
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/[0.10] bg-[#161419] px-4 pb-4 pt-4 sm:px-7 sm:pb-5">
              <form
                onSubmit={submit}
                className="flex items-center gap-2 rounded-[12px] border border-white/[0.15] bg-[#211f25] p-1.5 pl-4 transition-[border-color,background] focus-within:border-[#cf5570] focus-within:bg-[#28222b]"
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
                        : "Ask about films, timings or ticket prices…"
                  }
                  className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-[13px] text-white outline-none placeholder:text-[#8a818d] focus:border-0 focus:outline-none focus:ring-0 disabled:cursor-not-allowed sm:text-[14px]"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={!selectedId || busy || !input.trim()}
                  className="group flex h-10 w-11 shrink-0 items-center justify-center rounded-[8px] bg-[#d71935] text-white transition-colors hover:bg-[#f02749] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Send size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </form>
              <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-[#827d87]">
                <span>Real cinema schedules. No invented showtimes.</span>
                <span className="hidden shrink-0 sm:inline">Enter to send</span>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
