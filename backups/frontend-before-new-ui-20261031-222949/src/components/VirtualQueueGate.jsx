
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import axios from "axios";

import {
  ArrowLeft,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";

import {
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

// =====================================================
// CONFIG
// =====================================================

const API_URL = (
  process.env.REACT_APP_BACKEND_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

const QUEUE_API = `${API_URL}/api/queue/shows`;

const ADMISSION_PREFIX =
  "bms:queue:admission:";

function admissionKey(showId) {
  return `${ADMISSION_PREFIX}${showId}`;
}

function removeAdmission(showId) {
  if (!showId) return;

  sessionStorage.removeItem(
    admissionKey(showId)
  );
}

function saveAdmission(showId, data) {
  sessionStorage.setItem(
    admissionKey(showId),
    JSON.stringify({
      token: data.admissionToken,
      expiresAt: data.admittedUntil,
    })
  );
}

function readAdmission(showId) {
  if (!showId) return null;

  try {
    const saved = JSON.parse(
      sessionStorage.getItem(
        admissionKey(showId)
      ) || "null"
    );

    if (
      !saved?.token ||
      !saved?.expiresAt ||
      Date.parse(saved.expiresAt) <=
        Date.now()
    ) {
      return null;
    }

    return saved.token;
  } catch {
    return null;
  }
}

// =====================================================
// ATTACH TOKEN TO SEAT HOLDS ONLY
// =====================================================
//
// This interceptor is registered once when the
// module is imported by App.js.
//
// The token is never attached to arbitrary API
// requests, checkout requests or external URLs.
//
// The backend still verifies ownership and expiry.

axios.interceptors.request.use((config) => {
  const method = String(
    config.method || "get"
  ).toLowerCase();

  const url = String(
    config.url || ""
  );

  const seatHoldRequest =
    method === "post" &&
    /\/api\/seat-locks\/hold(?:\?.*)?$/.test(
      url
    );

  if (!seatHoldRequest) {
    return config;
  }

  let body = config.data;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }

  const showId =
    typeof body?.showId === "string"
      ? body.showId
      : "";

  const admissionToken =
    readAdmission(showId);

  if (admissionToken) {
    if (
      typeof config.headers?.set === "function"
    ) {
      config.headers.set(
        "X-Queue-Admission",
        admissionToken
      );
    } else {
      config.headers = {
        ...config.headers,
        "X-Queue-Admission":
          admissionToken,
      };
    }
  }

  return config;
});

// =====================================================
// ADMISSION ERROR RECOVERY
// =====================================================

axios.interceptors.response.use(
  (response) => response,

  (error) => {
    if (
      error.response?.data?.code ===
      "QUEUE_ADMISSION_REQUIRED"
    ) {
      const request = error.config || {};

      let body = request.data;

      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = null;
        }
      }

      const showId = body?.showId;

      if (typeof showId === "string") {
        removeAdmission(showId);

        window.dispatchEvent(
          new CustomEvent(
            "bms:queue-admission-required",
            {
              detail: {
                showId,
              },
            }
          )
        );
      }
    }

    return Promise.reject(error);
  }
);

// =====================================================
// HELPERS
// =====================================================

function formatDuration(seconds) {
  const value = Math.max(
    0,
    Math.ceil(Number(seconds) || 0)
  );

  if (value < 60) {
    return `${value} sec`;
  }

  const minutes = Math.ceil(value / 60);

  return `${minutes} min`;
}

function getMessage(error) {
  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    "The waiting room is temporarily unavailable."
  );
}

// =====================================================
// WAITING ROOM
// =====================================================

