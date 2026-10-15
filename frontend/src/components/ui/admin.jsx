
import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

import cx from "./cx";
import { CountNum } from "./bits";

// Shared admin design system used by all management pages.
export const adminInput =
  "w-full rounded-2xl border border-white/10 bg-char/70 px-4 py-3.5 text-[15px] text-bone outline-none transition placeholder:text-zinc-600 focus:border-crimson/70 focus:bg-char";

export const th = "px-5 py-4 text-left text-xs font-medium text-zinc-500";
export const td = "px-5 py-4 align-middle";

// =====================================================
// ADMIN PAGE HEADER
// =====================================================

export const AdminHeader = ({ kicker, title, subtitle, actions }) => (
  <motion.header
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, ease: [0.2, 0.7, 0.1, 1] }}
    className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"
  >
    <div className="min-w-0">
      {kicker && (
        <p className="flex items-center gap-3 text-sm text-zinc-500">
          <span aria-hidden="true" className="h-px w-6 bg-crimson" />
          {kicker}
        </p>
      )}
      <h1 className="cine-display mt-3 text-[clamp(2.4rem,5vw,4.6rem)] text-bone">
        {title}
      </h1>
      {subtitle && <p className="mt-4 max-w-xl text-zinc-400">{subtitle}</p>}
    </div>

    {actions && (
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    )}
  </motion.header>
);

// =====================================================
// STATISTICS
// =====================================================

export const AdminStat = ({
  title,
  value,
  subtitle,
  icon: Icon,
  delay = 0,
  tone = "default",
}) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.6, ease: [0.2, 0.7, 0.1, 1] }}
    className="group relative overflow-hidden rounded-3xl border border-white/10 bg-char/60 p-6 transition-colors duration-500 hover:border-crimson/40"
  >
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm text-zinc-400">{title}</p>
      {Icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-crimson/10">
          <Icon className="h-5 w-5 text-crimson" />
        </span>
      )}
    </div>
    <p
      className={cx(
        "cine-display cine-tabular mt-6 text-[clamp(2.2rem,3.4vw,3.2rem)]",
        tone === "crimson" ? "text-crimson" : "text-bone"
      )}
    >
      {typeof value === "number" ? <CountNum value={value} /> : value}
    </p>
    {subtitle && <p className="mt-2 text-xs text-zinc-500">{subtitle}</p>}
  </motion.div>
);

// =====================================================
// SEARCH
// =====================================================

export const AdminSearch = ({
  value,
  onChange,
  placeholder = "Search",
  className,
}) => (
  <div className={cx("relative", className)}>
    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cx(adminInput, "pl-11")}
    />
  </div>
);

// =====================================================
// SEGMENTED FILTER CONTROL
// =====================================================

export const Segmented = ({ value, onChange, options, label }) => (
  <div className="cine-scroll flex gap-2 overflow-x-auto" role="group" aria-label={label}>
    {options.map(([key, text]) => (
      <button
        key={key}
        type="button"
        aria-pressed={value === key}
        onClick={() => onChange(key)}
        className={cx(
          "shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors duration-300",
          value === key
            ? "border-crimson bg-crimson text-white"
            : "border-white/12 text-zinc-300 hover:border-white/40 hover:text-white"
        )}
      >
        {text}
      </button>
    ))}
  </div>
);

// =====================================================
// STATUS INDICATORS
// =====================================================

const TONES = {
  crimson: "border-crimson/40 bg-crimson/10 text-red-300",
  light: "border-white/20 bg-white/10 text-bone",
  mute: "border-white/10 bg-white/[0.03] text-zinc-400",
  good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  warn: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

export const Pill = ({ tone = "mute", children, className }) => (
  <span
    className={cx(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium",
      TONES[tone] || TONES.mute,
      className
    )}
  >
    {children}
  </span>
);

// =====================================================
// TABLE CONTAINER
// =====================================================

export const TableCard = ({ children, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: [0.2, 0.7, 0.1, 1] }}
    className={cx(
      "overflow-hidden rounded-3xl border border-white/10 bg-char/40",
      className
    )}
  >
    <div className="cine-scroll overflow-x-auto">{children}</div>
  </motion.div>
);

// =====================================================
// EMPTY STATE
// =====================================================

export const Empty = ({ icon: Icon, title, body, action }) => (
  <div className="rounded-3xl border border-dashed border-white/12 px-6 py-20 text-center">
    {Icon && <Icon className="mx-auto h-10 w-10 text-zinc-700" />}
    <p className="cine-head mt-5 text-2xl text-bone">{title}</p>
    {body && <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">{body}</p>}
    {action && <div className="mt-6 flex justify-center">{action}</div>}
  </div>
);

// =====================================================
// LOADING STATE
// =====================================================

export const Loading = ({ label = "Loading" }) => (
  <div className="flex items-center justify-center gap-4 py-28 text-zinc-500" role="status">
    <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-crimson" />
    {label}
  </div>
);

// =====================================================
// PAGINATION
// =====================================================

export const Pager = ({ page, pages, onPrev, onNext }) => (
  <div className="mt-6 flex items-center justify-between">
    <p className="cine-tabular text-sm text-zinc-500">
      Page {page} of {pages}
    </p>
    <div className="flex gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={onPrev}
        aria-label="Previous page"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-zinc-300 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={page >= pages}
        onClick={onNext}
        aria-label="Next page"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-zinc-300 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>
);

// =====================================================
// ACCESSIBLE MODAL
// =====================================================

export const AdminModal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}) => {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = [...(dialogRef.current?.querySelectorAll(focusableSelector) || [])]
        .filter((element) => element.getClientRects().length > 0);

      if (!elements.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialogRef.current?.focus();
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-void/85 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose?.();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-label={title}
            className={cx(
              "max-h-[92vh] w-full overflow-y-auto rounded-[1.75rem] border border-white/10 bg-char p-6 outline-none sm:p-8",
              wide ? "max-w-3xl" : "max-w-lg"
            )}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.1, 1] }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="cine-display text-3xl text-bone">{title}</h2>
                {subtitle && (
                  <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-zinc-300 transition hover:border-white/40 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
