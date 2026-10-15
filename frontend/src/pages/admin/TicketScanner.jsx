
import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Html5Qrcode } from "html5-qrcode";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  Keyboard,
  Loader2,
  LockKeyhole,
  MapPin,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  ShieldX,
  Ticket,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const SCANNER_ID = "bookmyseat-qr-reader";
const easing = [0.22, 1, 0.36, 1];

const STATES = {
  IDLE: {
    label: "Standing by",
    caption: "Ready when you are",
    accent: "text-[#dbdbe0]",
    light: "bg-white/40",
    icon: QrCode,
  },
  SCANNING: {
    label: "Scanner active",
    caption: "Searching for a ticket",
    accent: "text-[#ff7289]",
    light: "bg-[#D71935]",
    icon: ScanLine,
  },
  VERIFYING: {
    label: "Verifying ticket",
    caption: "Checking the booking record",
    accent: "text-amber-300",
    light: "bg-amber-400",
    icon: Clock3,
  },
  VALID: {
    label: "Entry approved",
    caption: "Ticket valid · check in to admit",
    accent: "text-emerald-300",
    light: "bg-emerald-400",
    icon: CheckCircle2,
  },
  CHECKING_IN: {
    label: "Admitting guest",
    caption: "Securing the check-in",
    accent: "text-amber-300",
    light: "bg-amber-400",
    icon: Loader2,
  },
  CHECKED_IN: {
    label: "Guest admitted",
    caption: "Check-in confirmed",
    accent: "text-emerald-300",
    light: "bg-emerald-400",
    icon: UserCheck,
  },
  ALREADY_USED: {
    label: "Already redeemed",
    caption: "This ticket cannot be used again",
    accent: "text-amber-300",
    light: "bg-amber-400",
    icon: CircleAlert,
  },
  INVALID: {
    label: "Entry denied",
    caption: "Ticket could not be verified",
    accent: "text-red-300",
    light: "bg-red-500",
    icon: ShieldX,
  },
};

function dateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function seatNames(seats) {
  return Array.isArray(seats)
    ? seats
        .map((seat) =>
          typeof seat === "string"
            ? seat
            : seat?.seatId || seat?.number || ""
        )
        .filter(Boolean)
        .join(", ") || "—"
    : "—";
}