export default function VirtualQueueGate({
  children,
}) {
  const { id: movieId } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();

  const {
    token,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const reducedMotion =
    useReducedMotion();

  // Must match the show selection used by Booking.jsx.

  const queryShowId =
    new URLSearchParams(search).get("show");

  const showId =
    queryShowId ||
    localStorage.getItem("bookmyseat_show");

  const [mode, setMode] =
    useState("checking");

  const [status, setStatus] =
    useState({});

  const [message, setMessage] =
    useState("");

  const [retryCount, setRetryCount] =
    useState(0);

  const [clock, setClock] =
    useState(Date.now());

  const inFlight = useRef(false);

  // =====================================================
  // JOIN / REFRESH STATUS
  // =====================================================

  const checkStatus = useCallback(
    async (signal) => {
      if (
        !showId ||
        !token ||
        inFlight.current
      ) {
        return;
      }

      inFlight.current = true;

      try {
        const { data } = await axios.post(
          `${QUEUE_API}/${showId}/status`,
          {},
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            signal,
            timeout: 15000,
          }
        );

        if (signal?.aborted) return;

        if (
          !data?.success
        ) {
          throw new Error(
            "Queue status was not confirmed."
          );
        }

        if (
          !data.enabled ||
          data.state === "OFF"
        ) {
          removeAdmission(showId);
          setStatus({});
          setMode("open");
          setMessage("");
          return;
        }

        if (
          data.state === "ADMITTED" &&
          data.admissionToken &&
          data.admittedUntil
        ) {
          saveAdmission(
            showId,
            data
          );

          setStatus(data);
          setMode("admitted");
          setMessage("");
          return;
        }

        removeAdmission(showId);

        setStatus(data);
        setMode("waiting");
        setMessage("");
      } catch (error) {
        if (
          signal?.aborted ||
          axios.isCancel(error)
        ) {
          return;
        }

        // Fail closed. Never show the seat map while
        // queue admission is unverified.

        setMessage(
          getMessage(error)
        );

        setMode("error");
      } finally {
        inFlight.current = false;
      }
    },
    [showId, token]
  );

  // =====================================================
  // INITIAL CONFIGURATION
  // =====================================================

  useEffect(() => {
    if (authLoading) {
      return undefined;
    }

    if (
      !isAuthenticated ||
      !token ||
      !showId
    ) {
      setMode("open");
      return undefined;
    }

    const controller =
      new AbortController();

    setMode("checking");
    setStatus({});
    setMessage("");

    async function initialize() {
      try {
        const { data } = await axios.get(
          `${QUEUE_API}/${showId}`,
          {
            signal: controller.signal,
            timeout: 15000,
          }
        );

        if (
          controller.signal.aborted
        ) {
          return;
        }

        if (
          !data?.success
        ) {
          throw new Error(
            "Queue configuration was not confirmed."
          );
        }

        if (!data.enabled) {
          removeAdmission(showId);
          setMode("open");
          return;
        }

        await checkStatus(
          controller.signal
        );
      } catch (error) {
        if (
          controller.signal.aborted ||
          axios.isCancel(error)
        ) {
          return;
        }

        setMessage(
          getMessage(error)
        );

        setMode("error");
      }
    }

    initialize();

    return () => {
      controller.abort();
    };
  }, [
    showId,
    token,
    authLoading,
    isAuthenticated,
    retryCount,
    checkStatus,
  ]);

  // =====================================================
  // PERIODIC QUEUE UPDATES
  // =====================================================

  useEffect(() => {
    if (
      mode !== "waiting" &&
      mode !== "admitted"
    ) {
      return undefined;
    }

    const delay =
      mode === "waiting"
        ? 5000
        : 15000;

    const controller =
      new AbortController();

    const interval = setInterval(() => {
      void checkStatus(
        controller.signal
      );
    }, delay);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [
    mode,
    checkStatus,
  ]);

  // =====================================================
  // HANDLE REVOKED / EXPIRED ADMISSION
  // =====================================================

  useEffect(() => {
    if (!showId) {
      return undefined;
    }

    const onAdmissionRequired = (
      event
    ) => {
      if (
        String(event.detail?.showId) !==
        String(showId)
      ) {
        return;
      }

      setMode("checking");

      setRetryCount(
        (current) => current + 1
      );
    };

    window.addEventListener(
      "bms:queue-admission-required",
      onAdmissionRequired
    );

    return () =>
      window.removeEventListener(
        "bms:queue-admission-required",
        onAdmissionRequired
      );
  }, [showId]);

  // =====================================================
  // COUNTDOWN
  // =====================================================

  useEffect(() => {
    if (mode !== "admitted") {
      return undefined;
    }

    const interval = setInterval(() => {
      setClock(Date.now());
    }, 1000);

    return () =>
      clearInterval(interval);
  }, [mode]);

  const admissionSecondsLeft =
    status.admittedUntil
      ? Math.max(
          0,
          Math.ceil(
            (
              Date.parse(
                status.admittedUntil
              ) - clock
            ) / 1000
          )
        )
      : 0;

  useEffect(() => {
    if (
      mode === "admitted" &&
      status.admittedUntil &&
      admissionSecondsLeft === 0
    ) {
      removeAdmission(showId);

      setMode("checking");

      setRetryCount(
        (current) => current + 1
      );
    }
  }, [
    mode,
    status.admittedUntil,
    admissionSecondsLeft,
    showId,
  ]);

  // =====================================================
  // LEAVE WAITING ROOM
  // =====================================================

  const leaveQueue = async () => {
    if (
      showId &&
      token
    ) {
      try {
        await axios.post(
          `${QUEUE_API}/${showId}/leave`,
          {},
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            timeout: 10000,
          }
        );
      } catch (error) {
        // Navigation does not require Redis to respond.
        console.error(
          "Leave waiting room:",
          error
        );
      }
    }

    removeAdmission(showId);

    navigate(
      movieId
        ? `/movie/${movieId}`
        : "/cinemas",
      {
        replace: true,
      }
    );
  };

  // =====================================================
  // REGULAR SHOW / VERIFIED ADMISSION
  // =====================================================

  if (
    !authLoading &&
    (
      !isAuthenticated ||
      !showId ||
      mode === "open" ||
      mode === "admitted"
    )
  ) {
    return children;
  }

  // =====================================================
  // WAITING ROOM UI
  // =====================================================

  const waiting =
    mode === "waiting";

  const position =
    Number(status.position || 0);

  const peopleAhead =
    Number(
      status.peopleAhead || 0
    );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-5 pb-16 pt-28 text-white">
      <motion.section
        initial={
          reducedMotion
            ? false
            : {
                opacity: 0,
                y: 22,
              }
        }
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.5,
        }}
        className="w-full max-w-[660px]"
      >
        {/* HEADER */}

        <div className="flex items-center gap-3">
          <span className="h-px w-9 bg-[#D71935]" />

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f07990]">
            BookMySeat / High-demand screenings
          </p>
        </div>

        <div className="mt-7 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D71935]/30 bg-[#D71935]/10">
            <Ticket
              size={25}
              className="text-[#ef5e79]"
            />
          </span>

          <div>
            <h1 className="text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-tight tracking-[-0.06em]">
              {waiting
                ? "You're in line."
                : mode === "error"
                  ? "Waiting room unavailable."
                  : "Preparing your entry."}
            </h1>
          </div>
        </div>

        <p className="mt-5 max-w-xl text-sm leading-7 text-white/55">
          {waiting
            ? "This screening is experiencing high demand. Your place in line is reserved while this page stays connected."
            : mode === "error"
              ? "We couldn't verify access to this screening. Your seat selection will remain protected until the waiting room is available."
              : "Checking availability and securing your place in the booking queue."}
        </p>

        {/* STATUS PANEL */}

        <div className="mt-9 overflow-hidden rounded-[26px] border border-white/10 bg-[#141417]">
          {waiting ? (
            <>
              <div className="border-b border-white/10 p-7 sm:p-9">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Your queue position
                </p>

                <p className="mt-5 text-[clamp(4.5rem,12vw,7rem)] font-semibold leading-none tracking-[-0.08em] text-white tabular-nums">
                  {position || "—"}
                </p>

                <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-[#D71935]"
                    animate={
                      reducedMotion
                        ? undefined
                        : {
                            x: [
                              "-100%",
                              "300%",
                            ],
                          }
                    }
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-6 p-7 sm:grid-cols-2 sm:p-9">
                <div>
                  <p className="flex items-center gap-2 text-xs text-white/40">
                    <Users size={15} />
                    People ahead
                  </p>

                  <p className="mt-3 text-2xl font-semibold tabular-nums">
                    {peopleAhead}
                  </p>
                </div>

                <div>
                  <p className="flex items-center gap-2 text-xs text-white/40">
                    <Clock3 size={15} />
                    Estimated wait
                  </p>

                  <p className="mt-3 text-2xl font-semibold">
                    {formatDuration(
                      status.estimatedWaitSeconds
                    )}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-5 px-7 py-14 text-center">
              {mode === "error" ? (
                <RefreshCw
                  size={30}
                  className="text-[#f0788b]"
                />
              ) : (
                <Loader2
                  size={30}
                  className="animate-spin text-[#D71935]"
                />
              )}

              <p className="max-w-sm text-sm leading-6 text-white/55">
                {mode === "error"
                  ? message
                  : "Verifying your place in the waiting room."}
              </p>

              {mode === "error" && (
                <button
                  type="button"
                  onClick={() =>
                    setRetryCount(
                      (current) => current + 1
                    )
                  }
                  className="rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold transition hover:bg-[#eb2947]"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={18}
              className="mt-0.5 shrink-0 text-white/50"
            />

            <p className="max-w-sm text-xs leading-6 text-white/45">
              Your position is linked to your account.
              The page checks for admission automatically.
              Waiting does not reserve specific seats.
            </p>
          </div>

          <button
            type="button"
            onClick={leaveQueue}
            className="inline-flex items-center gap-2 text-xs font-semibold text-white/60 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Leave waiting room
          </button>
        </div>
      </motion.section>
    </main>
  );
}
