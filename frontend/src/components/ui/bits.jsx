
import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import cx from "./cx";
import Btn from "./Btn";

export const inputCls =
  "w-full rounded-2xl border border-white/10 bg-char/70 px-4 py-3.5 text-[15px] text-bone outline-none transition placeholder:text-zinc-600 focus:border-crimson/70 focus:bg-char";

export const Skeleton = ({ className }) => <div aria-hidden="true" className={cx("cine-skeleton rounded-2xl", className)} />;

/** Fades up once as it scrolls into view. Plain with reduced motion. */
export const Reveal = ({ children, delay = 0, className, y = 22 }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.7, 0.1, 1] }}
    >
      {children}
    </motion.div>
  );
};

export const Chip = ({ active, children, className, ...rest }) => (
  <button
    type="button"
    aria-pressed={active}
    className={cx(
      "rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-300 outline-none",
      active ? "border-crimson bg-crimson text-white" : "border-white/12 text-zinc-300 hover:border-white/40 hover:text-white",
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

export const EmptyState = ({ title, body, action }) => (
  <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-char/50 px-8 py-14 text-center">
    <p className="cine-head text-2xl text-bone">{title}</p>
    {body && <p className="mt-3 text-zinc-400">{body}</p>}
    {action && <div className="mt-7 flex justify-center">{action}</div>}
  </div>
);

export const ErrorState = ({ title = "Something went wrong", body, onRetry }) => (
  <EmptyState title={title} body={body} action={onRetry ? <Btn onClick={onRetry} variant="line">Try again</Btn> : null} />
);

/** Film poster with a dark typographic fallback, so a broken URL never shows a broken image. */
export const FilmPoster = ({ src, title, className, imgClassName }) => {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  return (
    <div className={cx("relative overflow-hidden bg-char", className)}>
      {src && !bad ? (
        <img src={src} alt={title ? `${title} poster` : ""} loading="lazy" decoding="async" draggable={false} onError={() => setBad(true)} className={cx("h-full w-full object-cover", imgClassName)} />
      ) : (
        <div className="flex h-full w-full items-end bg-[linear-gradient(160deg,#2a2a31,#080809_78%)] p-4">
          <span className="cine-head text-lg leading-tight text-bone/90">{title}</span>
        </div>
      )}
    </div>
  );
};

export const Stat = ({ value, label }) => (
  <div>
    <p className="cine-display cine-tabular text-[clamp(2.2rem,4vw,3.4rem)] text-bone">{value}</p>
    <p className="mt-1 text-sm text-zinc-400">{label}</p>
  </div>
);

/** Counts up to `value` once when first seen. Screen readers get the final number. */
export const CountNum = ({ value, className, prefix = "" }) => {
  const reduce = useReducedMotion();
  const ref = React.useRef(null);
  const nf = React.useMemo(() => new Intl.NumberFormat("en-IN"), []);
  const target = Number(value) || 0;
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return undefined;
    let frame = 0;
    let started = false;
    const run = () => {
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / 1100);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + nf.format(Math.round(target * eased));
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) {
        started = true;
        run();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target, reduce, nf, prefix]);
  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true">{prefix + nf.format(reduce ? target : 0)}</span>
      <span className="sr-only">{prefix + nf.format(target)}</span>
    </span>
  );
};
