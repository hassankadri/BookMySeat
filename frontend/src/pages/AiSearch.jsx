import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Bot,
  Building2,
  Clock,
  MapPin,
  Send,
  Ticket,
  User,
} from "lucide-react";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useNavigate,
} from "react-router-dom";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const CHAT_KEY_PREFIX =
  "bookmyseat_ai_chat";

// =====================================================
// HELPERS
// =====================================================

const formatTime = (
  value
) =>
  new Intl.DateTimeFormat(
    "en-IN",
    {
      hour: "numeric",
      minute: "2-digit",

      timeZone:
        "Asia/Kolkata",
    }
  ).format(
    new Date(value)
  );

const formatDate = (
  value
) =>
  new Intl.DateTimeFormat(
    "en-IN",
    {
      weekday: "short",
      day: "numeric",
      month: "short",

      timeZone:
        "Asia/Kolkata",
    }
  ).format(
    new Date(value)
  );

const createInitialMessages = (
  theatreName
) => [
  {
    id:
      `welcome-${Date.now()}`,

    role:
      "assistant",

    text:
      theatreName
        ? `Hey! I can help you find something to watch at ${theatreName}. Try “show me movies”, “Hindi tomorrow”, or just tell me what you're in the mood for.`
        : "Choose a cinema first and I'll help you find something to watch.",

    results: [],
    resultKind: null,
  },
];

// =====================================================
// RESULT CARDS
// =====================================================