function TicketInfo({ icon: Icon, title, value, className = "" }) {
  return (
    <div className={`border-b border-white/[.07] py-4 ${className}`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#85858e]">
        <Icon size={13} className="text-[#f46680]" />
        {title}
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-[#f4f4f5]">
        {value || "—"}
      </p>
    </div>
  );
}

export default function TicketScanner() {
  const { token } = useAuth();
  const reduced = useReducedMotion();

  const cameraRef = useRef(null);
  const cameraStartingRef = useRef(false);
  const lockedRef = useRef(false);
  const checkingInRef = useRef(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const inputRef = useRef(null);

  const [mode, setMode] = useState("camera");
  const [cameraRunning, setCameraRunning] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("IDLE");
  const [message, setMessage] = useState(
    "Camera or manual verification is ready."
  );
  const [ticket, setTicket] = useState(null);
  const [lastQr, setLastQr] = useState("");
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState("");
  const [recent, setRecent] = useState([]);
  const [counts, setCounts] = useState({
    verified: 0,
    admitted: 0,
    declined: 0,
  });

  // =====================================================
  // AUTO-DISMISS REFRESH CONFIRMATION AFTER 5 SECONDS
  // =====================================================

  useEffect(() => {
    if (!refreshFeedback) return undefined;

    const timer = window.setTimeout(() => {
      setRefreshFeedback("");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [refreshFeedback]);

  const current = STATES[status] || STATES.IDLE;
  const StatusIcon = current.icon;

  const busy =
    status === "VERIFYING" ||
    status === "CHECKING_IN" ||
    cameraStarting ||
    refreshing;

  // =====================================================
  // CAMERA LIFECYCLE
  // =====================================================

  const stopCamera = useCallback(async () => {
    const reader = cameraRef.current;
    cameraRef.current = null;

    if (!reader) {
      if (mountedRef.current) setCameraRunning(false);
      return;
    }

    try {
      if (reader.isScanning) await reader.stop();
      await reader.clear();
    } catch (error) {
      console.warn("Ticket camera cleanup:", error);
    } finally {
      if (mountedRef.current) setCameraRunning(false);
    }
  }, []);

  const record = (kind, value) => {
    setRecent((currentRecords) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        kind,
        bookingCode: value?.bookingCode || "",
        time: new Date(),
      },
      ...currentRecords,
    ].slice(0, 5));
  };

  // =====================================================
  // VERIFY TICKET WITH BACKEND
  // =====================================================

  const verify = useCallback(
    async (raw) => {
      const value = String(raw || "").trim();

      if (
        !value ||
        !token ||
        lockedRef.current ||
        checkingInRef.current
      ) {
        return;
      }

      lockedRef.current = true;
      const generation = ++generationRef.current;

      setLastQr(value);
      setStatus("VERIFYING");
      setMessage("Matching the QR signature with the booking record...");
      setTicket(null);

      await stopCamera();

      if (
        !mountedRef.current ||
        generation !== generationRef.current
      ) {
        lockedRef.current = false;
        return;
      }

      try {
        const { data } = await axios.post(
          `${API}/api/tickets/verify`,
          { qrData: value },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (
          !mountedRef.current ||
          generation !== generationRef.current
        ) {
          return;
        }

        if (
          data?.valid === false ||
          !data?.ticket ||
          data?.ticket?.ticketUsed === true ||
          data?.status === "ALREADY_USED"
        ) {
          setTicket(data?.ticket || null);

          const reused =
            data?.status === "ALREADY_USED" ||
            data?.ticket?.ticketUsed === true;

          setStatus(reused ? "ALREADY_USED" : "INVALID");
          setMessage(
            data?.message || "The ticket could not be verified."
          );

          setCounts((currentCounts) => ({
            ...currentCounts,
            declined: currentCounts.declined + 1,
          }));

          record("denied", data?.ticket);
          return;
        }

        setTicket(data.ticket);
        setStatus("VALID");
        setMessage(
          data.message ||
            "This ticket is valid. Confirm admission below."
        );

        setCounts((currentCounts) => ({
          ...currentCounts,
          verified: currentCounts.verified + 1,
        }));

        record("verified", data.ticket);
      } catch (error) {
        if (
          !mountedRef.current ||
          generation !== generationRef.current
        ) {
          return;
        }

        const data = error.response?.data;
        const used = data?.status === "ALREADY_USED";

        setStatus(used ? "ALREADY_USED" : "INVALID");
        setMessage(
          data?.message ||
            data?.error ||
            "This QR could not be verified."
        );
        setTicket(data?.ticket || null);

        setCounts((currentCounts) => ({
          ...currentCounts,
          declined: currentCounts.declined + 1,
        }));

        record("denied", data?.ticket);
      } finally {
        if (generation === generationRef.current) {
          lockedRef.current = false;
        }
      }
    },
    [token, stopCamera]
  );

  // =====================================================
  // START CAMERA
  // =====================================================

  const startCamera = async () => {
    if (
      cameraStartingRef.current ||
      cameraRef.current ||
      lockedRef.current ||
      checkInBusy
    ) {
      return;
    }

    cameraStartingRef.current = true;
    setCameraStarting(true);
    setTicket(null);
    setLastQr("");
    setStatus("SCANNING");
    setMessage("Hold the guest's QR inside the scanning frame.");

    const generation = ++generationRef.current;
    let reader;

    try {
      reader = new Html5Qrcode(SCANNER_ID);
      cameraRef.current = reader;

      await reader.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 240,
            height: 240,
          },
        },
        (decodedText) => {
          if (!lockedRef.current) {
            void verify(decodedText);
          }
        },
        () => {
          // A camera frame without a QR code is normal.
        }
      );

      if (
        !mountedRef.current ||
        generation !== generationRef.current
      ) {
        try {
          if (reader.isScanning) await reader.stop();
          await reader.clear();
        } catch (error) {
          console.warn("Camera cleanup after start:", error);
        }

        if (cameraRef.current === reader) {
          cameraRef.current = null;
        }

        return;
      }

      if (cameraRef.current === reader) {
        setCameraRunning(true);
      }
    } catch (error) {
      console.error("Camera unavailable:", error);

      if (reader && cameraRef.current === reader) {
        await stopCamera();
      }

      if (
        mountedRef.current &&
        generation === generationRef.current
      ) {
        setStatus("IDLE");
        setMessage(
          "Camera unavailable. Allow camera access or use manual entry."
        );

        toast.error(
          "Camera could not be opened. HTTPS or localhost and camera permission are required."
        );
      }
    } finally {
      cameraStartingRef.current = false;

      if (mountedRef.current) {
        setCameraStarting(false);
      }
    }
  };

  const stopManually = async () => {
    ++generationRef.current;
    await stopCamera();

    if (mountedRef.current) {
      setStatus("IDLE");
      setMessage("Camera paused. Ready for the next ticket.");
    }
  };

  const reset = async () => {
    if (cameraStarting || checkingInRef.current) return;

    ++generationRef.current;
    lockedRef.current = false;

    await stopCamera();

    if (!mountedRef.current) return;

    setCode("");
    setLastQr("");
    setTicket(null);
    setStatus("IDLE");
    setMessage("Ready to verify the next guest.");
    setCheckInBusy(false);
  };

  // =====================================================
  // REFRESH SCANNER
  // =====================================================

  const handleRefresh = async () => {
    if (
      busy ||
      checkingInRef.current ||
      lockedRef.current
    ) {
      return;
    }

    setRefreshing(true);
    setRefreshFeedback("");

    try {
      // Refresh safely releases the camera and resets
      // the local verification session.
      await Promise.all([
        reset(),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);

      if (!mountedRef.current) return;

      const confirmation = "Scanner ready for the next ticket.";

      setRefreshFeedback(confirmation);
      toast.success(confirmation);
    } catch (error) {
      if (mountedRef.current) {
        toast.error("Unable to reset the scanner.");
      }
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  };

  const changeMode = async (next) => {
    if (
      next === mode ||
      busy ||
      checkingInRef.current
    ) {
      return;
    }

    await stopManually();

    if (!mountedRef.current) return;

    setMode(next);
    setCode("");
  };

  // =====================================================
  // MANUAL VERIFICATION
  // =====================================================

  const manualSubmit = (event) => {
    event.preventDefault();

    if (busy || lockedRef.current) return;

    if (!code.trim()) {
      toast.error("Paste a valid BookMySeat QR value.");
      inputRef.current?.focus();
      return;
    }

    void verify(code);
  };

  // =====================================================
  // CHECK-IN
  // =====================================================

  const checkIn = async () => {
    if (
      status !== "VALID" ||
      !ticket ||
      !lastQr ||
      checkingInRef.current ||
      lockedRef.current ||
      !token
    ) {
      return;
    }

    checkingInRef.current = true;
    const generation = ++generationRef.current;

    setCheckInBusy(true);
    setStatus("CHECKING_IN");
    setMessage("Confirming ticket admission with the server...");

    try {
      const { data } = await axios.post(
        `${API}/api/tickets/check-in`,
        { qrData: lastQr },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (
        !mountedRef.current ||
        generation !== generationRef.current
      ) {
        return;
      }

      setTicket(data.ticket || ticket);
      setStatus("CHECKED_IN");
      setMessage(
        data.message ||
          "The guest has been checked in successfully."
      );

      setCounts((currentCounts) => ({
        ...currentCounts,
        admitted: currentCounts.admitted + 1,
      }));

      record("admitted", data.ticket || ticket);
      toast.success("Guest admitted.");
    } catch (error) {
      if (
        !mountedRef.current ||
        generation !== generationRef.current
      ) {
        return;
      }

      const data = error.response?.data;

      setTicket(data?.ticket || ticket);
      setStatus(
        data?.status === "ALREADY_USED"
          ? "ALREADY_USED"
          : "INVALID"
      );
      setMessage(
        data?.message ||
          data?.error ||
          "Check-in was not completed."
      );

      setCounts((currentCounts) => ({
        ...currentCounts,
        declined: currentCounts.declined + 1,
      }));

      record("denied", data?.ticket || ticket);
    } finally {
      checkingInRef.current = false;

      if (
        mountedRef.current &&
        generation === generationRef.current
      ) {
        setCheckInBusy(false);
      }
    }
  };

  // =====================================================
  // CLEAN UP CAMERA ON UNMOUNT
  // =====================================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;

      const scanner = cameraRef.current;
      cameraRef.current = null;

      if (scanner) {
        void (async () => {
          try {
            if (scanner.isScanning) await scanner.stop();
            await scanner.clear();
          } catch (error) {
            console.warn("Scanner unmount cleanup:", error);
          }
        })();
      }
    };
  }, []);

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="mx-auto max-w-[1570px] text-white">
      {/* PAGE HEADER */}

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.26em] text-[#ff6780]">
            <span className="h-px w-8 bg-[#D71935]" />
            Guest services / 10
          </p>

          <h1 className="mt-4 text-[clamp(2.25rem,3.8vw,4rem)] font-semibold leading-[.96] tracking-[-.079em] text-[#f4f1ed]">
            At the <span className="text-[#dd3b55]">door.</span>
          </h1>

          <p className="mt-5 text-sm leading-7 text-[#9d9da8]">
            A fast, secure entry desk for real BookMySeat tickets.
          </p>
        </div>
      </header>

      {/* SESSION STATISTICS */}

      <section
        aria-label="Session statistics"
        className="mt-9 grid gap-3 sm:grid-cols-3"
      >
        {[
          [
            "Verified this session",
            counts.verified,
            ShieldCheck,
            "text-[#ff667e]",
          ],
          [
            "Guests admitted",
            counts.admitted,
            UserCheck,
            "text-emerald-300",
          ],
          [
            "Denied attempts",
            counts.declined,
            ShieldX,
            "text-amber-300",
          ],
        ].map(([label, value, Icon, color], index) => (
          <motion.div
            key={label}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex items-center justify-between rounded-[19px] border border-white/[.09] bg-[#151518] p-5 sm:p-6"
          >
            <div>
              <p className="text-[11px] text-[#a2a2ac]">
                {label}
              </p>
              <p className="mt-3 text-3xl font-semibold tabular-nums">
                {value}
              </p>
            </div>

            <Icon size={22} className={color} />
          </motion.div>
        ))}
      </section>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.24fr)_minmax(350px,.76fr)]">
        {/* LIVE CHECKPOINT */}

        <section className="min-w-0 overflow-hidden rounded-[27px] border border-white/10 bg-[#151518]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-6 sm:px-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ff6980]">
                Checkpoint / A
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-.05em]">
                Verify admission.
              </h2>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={busy || checkInBusy}
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
                : "Refresh scanner"}
            </button>
          </div>

          <p
            role="status"
            aria-live="polite"
            className="px-6 pt-3 text-xs text-emerald-300 sm:px-8"
          >
            {refreshFeedback}
          </p>

          {/* SCANNER MODES */}

          <div
            className="flex gap-1 border-b border-white/10 px-6 sm:px-8"
            role="tablist"
            aria-label="Verification method"
          >
            {[
              ["camera", "Camera scan", Camera],
              ["manual", "Manual entry", Keyboard],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                disabled={busy || checkInBusy}
                onClick={() => changeMode(key)}
                className={`flex items-center gap-2 border-b-2 px-5 py-4 text-xs font-semibold transition disabled:opacity-40 ${
                  mode === key
                    ? "border-[#D71935] text-white"
                    : "border-transparent text-[#8d8d99] hover:text-white"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-8">
            {mode === "camera" ? (
              <>
                <div className="relative min-h-[380px] overflow-hidden rounded-[23px] border border-white/10 bg-[#09090c] sm:min-h-[455px]">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(215,25,53,.11),transparent_65%)]"
                  />

                  <div
                    id={SCANNER_ID}
                    className="relative z-[1] w-full"
                  />

                  {!cameraRunning &&
                    !cameraStarting &&
                    status !== "VERIFYING" && (
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <motion.div
                          animate={
                            reduced
                              ? {}
                              : {
                                  rotate: [
                                    0,
                                    7,
                                    0,
                                    -7,
                                    0,
                                  ],
                                }
                          }
                          transition={{
                            duration: 10,
                            repeat: Infinity,
                          }}
                          className="relative flex h-40 w-40 items-center justify-center rounded-[36px] border border-[#D71935]/30 bg-[#D71935]/[.06]"
                        >
                          <span className="absolute inset-3 rounded-[28px] border border-white/10" />
                          <QrCode
                            size={54}
                            className="text-[#e85a73]"
                          />
                        </motion.div>

                        <p className="mt-7 text-sm font-medium text-[#a0a0ac]">
                          Camera is not running
                        </p>
                        <p className="mt-2 text-xs text-[#6d6d77]">
                          Use your camera to capture a guest's QR
                        </p>
                      </div>
                    )}

                  {cameraStarting && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#09090c]/85">
                      <Loader2
                        className="animate-spin text-[#ff5f77]"
                        size={36}
                      />
                      <p className="mt-4 text-sm text-zinc-300">
                        Starting camera...
                      </p>
                    </div>
                  )}

                  {cameraRunning && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                      <div className="relative h-[260px] w-[260px]">
                        {[
                          "left-0 top-0 rounded-tl-2xl border-l-[3px] border-t-[3px]",
                          "right-0 top-0 rounded-tr-2xl border-r-[3px] border-t-[3px]",
                          "left-0 bottom-0 rounded-bl-2xl border-l-[3px] border-b-[3px]",
                          "right-0 bottom-0 rounded-br-2xl border-r-[3px] border-b-[3px]",
                        ].map((position) => (
                          <span
                            key={position}
                            className={`absolute h-12 w-12 border-[#ff667e] ${position}`}
                          />
                        ))}

                        <motion.span
                          animate={
                            reduced
                              ? {}
                              : {
                                  top: [12, 244, 12],
                                }
                          }
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="absolute left-3 right-3 h-[2px] bg-[#ff5876] shadow-[0_0_30px_rgba(255,68,100,.9)]"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 text-center">
                    <span className="rounded-full border border-white/10 bg-black/60 px-4 py-2 text-[10px] uppercase tracking-[.16em] text-white/70 backdrop-blur">
                      {cameraRunning
                        ? "Align QR in frame"
                        : "BookMySeat access control"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {cameraRunning ? (
                    <button
                      type="button"
                      onClick={stopManually}
                      disabled={checkInBusy}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[.04] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
                    >
                      <X size={16} />
                      Stop camera
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={
                        busy ||
                        lockedRef.current ||
                        checkInBusy
                      }
                      className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#ed2a49] disabled:opacity-40"
                    >
                      <Camera size={18} />
                      Start camera
                      <ArrowRight size={16} />
                    </button>
                  )}

                  <p className="text-xs leading-5 text-[#888891]">
                    Camera requires permission and HTTPS or localhost.
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-[23px] border border-white/10 bg-[#101014] p-6 sm:p-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-[22px] border border-[#D71935]/30 bg-[#D71935]/10">
                  <Keyboard
                    size={35}
                    className="text-[#ef607b]"
                  />
                </div>

                <h3 className="mt-6 text-2xl font-semibold tracking-tight">
                  Verify without a camera.
                </h3>

                <p className="mt-3 max-w-md text-sm leading-6 text-[#9a9aa5]">
                  Paste the complete value stored in the
                  guest's BookMySeat QR. A booking
                  reference by itself is not a valid QR
                  credential.
                </p>

                <form
                  onSubmit={manualSubmit}
                  className="mt-7 space-y-4"
                >
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[.15em] text-[#b7b7c0]">
                      QR credential
                    </span>

                    <textarea
                      ref={inputRef}
                      rows={4}
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value)
                      }
                      placeholder="BMS1:..."
                      aria-label="Complete QR value"
                      spellCheck={false}
                      className="w-full resize-y rounded-xl border border-white/15 bg-[#202026] p-4 font-mono text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D71935]"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={busy || !code.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#D71935] px-6 py-4 text-sm font-semibold transition hover:bg-[#ed2a49] disabled:opacity-30"
                  >
                    <ShieldCheck size={18} />
                    Verify ticket
                    <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>

        {/* TICKET INSPECTION */}

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-40">
          <motion.section
            layout
            className="overflow-hidden rounded-[25px] border border-white/10 bg-[#151518]"
          >
            <div className="border-b border-white/10 p-6">
              <p className="text-[10px] font-bold uppercase tracking-[.21em] text-[#ff617b]">
                Checkpoint / B
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-[-.055em]">
                Admission decision.
              </h2>
            </div>

            <div className="p-6">
              <div className="relative overflow-hidden rounded-[20px] border border-white/[.07] bg-[#1e1b20] p-5">
                <div
                  className={`absolute inset-y-0 left-0 w-[3px] ${current.light}`}
                />

                <div className="flex items-start gap-4">
                  <motion.div
                    key={status}
                    initial={
                      reduced
                        ? false
                        : {
                            opacity: 0,
                            scale: 0.75,
                          }
                    }
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 ${current.accent}`}
                  >
                    <StatusIcon
                      size={27}
                      className={
                        status === "VERIFYING" ||
                        status === "CHECKING_IN"
                          ? "animate-spin"
                          : ""
                      }
                    />
                  </motion.div>

                  <div className="min-w-0">
                    <p
                      className={`text-[11px] font-bold uppercase tracking-[.18em] ${current.accent}`}
                    >
                      {current.caption}
                    </p>

                    <p className="mt-2 text-xl font-semibold text-white">
                      {current.label}
                    </p>
                  </div>
                </div>

                <p
                  role="status"
                  aria-live="polite"
                  className="mt-5 text-sm leading-6 text-[#ababbb]"
                >
                  {message}
                </p>
              </div>

              {/* VERIFIED TICKET DETAILS */}

              <AnimatePresence mode="wait">
                {ticket && (
                  <motion.div
                    key={`${
                      ticket.bookingId ||
                      ticket.bookingCode ||
                      "ticket"
                    }-${status}`}
                    initial={
                      reduced
                        ? false
                        : { opacity: 0, y: 14 }
                    }
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 0,
                      y: 10,
                    }}
                    transition={{
                      duration: 0.3,
                      ease: easing,
                    }}
                    className="mt-5"
                  >
                    <div className="flex items-center gap-4 border-b border-dashed border-white/20 pb-5">
                      {ticket.movie?.poster ? (
                        <img
                          src={ticket.movie.poster}
                          alt=""
                          className="h-[110px] w-[75px] shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-[110px] w-[75px] shrink-0 items-center justify-center rounded-lg bg-[#26222a]">
                          <Ticket
                            size={26}
                            className="text-zinc-600"
                          />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[.2em] text-[#f2667d]">
                          Verified booking
                        </p>

                        <h3 className="mt-2 text-xl font-semibold leading-tight text-white">
                          {ticket.movie?.title || "Film"}
                        </h3>

                        <p className="mt-2 font-mono text-xs text-[#9797a2]">
                          {ticket.bookingCode || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-5">
                      <TicketInfo
                        icon={MapPin}
                        title="Cinema"
                        value={ticket.theatre?.name}
                        className="col-span-2"
                      />

                      <TicketInfo
                        icon={ScanLine}
                        title="Screen"
                        value={ticket.screen?.name}
                      />

                      <TicketInfo
                        icon={Ticket}
                        title="Seats"
                        value={seatNames(ticket.seats)}
                      />

                      <TicketInfo
                        icon={Clock3}
                        title="Showtime"
                        value={dateTime(
                          ticket.show?.startTime
                        )}
                        className="col-span-2"
                      />

                      <TicketInfo
                        icon={CreditCard}
                        title="Amount paid"
                        value={`₹${Number(
                          ticket.totalAmount || 0
                        ).toLocaleString("en-IN")}`}
                      />

                      <TicketInfo
                        icon={LockKeyhole}
                        title="Ticket usage"
                        value={
                          ticket.ticketUsed
                            ? "Used"
                            : "Not used"
                        }
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ADMISSION ACTIONS */}

              {status === "VALID" && ticket && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  disabled={checkInBusy}
                  onClick={checkIn}
                  className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-emerald-400 px-5 py-4 text-sm font-bold text-[#09140e] transition hover:bg-emerald-300 disabled:opacity-40"
                >
                  <UserCheck size={19} />
                  Admit this guest
                  <ChevronRight size={18} />
                </motion.button>
              )}

              {status === "CHECKED_IN" && (
                <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-300">
                  <CheckCircle2 size={18} />
                  Check-in successful
                </div>
              )}

              {status === "ALREADY_USED" && (
                <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
                  <CircleAlert size={18} />
                  Do not admit this QR again.
                </div>
              )}

              {status === "INVALID" && (
                <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
                  <XCircle size={18} />
                  Verification failed. Confirm the ticket with the guest.
                </div>
              )}
            </div>
          </motion.section>

          {/* RECENT ACTIVITY */}

          <section className="rounded-[24px] border border-white/10 bg-[#151518] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[.2em] text-[#f26179]">
                  This device only
                </p>

                <h3 className="mt-2 text-lg font-semibold">
                  Recent activity
                </h3>
              </div>

              <ShieldCheck
                size={20}
                className="text-[#f26179]"
              />
            </div>

            {recent.length === 0 ? (
              <p className="mt-6 text-sm leading-6 text-[#898994]">
                No scans this session. Activity appears after
                the first verification.
              </p>
            ) : (
              <div className="mt-5 divide-y divide-white/[.07]">
                {recent.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-3"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        item.kind === "admitted"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : item.kind === "denied"
                            ? "bg-red-400/10 text-red-300"
                            : "bg-[#D71935]/10 text-[#ff627b]"
                      }`}
                    >
                      {item.kind === "admitted" ? (
                        <UserCheck size={16} />
                      ) : item.kind === "denied" ? (
                        <XCircle size={16} />
                      ) : (
                        <Check size={16} />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium capitalize text-white">
                        {item.kind}
                      </p>

                      <p className="mt-1 truncate font-mono text-xs text-zinc-500">
                        {item.bookingCode ||
                          "QR verification"}
                      </p>
                    </div>

                    <span className="text-[11px] text-zinc-500">
                      {item.time.toLocaleTimeString(
                        "en-IN",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-5 text-[#787882]">
              Session counters reset when this page reloads.
              Official admission records are stored by the
              backend.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
