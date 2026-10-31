
import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import PageShell from "./PageShell";
import cx from "./cx";

// Frames give each page its own stage without touching the page's own logic or markup.

/** An illustrated auditorium: rows of seats on arcs under a cone of light. Pure SVG. */
export const HallArt = ({ className, lit = true }) => {
  const reduce = useReducedMotion();
  const seats = useMemo(() => {
    const out = [];
    for (let r = 0; r < 8; r += 1) {
      const radius = 210 + r * 46;
      const count = 9 + r * 3;
      const span = 0.9 + r * 0.035;
      for (let i = 0; i < count; i += 1) {
        const a = (i - (count - 1) / 2) * (span / count);
        if (Math.abs(i - (count - 1) / 2) < 0.9) continue; // the aisle
        out.push({ x: 400 + radius * Math.sin(a), y: -40 + radius * Math.cos(a), r, i, a });
      }
    }
    return out;
  }, []);
  return (
    <svg viewBox="0 0 800 640" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D71935" stopOpacity="0.5" />
          <stop offset="1" stopColor="#D71935" stopOpacity="0" />
        </linearGradient>
      </defs>
      {lit && <polygon points="340,0 460,0 760,560 40,560" fill="url(#cone)" opacity="0.55" />}
      <rect x="250" y="18" width="300" height="3" rx="1.5" fill="#F5F5F5" opacity="0.8" />
      {seats.map((s) => (
        <motion.rect
          key={`${s.r}-${s.i}`}
          x={s.x - 9}
          y={s.y - 9}
          width="18"
          height="16"
          rx="5"
          transform={`rotate(${(-s.a * 180) / Math.PI} ${s.x} ${s.y})`}
          fill="#F5F5F5"
          initial={{ opacity: 0 }}
          animate={{ opacity: Math.max(0.05, 0.5 - s.r * 0.055) }}
          transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : s.r * 0.12 + (s.i % 5) * 0.02 }}
        />
      ))}
    </svg>
  );
};

const STEPS = ["Cinema", "Film", "Seats", "Payment", "Ticket"];

/** Where you are in booking: cinema, film, seats, payment, ticket. */
export const StepTracker = ({ current }) => (
  <nav aria-label="Booking progress">
    <ol className="flex items-center gap-2 text-sm sm:gap-3">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const here = n === current;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3" aria-current={here ? "step" : undefined}>
            <span
              className={cx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                here && "border-crimson bg-crimson text-white",
                done && "border-white/30 bg-white/10 text-white",
                !here && !done && "border-white/10 text-zinc-600"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={cx("hidden sm:inline", here ? "text-white" : done ? "text-zinc-400" : "text-zinc-600")}>{label}</span>
            {n < STEPS.length && <span aria-hidden="true" className={cx("h-px w-4 sm:w-8", done ? "bg-white/30" : "bg-white/10")} />}
          </li>
        );
      })}
    </ol>
  </nav>
);

/** Booking flow pages: a step tracker above the page's own content, on a crimson-lit stage. */
export const FlowFrame = ({ step, glow = "top", children }) => (
  <PageShell glow={glow}>
    <div className="mx-auto max-w-[1280px] px-5 pt-8 md:px-8">
      <StepTracker current={step} />
    </div>
    <div className="[&>div]:!min-h-0 [&>div]:!bg-transparent [&>div]:!pt-8">{children}</div>
  </PageShell>
);

/** Sign in: the illustrated hall fills the page behind the form. */
export const AuthFrame = ({ children }) => (
  <div className="cine-grain relative min-h-screen overflow-hidden bg-void pt-16 text-bone">
    <div aria-hidden="true" className="absolute inset-0" style={{ background: "radial-gradient(60% 55% at 50% 0%, rgba(215,25,53,.26), transparent 72%)" }} />
    <HallArt className="absolute inset-x-0 top-0 h-[120%] w-full opacity-80" />
    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-void/10 via-void/55 to-void" />
    <div className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center px-4 py-10 [&>div]:!min-h-0 [&>div]:!bg-transparent [&>div]:!pt-0">{children}</div>
  </div>
);

/** The assistant: a slow, breathing light behind the conversation. */
export const AssistantFrame = ({ children }) => {
  const reduce = useReducedMotion();
  return (
    <PageShell glow="bottom">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 flex h-[70vh] justify-center overflow-hidden">
        <motion.div
          className="mt-10 h-[520px] w-[520px] rounded-full bg-crimson/20 blur-[120px]"
          animate={reduce ? undefined : { scale: [1, 1.18, 1], opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="relative [&>div]:!min-h-0 [&>div]:!bg-transparent">{children}</div>
    </PageShell>
  );
};
