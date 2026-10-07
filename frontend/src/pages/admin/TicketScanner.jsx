import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  motion,
  AnimatePresence,
} from "framer-motion";

import {
  Camera,
  CheckCircle2,
  CircleAlert,
  Clock,
  QrCode,
  RotateCcw,
  ScanLine,
  Ticket,
  UserCheck,
  XCircle,
} from "lucide-react";

import {
  Html5Qrcode,
} from "html5-qrcode";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useAuth,
} from "../../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const CINEMA_TIME_ZONE =
  "Asia/Kolkata";

const SCANNER_ID =
  "bookmyseat-qr-reader";

// =====================================================
// HELPERS
// =====================================================

const formatDateTime = (
  value
) => {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone:
        CINEMA_TIME_ZONE,

      weekday:
        "short",

      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  ).format(
    new Date(value)
  );
};

// =====================================================
// PAGE
// =====================================================

const TicketScanner = () => {
  const {
    token,
  } = useAuth();

  const scannerRef =
    useRef(null);

  const scanLockedRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const [
    scannerRunning,
    setScannerRunning,
  ] = useState(false);

  const [
    manualCode,
    setManualCode,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("IDLE");

  const [
    message,
    setMessage,
  ] = useState(
    "Scan a BookMySeat ticket."
  );

  const [
    ticketData,
    setTicketData,
  ] = useState(null);

  const [
    lastQrData,
    setLastQrData,
  ] = useState("");

  const [
    checkingIn,
    setCheckingIn,
  ] = useState(false);

  // ===================================================
  // STOP CAMERA
  // ===================================================

  const stopScanner =
    useCallback(
      async () => {
        const scanner =
          scannerRef.current;

        if (!scanner) {
          setScannerRunning(
            false
          );

          return;
        }

        try {
          if (
            scanner.isScanning
          ) {
            await scanner.stop();
          }

          await scanner.clear();
        } catch (error) {
          console.warn(
            "Scanner cleanup:",
            error
          );
        }

        scannerRef.current =
          null;

        if (
          mountedRef.current
        ) {
          setScannerRunning(
            false
          );
        }
      },
      []
    );

  // ===================================================
  // VERIFY QR
  // ===================================================

  const verifyTicket =
    useCallback(
      async (
        qrData
      ) => {
        if (
          !qrData ||
          scanLockedRef.current
        ) {
          return;
        }

        scanLockedRef.current =
          true;

        setLastQrData(
          qrData
        );

        setStatus(
          "VERIFYING"
        );

        setMessage(
          "Checking ticket..."
        );

        setTicketData(
          null
        );

        await stopScanner();

        try {
          const response =
            await axios.post(
              `${API_URL}/api/tickets/verify`,
              {
                qrData,
              },
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          setTicketData(
            response.data.ticket
          );

          setStatus(
            "VALID"
          );

          setMessage(
            "Ticket is valid."
          );
        } catch (error) {
          const data =
            error.response
              ?.data;

          if (
            data?.ticket
          ) {
            setTicketData(
              data.ticket
            );
          }

          if (
            data?.status ===
            "ALREADY_USED"
          ) {
            setStatus(
              "ALREADY_USED"
            );

            setMessage(
              data.message ||
                "Ticket already used."
            );
          } else {
            setStatus(
              "INVALID"
            );

            setMessage(
              data?.message ||
                "Invalid ticket."
            );
          }
        } finally {
          scanLockedRef.current =
            false;
        }
      },
      [
        token,
        stopScanner,
      ]
    );

  // ===================================================
  // START CAMERA
  // ===================================================

  const startScanner =
    async () => {
      if (
        scannerRunning
      ) {
        return;
      }

      setTicketData(
        null
      );

      setStatus(
        "SCANNING"
      );

      setMessage(
        "Point the camera at the ticket QR."
      );

      try {
        const scanner =
          new Html5Qrcode(
            SCANNER_ID
          );

        scannerRef.current =
          scanner;

        await scanner.start(
          {
            facingMode:
              "environment",
          },
          {
            fps: 10,

            qrbox: {
              width: 260,
              height: 260,
            },

            aspectRatio:
              1,
          },
          (decodedText) => {
            if (
              !scanLockedRef
                .current
            ) {
              verifyTicket(
                decodedText
              );
            }
          },
          () => {
            // Ignore normal frame decode failures.
          }
        );

        setScannerRunning(
          true
        );
      } catch (error) {
        console.error(
          "Camera start failed:",
          error
        );

        scannerRef.current =
          null;

        setStatus(
          "INVALID"
        );

        setMessage(
          "Could not access the camera."
        );

        toast.error(
          "Camera permission is required."
        );
      }
    };

  // ===================================================
  // MANUAL TEST
  // ===================================================

  const handleManualSubmit =
    (event) => {
      event.preventDefault();

      const value =
        manualCode.trim();

      if (!value) {
        toast.error(
          "Paste a QR value first."
        );

        return;
      }

      verifyTicket(
        value
      );
    };

  // ===================================================
  // CHECK IN
  // ===================================================

  const handleCheckIn =
    async () => {
      if (
        !lastQrData ||
        checkingIn
      ) {
        return;
      }

      setCheckingIn(
        true
      );

      try {
        const response =
          await axios.post(
            `${API_URL}/api/tickets/check-in`,
            {
              qrData:
                lastQrData,
            },
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        setTicketData(
          response.data.ticket
        );

        setStatus(
          "CHECKED_IN"
        );

        setMessage(
          "Guest admitted successfully."
        );

        toast.success(
          "Ticket checked in."
        );
      } catch (error) {
        const data =
          error.response
            ?.data;

        if (
          data?.ticket
        ) {
          setTicketData(
            data.ticket
          );
        }

        if (
          data?.status ===
          "ALREADY_USED"
        ) {
          setStatus(
            "ALREADY_USED"
          );
        } else {
          setStatus(
            "INVALID"
          );
        }

        setMessage(
          data?.message ||
            "Check-in failed."
        );
      } finally {
        setCheckingIn(
          false
        );
      }
    };

  // ===================================================
  // RESET
  // ===================================================

  const resetScanner =
    async () => {
      await stopScanner();

      setTicketData(
        null
      );

      setLastQrData(
        ""
      );

      setManualCode(
        ""
      );

      setStatus(
        "IDLE"
      );

      setMessage(
        "Scan a BookMySeat ticket."
      );

      scanLockedRef.current =
        false;
    };

  // ===================================================
  // CLEANUP
  // ===================================================

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;

      const scanner =
        scannerRef.current;

      if (
        scanner?.isScanning
      ) {
        scanner
          .stop()
          .catch(() => {});
      }
    };
  }, []);

  // ===================================================
  // STATUS COLORS
  // ===================================================

  const statusConfig = {
    IDLE: {
      icon: QrCode,
      label:
        "Ready to scan",
      classes:
        "text-zinc-300 bg-zinc-800/70 border-white/10",
    },

    SCANNING: {
      icon: ScanLine,
      label:
        "Scanning",
      classes:
        "text-blue-400 bg-blue-500/10 border-blue-500/20",
    },

    VERIFYING: {
      icon: Clock,
      label:
        "Verifying",
      classes:
        "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },

    VALID: {
      icon:
        CheckCircle2,
      label:
        "Valid ticket",
      classes:
        "text-green-400 bg-green-500/10 border-green-500/20",
    },

    CHECKED_IN: {
      icon:
        UserCheck,
      label:
        "Checked in",
      classes:
        "text-green-400 bg-green-500/10 border-green-500/20",
    },

    ALREADY_USED: {
      icon:
        CircleAlert,
      label:
        "Already used",
      classes:
        "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },

    INVALID: {
      icon:
        XCircle,
      label:
        "Invalid ticket",
      classes:
        "text-red-400 bg-red-500/10 border-red-500/20",
    },
  };

  const currentStatus =
    statusConfig[
      status
    ] ||
    statusConfig.IDLE;

  const StatusIcon =
    currentStatus.icon;

  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="max-w-6xl mx-auto">

      <div className="mb-8">

        <p className="text-sm uppercase tracking-[0.25em] text-red-500">
          Entry Control
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Ticket Scanner
        </h1>

        <p className="mt-2 text-zinc-500">
          Verify and admit guests using their booking QR.
        </p>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8">

        {/* ============================================
            CAMERA
        ============================================ */}

        <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6">

          <div className="relative overflow-hidden rounded-2xl bg-black min-h-[480px] flex items-center justify-center">

            <div
              id={
                SCANNER_ID
              }
              className="w-full"
            />

            {!scannerRunning &&
              status !==
                "VERIFYING" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">

                  <motion.div
                    animate={{
                      scale: [
                        1,
                        1.06,
                        1,
                      ],
                    }}
                    transition={{
                      duration:
                        2,

                      repeat:
                        Infinity,
                    }}
                    className="flex h-24 w-24 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10"
                  >
                    <Camera className="h-10 w-10 text-red-500" />
                  </motion.div>

                  <p className="mt-5 text-zinc-500">
                    Camera inactive
                  </p>

                </div>
              )}

            {scannerRunning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

                <div className="relative h-[280px] w-[280px] rounded-3xl border border-white/20">

                  <motion.div
                    animate={{
                      y: [
                        12,
                        250,
                        12,
                      ],
                    }}
                    transition={{
                      duration:
                        2.2,

                      repeat:
                        Infinity,

                      ease:
                        "easeInOut",
                    }}
                    className="absolute left-3 right-3 top-0 h-[2px] bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.9)]"
                  />

                </div>

              </div>
            )}

          </div>

          <div className="mt-5 flex flex-wrap gap-3">

            {!scannerRunning ? (
              <button
                onClick={
                  startScanner
                }
                className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-semibold transition hover:bg-red-500 active:scale-95"
              >
                <Camera className="h-4 w-4" />

                Start Camera
              </button>
            ) : (
              <button
                onClick={
                  stopScanner
                }
                className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-semibold transition hover:bg-white/10"
              >
                Stop Camera
              </button>
            )}

            <button
              onClick={
                resetScanner
              }
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 font-semibold transition hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />

              Reset
            </button>

          </div>

          {/* MANUAL TEST */}

          <form
            onSubmit={
              handleManualSubmit
            }
            className="mt-6 border-t border-white/10 pt-6"
          >

            <p className="mb-3 text-sm text-zinc-500">
              Manual test
            </p>

            <div className="flex gap-3">

              <input
                value={
                  manualCode
                }
                onChange={(
                  event
                ) =>
                  setManualCode(
                    event.target
                      .value
                  )
                }
                placeholder="Paste BMS1:... QR value"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-red-500"
              />

              <button
                type="submit"
                className="rounded-xl bg-zinc-800 px-5 font-semibold hover:bg-zinc-700"
              >
                Verify
              </button>

            </div>

          </form>

        </div>

        {/* ============================================
            RESULT
        ============================================ */}

        <div>

          <motion.div
            layout
            className={`rounded-2xl border p-5 ${currentStatus.classes}`}
          >

            <div className="flex items-center gap-3">

              <motion.div
                key={
                  status
                }
                initial={{
                  scale: 0.6,
                  opacity: 0,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/20"
              >
                <StatusIcon className="h-6 w-6" />
              </motion.div>

              <div>

                <p className="font-bold">
                  {
                    currentStatus.label
                  }
                </p>

                <p className="mt-0.5 text-sm opacity-75">
                  {
                    message
                  }
                </p>

              </div>

            </div>

          </motion.div>

          <AnimatePresence
            mode="wait"
          >
            {ticketData && (
              <motion.div
                key={
                  ticketData.bookingId
                }
                initial={{
                  y: 20,
                  opacity: 0,
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900"
              >

                {/* MOVIE */}

                <div className="flex gap-4 p-6">

                  {ticketData
                    .movie
                    ?.poster && (
                    <img
                      src={
                        ticketData
                          .movie
                          .poster
                      }
                      alt={
                        ticketData
                          .movie
                          .title
                      }
                      className="h-28 w-20 rounded-xl object-cover"
                    />
                  )}

                  <div>

                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      Booking
                    </p>

                    <h2 className="mt-1 text-xl font-bold">
                      {
                        ticketData
                          .movie
                          ?.title
                      }
                    </h2>

                    <p className="mt-2 text-sm text-zinc-500">
                      {
                        ticketData.bookingCode
                      }
                    </p>

                  </div>

                </div>

                <div className="border-t border-dashed border-white/10" />

                {/* DETAILS */}

                <div className="grid grid-cols-2 gap-5 p-6 text-sm">

                  <div>
                    <p className="text-zinc-500">
                      Seats
                    </p>

                    <p className="mt-1 font-semibold">
                      {ticketData.seats?.join(
                        ", "
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-zinc-500">
                      Screen
                    </p>

                    <p className="mt-1 font-semibold">
                      {
                        ticketData
                          .screen
                          ?.name
                      }
                    </p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-zinc-500">
                      Theatre
                    </p>

                    <p className="mt-1 font-semibold">
                      {
                        ticketData
                          .theatre
                          ?.name
                      }
                    </p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-zinc-500">
                      Showtime
                    </p>

                    <p className="mt-1 font-semibold">
                      {formatDateTime(
                        ticketData
                          .show
                          ?.startTime
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-zinc-500">
                      Paid
                    </p>

                    <p className="mt-1 font-bold">
                      ₹
                      {Number(
                        ticketData.totalAmount
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-zinc-500">
                      Ticket
                    </p>

                    <p className="mt-1 font-semibold">
                      {ticketData.ticketUsed
                        ? "USED"
                        : "UNUSED"}
                    </p>
                  </div>

                </div>

                {/* ADMIT */}

                {status ===
                  "VALID" && (
                  <div className="p-6 pt-0">

                    <motion.button
                      whileHover={{
                        scale:
                          1.01,
                      }}
                      whileTap={{
                        scale:
                          0.97,
                      }}
                      onClick={
                        handleCheckIn
                      }
                      disabled={
                        checkingIn
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-4 font-bold text-white transition hover:bg-green-500 disabled:opacity-50"
                    >
                      <UserCheck className="h-5 w-5" />

                      {checkingIn
                        ? "Checking in..."
                        : "Admit Guest"}
                    </motion.button>

                  </div>
                )}

                {status ===
                  "CHECKED_IN" && (
                  <div className="border-t border-green-500/20 bg-green-500/10 p-5 text-center text-sm font-semibold text-green-400">
                    ✓ Guest admitted
                  </div>
                )}

                {status ===
                  "ALREADY_USED" && (
                  <div className="border-t border-amber-500/20 bg-amber-500/10 p-5 text-center text-sm font-semibold text-amber-400">
                    This QR cannot be used again.
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

    </div>
  );
};

export default TicketScanner;