const ResultCards = ({
  results,
  resultKind,
  onSelect,
}) => {
  if (
    !Array.isArray(results) ||
    results.length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-4 w-full max-w-3xl">

      <div className="mb-3 flex items-center justify-between">

        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
          {resultKind ===
          "MOVIES"
            ? "Movie choices"
            : "Matching shows"}
        </p>

        <span className="text-xs text-zinc-600">
          {results.length}{" "}
          {results.length ===
          1
            ? "result"
            : "results"}
        </span>

      </div>

      <div className="space-y-3">

        {results.map(
          (
            show,
            index
          ) => (
            <button
              type="button"
              key={`${show.showId}-${index}`}
              onClick={() =>
                onSelect(show)
              }
              className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-zinc-900/80 p-4 text-left transition-colors hover:border-red-500/30"
            >

              {/* NUMBER */}

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold">
                {index + 1}
              </div>

              {/* POSTER */}

              {show.movie
                ?.poster ? (
                <img
                  src={
                    show.movie
                      .poster
                  }
                  alt={
                    show.movie
                      .title
                  }
                  className="h-20 w-14 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md bg-black/40 text-[8px] text-zinc-600">
                  No poster
                </div>
              )}

              {/* INFO */}

              <div className="min-w-0 flex-1">

                <h3 className="truncate text-sm font-semibold text-white">
                  {
                    show.movie
                      ?.title
                  }
                </h3>

                {show.movie
                  ?.genre && (
                  <p className="mt-1 truncate text-xs text-zinc-600">
                    {
                      show.movie
                        .genre
                    }
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">

                  <span className="flex items-center gap-1">

                    <Clock className="h-3 w-3" />

                    {formatDate(
                      show.startTime
                    )}

                    {" • "}

                    {formatTime(
                      show.startTime
                    )}

                  </span>

                  <span>
                    {show.language}
                    {" • "}
                    {show.format}
                  </span>

                  <span>
                    From ₹
                    {
                      show.minPrice
                    }
                  </span>

                </div>

                {resultKind ===
                  "MOVIES" &&
                  show.showCount >
                    1 && (
                    <p className="mt-2 text-xs text-zinc-600">
                      {
                        show.showCount
                      }{" "}
                      upcoming showtimes
                    </p>
                  )}

              </div>

              {/* ACTION */}

              <div className="hidden shrink-0 items-center gap-2 text-xs font-semibold text-red-400 sm:flex">

                <Ticket className="h-4 w-4" />

                Select

              </div>

            </button>
          )
        )}

      </div>

    </div>
  );
};

// =====================================================
// PAGE
// =====================================================

const AiSearch = () => {
  const navigate =
    useNavigate();

  // This now points to the actual newest chat turn,
  // not below a separate giant results section.
  const latestMessageRef =
    useRef(null);

  const selectedTheatre =
    localStorage.getItem(
      "bookmyseat_theatre"
    );

  const selectedTheatreName =
    localStorage.getItem(
      "bookmyseat_theatre_name"
    ) ||
    "";

  const selectedCity =
    localStorage.getItem(
      "bookmyseat_city"
    ) ||
    "";

  const chatKey =
    `${CHAT_KEY_PREFIX}:${selectedTheatre || "none"}`;

  // ===================================================
  // STATE
  // ===================================================

  const [
    input,
    setInput,
  ] =
    useState("");

  const [
    messages,
    setMessages,
  ] =
    useState(
      createInitialMessages(
        selectedTheatreName
      )
    );

  // Current intent/results are still stored separately
  // internally because the backend needs them for:
  //
  // "cheaper"
  // "only Hindi"
  // "book the second one"
  //
  // But they are NOT rendered as a separate page section.
  const [
    intent,
    setIntent,
  ] =
    useState({});

  const [
    currentResults,
    setCurrentResults,
  ] =
    useState([]);

  const [
    currentResultKind,
    setCurrentResultKind,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    hydrated,
    setHydrated,
  ] =
    useState(false);

  // ===================================================
  // REQUIRE CINEMA
  // ===================================================

  useEffect(() => {
    if (
      !selectedTheatre
    ) {
      navigate(
        "/cinemas",
        {
          replace:
            true,
        }
      );
    }
  }, [
    selectedTheatre,
    navigate,
  ]);

  // ===================================================
  // RESTORE CHAT
  // ===================================================

  useEffect(() => {
    setHydrated(false);

    try {
      const raw =
        sessionStorage.getItem(
          chatKey
        );

      if (!raw) {
        setMessages(
          createInitialMessages(
            selectedTheatreName
          )
        );

        setIntent({});
        setCurrentResults([]);
        setCurrentResultKind(
          null
        );

        return;
      }

      const saved =
        JSON.parse(raw);

      // -----------------------------------------------
      // Restore existing messages.
      //
      // Older saved chats don't have embedded results,
      // which is fine.
      // -----------------------------------------------

      if (
        Array.isArray(
          saved.messages
        )
      ) {
        setMessages(
          saved.messages.map(
            (
              message,
              index
            ) => ({
              id:
                message.id ||
                `restored-${index}`,

              role:
                message.role,

              text:
                message.text,

              results:
                Array.isArray(
                  message.results
                )
                  ? message.results
                  : [],

              resultKind:
                message.resultKind ||
                null,
            })
          )
        );
      } else {
        setMessages(
          createInitialMessages(
            selectedTheatreName
          )
        );
      }

      setIntent(
        saved.intent &&
        typeof saved.intent ===
          "object"
          ? saved.intent
          : {}
      );

      // Support both the new names and older saved data.
      setCurrentResults(
        Array.isArray(
          saved.currentResults
        )
          ? saved.currentResults
          : Array.isArray(
              saved.results
            )
          ? saved.results
          : []
      );

      setCurrentResultKind(
        saved.currentResultKind ||
          saved.resultKind ||
          null
      );
    } catch {
      sessionStorage.removeItem(
        chatKey
      );

      setMessages(
        createInitialMessages(
          selectedTheatreName
        )
      );

      setIntent({});
      setCurrentResults([]);
      setCurrentResultKind(
        null
      );
    } finally {
      setHydrated(true);
    }
  }, [
    chatKey,
    selectedTheatreName,
  ]);

  // ===================================================
  // SAVE CHAT
  // ===================================================

  useEffect(() => {
    if (
      !hydrated ||
      !selectedTheatre
    ) {
      return;
    }

    sessionStorage.setItem(
      chatKey,

      JSON.stringify({
        messages,
        intent,

        currentResults,
        currentResultKind,
      })
    );
  }, [
    hydrated,
    selectedTheatre,
    chatKey,
    messages,
    intent,
    currentResults,
    currentResultKind,
  ]);

  // ===================================================
  // SCROLL TO NEWEST CHAT TURN
  //
  // Important:
  //
  // We intentionally do NOT scroll every time results
  // change anymore.
  // ===================================================

  useEffect(() => {
    if (
      !latestMessageRef.current
    ) {
      return;
    }

    latestMessageRef.current.scrollIntoView({
      behavior:
        "smooth",

      block:
        "start",
    });
  }, [
    messages.length,
  ]);

  // ===================================================
  // OPEN SHOW
  // ===================================================

  const openShow = (
    show
  ) => {
    if (
      !show?.showId ||
      !show?.movie?.id ||
      !show?.theatre?.id
    ) {
      toast.error(
        "Show information is incomplete."
      );

      return;
    }

    if (
      String(
        show.theatre.id
      ) !==
      String(
        selectedTheatre
      )
    ) {
      toast.error(
        "This show does not belong to your selected cinema."
      );

      return;
    }

    localStorage.setItem(
      "bookmyseat_show",
      show.showId
    );

    localStorage.setItem(
      "bookmyseat_theatre",
      show.theatre.id
    );

    localStorage.setItem(
      "bookmyseat_theatre_name",
      show.theatre.name ||
        ""
    );

    if (
      show.theatre.city
    ) {
      localStorage.setItem(
        "bookmyseat_city",
        show.theatre.city
      );
    }

    navigate(
      `/booking/${show.movie.id}?show=${show.showId}&theatre=${show.theatre.id}`
    );
  };

  // ===================================================
  // SEND
  // ===================================================

  const sendText =
    async (
      rawText
    ) => {
      const message =
        rawText.trim();

      if (
        !message ||
        loading
      ) {
        return;
      }

      if (
        !selectedTheatre
      ) {
        navigate(
          "/cinemas"
        );

        return;
      }

      setInput("");

      // -----------------------------------------------
      // USER MESSAGE
      // -----------------------------------------------

      setMessages(
        (current) => [
          ...current,

          {
            id:
              `user-${Date.now()}`,

            role:
              "user",

            text:
              message,

            results: [],
            resultKind:
              null,
          },
        ]
      );

      setLoading(true);

      try {
        const response =
          await axios.post(
            `${API_URL}/api/ai/assistant`,

            {
              message,

              intent,

              // Backend still receives the latest
              // result set for multi-turn references.
              results:
                currentResults,

              theatreId:
                selectedTheatre,
            }
          );

        const data =
          response.data;

        // -----------------------------------------------
        // UPDATE INTERNAL CONVERSATION STATE
        // -----------------------------------------------

        if (
          data.intent
        ) {
          setIntent(
            data.intent
          );
        }

        if (
          Array.isArray(
            data.results
          )
        ) {
          setCurrentResults(
            data.results
          );
        }

        if (
          data.resultKind
        ) {
          setCurrentResultKind(
            data.resultKind
          );
        }

        // -----------------------------------------------
        // ATTACH RESULTS TO THE AI MESSAGE
        //
        // This is the important UX fix.
        //
        // CHAT:
        // text only
        //
        // SEARCH:
        // text + its own result cards
        // -----------------------------------------------

        const messageResults =
          data.action ===
            "SEARCH" &&
          Array.isArray(
            data.results
          )
            ? data.results
            : [];

        setMessages(
          (current) => [
            ...current,

            {
              id:
                `assistant-${Date.now()}`,

              role:
                "assistant",

              text:
                data.message ||
                "Done.",

              results:
                messageResults,

              resultKind:
                data.resultKind ||
                null,
            },
          ]
        );

        // -----------------------------------------------
        // AI selected an exact real show.
        // -----------------------------------------------

        if (
          data.action ===
            "SELECT_SHOW" &&
          data.selectedShow
        ) {
          setTimeout(
            () => {
              openShow(
                data.selectedShow
              );
            },
            500
          );
        }
      } catch (error) {
        console.error(
          "AI assistant:",
          error
        );

        const errorMessage =
          error.response
            ?.data
            ?.message ||
          "The assistant could not process that request.";

        setMessages(
          (current) => [
            ...current,

            {
              id:
                `error-${Date.now()}`,

              role:
                "assistant",

              text:
                errorMessage,

              results: [],
              resultKind:
                null,
            },
          ]
        );

        toast.error(
          errorMessage
        );
      } finally {
        setLoading(false);
      }
    };

  const sendMessage = (
    event
  ) => {
    event.preventDefault();

    sendText(input);
  };

  // ===================================================
  // RESET
  // ===================================================

  const resetChat =
    () => {
      setMessages(
        createInitialMessages(
          selectedTheatreName
        )
      );

      setIntent({});

      setCurrentResults([]);

      setCurrentResultKind(
        null
      );

      setInput("");

      sessionStorage.removeItem(
        chatKey
      );
    };

  // ===================================================
  // REDIRECT
  // ===================================================

  if (
    !selectedTheatre
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        Opening cinema selection...
      </div>
    );
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="min-h-screen pb-32 pt-24">

      <div className="mx-auto max-w-5xl px-4">

        {/* =============================================
            HEADER
        ============================================== */}

        <div className="border-b border-white/10 pb-6">

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">

            <div>

              <div className="flex items-center gap-3">

                <Bot className="h-6 w-6 text-red-500" />

                <h1 className="text-3xl font-bold">
                  Booking Assistant
                </h1>

              </div>

              <p className="mt-2 text-sm text-zinc-500">
                Ask naturally. Movie suggestions stay attached to the conversation.
              </p>

            </div>

            <button
              type="button"
              onClick={
                resetChat
              }
              className="rounded-lg border border-white/10 px-4 py-2 text-sm"
            >
              New Chat
            </button>

          </div>

          {/* CINEMA */}

          <div className="mt-5 flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-zinc-900/60 p-4 sm:flex-row sm:items-center">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/10">

                <Building2 className="h-5 w-5 text-red-500" />

              </div>

              <div>

                <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                  Searching this cinema
                </p>

                <p className="mt-1 font-semibold">
                  {selectedTheatreName ||
                    "Selected Cinema"}
                </p>

                {selectedCity && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">

                    <MapPin className="h-3 w-3" />

                    {
                      selectedCity
                    }

                  </p>
                )}

              </div>

            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/cinemas"
                )
              }
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400"
            >
              Change Cinema
            </button>

          </div>

        </div>

        {/* =============================================
            QUICK PROMPTS
        ============================================== */}

        {messages.length <=
          1 && (
          <div className="mt-6 flex flex-wrap gap-2">

            {[
              "Show me movies",
              "Suggest a comedy",
              "Hindi movies tomorrow",
              "Anything under ₹300",
            ].map(
              (prompt) => (
                <button
                  type="button"
                  key={
                    prompt
                  }
                  onClick={() =>
                    sendText(
                      prompt
                    )
                  }
                  className="rounded-full border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-zinc-400"
                >
                  {prompt}
                </button>
              )
            )}

          </div>
        )}

        {/* =============================================
            COMPLETE CHAT TIMELINE

            Results are now rendered INSIDE the
            assistant turn that generated them.
        ============================================== */}

        <div className="mt-8 space-y-7">

          {messages.map(
            (
              message,
              index
            ) => {
              const isLatest =
                index ===
                messages.length -
                  1;

              return (
                <div
                  key={
                    message.id ||
                    index
                  }
                  ref={
                    isLatest
                      ? latestMessageRef
                      : null
                  }
                  className={`flex gap-3 ${
                    message.role ===
                    "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >

                  {/* ASSISTANT ICON */}

                  {message.role ===
                    "assistant" && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600/20">

                      <Bot className="h-4 w-4 text-red-400" />

                    </div>
                  )}

                  {/* MESSAGE + ITS RESULTS */}

                  <div
                    className={
                      message.role ===
                      "assistant"
                        ? "min-w-0 flex-1"
                        : ""
                    }
                  >

                    <div
                      className={`w-fit max-w-2xl rounded-xl px-4 py-3 text-sm leading-relaxed ${
                        message.role ===
                        "user"
                          ? "ml-auto bg-red-600 text-white"
                          : "border border-white/10 bg-zinc-900 text-zinc-300"
                      }`}
                    >
                      {
                        message.text
                      }
                    </div>

                    {/* RESULTS BELONG TO THIS MESSAGE */}

                    {message.role ===
                      "assistant" && (
                      <ResultCards
                        results={
                          message.results
                        }
                        resultKind={
                          message.resultKind
                        }
                        onSelect={
                          openShow
                        }
                      />
                    )}

                  </div>

                  {/* USER ICON */}

                  {message.role ===
                    "user" && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800">

                      <User className="h-4 w-4" />

                    </div>
                  )}

                </div>
              );
            }
          )}

          {/* LOADING */}

          {loading && (
            <div
              ref={
                latestMessageRef
              }
              className="flex gap-3"
            >

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600/20">

                <Bot className="h-4 w-4 text-red-400" />

              </div>

              <div className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
                Thinking...
              </div>

            </div>
          )}

        </div>

      </div>

      {/* ===============================================
          INPUT
      ================================================ */}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/95 p-4 backdrop-blur-xl">

        <form
          onSubmit={
            sendMessage
          }
          className="mx-auto flex max-w-4xl gap-3"
        >

          <input
            value={
              input
            }
            onChange={(
              event
            ) =>
              setInput(
                event.target
                  .value
              )
            }
            maxLength={
              300
            }
            placeholder={
              currentResults.length
                ? "Ask about these results or refine your search..."
                : "What do you want to watch?"
            }
            className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-5 py-4 outline-none focus:border-red-500"
          />

          <button
            type="submit"
            disabled={
              loading ||
              !input.trim()
            }
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-red-600 disabled:opacity-40"
          >
            <Send className="h-5 w-5" />
          </button>

        </form>

      </div>

    </div>
  );
};

export default AiSearch;