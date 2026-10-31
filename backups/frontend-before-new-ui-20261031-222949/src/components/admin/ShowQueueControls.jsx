
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";
import axios from "axios";
import toast from "react-hot-toast";

import {
  Clock3,
  Loader2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

const API = (
  process.env.REACT_APP_BACKEND_URL || ""
).replace(/\/+$/, "");

const INPUT =
  "w-full rounded-xl border border-white/15 bg-[#222227] px-4 py-3 text-sm text-white outline-none focus:border-[#D71935] disabled:opacity-40";

const DEFAULTS = {
  enabled: false,
  capacity: 10,
  admissionSeconds: 300,
};

function getError(error) {
  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    "Waiting room service is unavailable."
  );
}

export default function ShowQueueControls({
  show,
  token,
}) {
  const showId = String(show?._id || "");
  const buttonRef = useRef(null);

  const canManage =
    show?.status === "SCHEDULED" &&
    show?.isActive !== false &&
    new Date(show?.startTime).getTime() >
      Date.now();

  const [visible, setVisible] =
    useState(false);

  const [open, setOpen] =
    useState(false);

  const [config, setConfig] =
    useState(null);

  const [draft, setDraft] =
    useState(DEFAULTS);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  // =====================================================
  // LOAD QUEUE CONFIGURATION
  // =====================================================

  const loadConfig = useCallback(
    async (signal) => {
      if (!showId || !token) return;

      setLoading(true);
      setError("");

      try {
        const { data } = await axios.get(
          `${API}/api/queue/shows/${showId}`,
          {
            signal,
            timeout: 15000,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (signal?.aborted) return;

        if (
          !data?.success ||
          typeof data.enabled !== "boolean"
        ) {
          throw new Error(
            "Invalid queue configuration."
          );
        }

        const next = {
          enabled: data.enabled,
          capacity: Number(
            data.capacity || 10
          ),
          admissionSeconds: Number(
            data.admissionSeconds || 300
          ),
        };

        setConfig(next);
        setDraft(next);
      } catch (requestError) {
        if (
          signal?.aborted ||
          axios.isCancel(requestError)
        ) {
          return;
        }

        setError(getError(requestError));
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [showId, token]
  );

  // =====================================================
  // LOAD VISIBLE SHOWS ONLY
  // =====================================================

  useEffect(() => {
    if (!canManage || visible) {
      return undefined;
    }

    const element = buttonRef.current;

    if (!element) return undefined;

    if (
      typeof IntersectionObserver ===
      "undefined"
    ) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting
          )
        ) {
          setVisible(true);
        }
      },
      {
        rootMargin: "250px",
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [canManage, visible]);

  useEffect(() => {
    if (!visible || !canManage) {
      return undefined;
    }

    const controller = new AbortController();

    loadConfig(controller.signal);

    return () => controller.abort();
  }, [
    visible,
    canManage,
    loadConfig,
  ]);

  // =====================================================
  // MODAL BEHAVIOUR
  // =====================================================

  useEffect(() => {
    if (!open) return undefined;

    const previous =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !saving
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "keydown",
      onKeyDown
    );

    return () => {
      document.body.style.overflow =
        previous;

      document.removeEventListener(
        "keydown",
        onKeyDown
      );
    };
  }, [open, saving]);

  // =====================================================
  // SAVE QUEUE CONFIGURATION
  // =====================================================

  const save = async (event) => {
    event.preventDefault();

    if (
      saving ||
      loading ||
      !config
    ) {
      return;
    }

    const capacity = Number(
      draft.capacity
    );

    const admissionSeconds = Number(
      draft.admissionSeconds
    );

    if (
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 100 ||
      !Number.isInteger(admissionSeconds) ||
      admissionSeconds < 60 ||
      admissionSeconds > 900
    ) {
      toast.error(
        "Capacity must be 1–100 and admission duration must be 60–900 seconds."
      );

      return;
    }

    const changed =
      config.enabled !== draft.enabled ||
      config.capacity !== capacity ||
      config.admissionSeconds !==
        admissionSeconds;

    if (!changed) {
      setOpen(false);
      return;
    }

    const confirmed = window.confirm(
      "Changing queue settings resets the current waiting room and invalidates existing admission tokens. Continue?"
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const { data } = await axios.patch(
        `${API}/api/queue/admin/shows/${showId}`,
        {
          enabled: draft.enabled,
          capacity,
          admissionSeconds,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 15000,
        }
      );

      if (!data?.success) {
        throw new Error(
          "The server did not confirm the change."
        );
      }

      const next = {
        enabled: Boolean(data.enabled),
        capacity: Number(data.capacity),
        admissionSeconds: Number(
          data.admissionSeconds
        ),
      };

      setConfig(next);
      setDraft(next);
      setError("");
      setOpen(false);

      toast.success(
        next.enabled
          ? "Waiting room enabled."
          : "Waiting room disabled."
      );
    } catch (requestError) {
      const message = getError(
        requestError
      );

      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return null;
  }

  const statusText =
    loading && !config
      ? "Checking queue..."
      : error && !config
        ? "Queue unavailable"
        : config?.enabled
          ? "Queue active"
          : "Queue off";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen(true);
          loadConfig();
        }}
        aria-label={`Manage virtual queue for ${
          show?.movie?.title || "screening"
        }`}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition hover:border-[#D71935] ${
          config?.enabled
            ? "border-[#D71935]/60 bg-[#D71935]/10 text-[#ff8197]"
            : "border-white/15 text-zinc-300"
        }`}
      >
        {loading && !config ? (
          <Loader2
            size={14}
            className="animate-spin"
          />
        ) : (
          <Users size={14} />
        )}

        {statusText}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close queue settings"
              onClick={() => {
                if (!saving) setOpen(false);
              }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <section
              role="dialog"
              aria-modal="true"
              aria-label="Virtual waiting room settings"
              className="relative w-full max-w-lg rounded-[26px] border border-white/15 bg-[#151518] p-6 text-white shadow-2xl sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff8296]">
                    Traffic control
                  </p>

                  <h2 className="mt-3 text-2xl font-semibold">
                    Virtual waiting room
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    {show?.movie?.title ||
                      "Screening"}
                    {" · "}
                    {show?.screen?.name ||
                      "Auditorium"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full border border-white/15 p-2 disabled:opacity-40"
                >
                  <X size={18} />
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
                >
                  {error}

                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() => loadConfig()}
                  >
                    Retry
                  </button>
                </div>
              )}

              {loading && !config ? (
                <div className="mt-8 flex items-center gap-3 text-sm text-zinc-400">
                  <Loader2
                    size={18}
                    className="animate-spin text-[#D71935]"
                  />
                  Loading settings...
                </div>
              ) : config ? (
                <form
                  onSubmit={save}
                  className="mt-8 space-y-5"
                >
                  <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4">
                    <span>
                      <span className="block text-sm font-semibold">
                        Enable waiting room
                      </span>

                      <span className="mt-2 block text-xs leading-5 text-zinc-500">
                        Control access to seat selection
                        during high-demand screenings.
                      </span>
                    </span>

                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      disabled={saving || loading}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          enabled:
                            event.target.checked,
                        }))
                      }
                      className="h-5 w-5 accent-[#D71935]"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                        <Users size={15} />
                        Concurrent admissions
                      </span>

                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        required
                        disabled={saving || loading}
                        value={draft.capacity}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            capacity:
                              event.target.value,
                          }))
                        }
                        className={INPUT}
                      />
                    </label>

                    <label>
                      <span className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                        <Clock3 size={15} />
                        Admission window (seconds)
                      </span>

                      <input
                        type="number"
                        min="60"
                        max="900"
                        step="1"
                        required
                        disabled={saving || loading}
                        value={draft.admissionSeconds}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            admissionSeconds:
                              event.target.value,
                          }))
                        }
                        className={INPUT}
                      />
                    </label>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-[#D71935]/20 bg-[#D71935]/[0.06] p-4">
                    <ShieldCheck
                      size={18}
                      className="mt-0.5 shrink-0 text-[#ff8296]"
                    />

                    <p className="text-xs leading-6 text-zinc-300">
                      Updating settings resets the
                      existing queue and invalidates
                      previous admission tokens.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setOpen(false)}
                      className="rounded-full border border-white/15 px-5 py-3 text-xs font-semibold disabled:opacity-40"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving || loading}
                      className="inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-xs font-semibold hover:bg-[#e82a49] disabled:opacity-40"
                    >
                      {saving && (
                        <Loader2
                          size={15}
                          className="animate-spin"
                        />
                      )}

                      {saving
                        ? "Saving..."
                        : "Save settings"}
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
