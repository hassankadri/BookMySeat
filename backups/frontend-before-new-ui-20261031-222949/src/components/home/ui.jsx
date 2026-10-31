
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

// =====================================================
// HELPERS
// =====================================================

export const cx = (...items) => items.filter(Boolean).join(" ");

/**
 * Photography used only where the live data has nothing to show
 * (an empty schedule, a cinema without a cover image).
 * Swap these three URLs for your own photos at any time.
 */
export const IMAGES = {
  screen:
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1800&q=70",
  hall: "https://images.unsplash.com/photo-1517604931442-7e0c8ed0963c?auto=format&fit=crop&w=1600&q=70",
  lobby:
    "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1800&q=70",
};

export const formatShowTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(date);
};

export const formatClock = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
};

export const formatDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
};

export const getYoutubeId = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").slice(0, 11);
    }
    const videoId = parsed.searchParams.get("v");
    if (videoId) return videoId.slice(0, 11);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const embedIndex = parts.findIndex((part) => part === "embed");
    if (embedIndex !== -1 && parts[embedIndex + 1]) {
      return parts[embedIndex + 1].slice(0, 11);
    }
  } catch {
    return null;
  }
  return null;
};

export const useMedia = (query) => {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
};

// =====================================================
// IMAGES
// =====================================================

// "relative" is only added when the caller has not positioned the box itself,
// otherwise it would silently override an `absolute inset-0` fill.
const placed = (className) => (/(^|\s)(absolute|fixed|sticky)(\s|$)/.test(className || "") ? "" : "relative");

export const Photo = ({ src, alt = "", className, imgClassName, eager = false }) => {
  const [ok, setOk] = useState(Boolean(src));
  useEffect(() => setOk(Boolean(src)), [src]);
  return (
    <div className={cx(placed(className), "overflow-hidden bg-panel", className)}>
      {ok && (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={() => setOk(false)}
          className={cx("h-full w-full object-cover", imgClassName)}
        />
      )}
    </div>
  );
};

export const Poster = ({ movie, className, eager = false }) => {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [movie?.poster]);
  const ok = Boolean(movie?.poster) && !bad;
  return (
    <div className={cx(placed(className), "overflow-hidden bg-panel", className)}>
      {ok ? (
        <img
          src={movie.poster}
          alt={`${movie.title} poster`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={() => setBad(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-end bg-[linear-gradient(160deg,#313137,#0b0b0d_72%)] p-4">
          <span className="font-display text-xl font-semibold leading-tight text-beam/90">
            {movie?.title}
          </span>
        </div>
      )}
    </div>
  );
};

export const Skeleton = ({ className }) => (
  <div className={cx("animate-pulse rounded-2xl bg-beam/[0.06]", className)} />
);

// =====================================================
// BUTTONS
// =====================================================

const Roll = ({ children }) => (
  <span className="relative block overflow-hidden">
    <span className="block transition-transform duration-500 ease-roll group-hover:-translate-y-full group-focus-visible:-translate-y-full">
      {children}
    </span>
    <span
      aria-hidden="true"
      className="absolute inset-0 block translate-y-full transition-transform duration-500 ease-roll group-hover:translate-y-0 group-focus-visible:translate-y-0"
    >
      {children}
    </span>
  </span>
);

export const Cta = ({ to, href, variant = "solid", size = "md", className, children, ...rest }) => {
  const sizes = {
    sm: "h-10 px-5 text-sm",
    md: "h-12 px-7 text-[15px]",
    lg: "h-14 px-9 text-base",
  };
  const variants = {
    solid:
      "notch bg-aisle text-hall font-semibold hover:bg-[#ffffff] hover:shadow-[0_14px_44px_-12px_rgba(237,237,238,.75)]",
    line: "rounded-full border border-beam/25 text-beam hover:border-beam/60 hover:bg-beam/[0.06]",
    quiet: "rounded-full text-beam/75 hover:text-beam",
  };
  const classes = cx(
    "group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium outline-none transition-[transform,background-color,border-color,color,box-shadow] duration-300 active:scale-[.97] disabled:pointer-events-none disabled:opacity-50",
    sizes[size],
    variants[variant],
    className
  );
  const label = typeof children === "string" ? <Roll>{children}</Roll> : children;
  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {label}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {label}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {label}
    </button>
  );
};

/** Pulls its content gently toward the pointer. Desktop and pen only. */
export const Magnetic = ({ children, strength = 0.28, className }) => {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });
  const onMove = (event) => {
    if (reduce || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  return (
    <motion.div
      className={cx("inline-block", className)}
      style={{ x: sx, y: sy }}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
    </motion.div>
  );
};

// =====================================================
// TYPE MOTION
// =====================================================

/** Headline whose words rise out of a mask. Triggered on view, or on mount. */
export const Words = ({ text, as: Tag = "h2", className, now = false, delay = 0, id }) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const show = reduce || now || inView;
  return (
    <Tag ref={ref} id={id} className={className} aria-label={text}>
      {text.split(" ").map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          {index > 0 && " "}
          <span
            aria-hidden="true"
            className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-top"
          >
            <motion.span
              className="inline-block will-change-transform"
              initial={reduce ? false : { y: "112%" }}
              animate={{ y: show ? "0%" : "112%" }}
              transition={{ duration: 0.85, delay: delay + index * 0.055, ease: [0.2, 0.7, 0.1, 1] }}
            >
              {word}
            </motion.span>
          </span>
        </React.Fragment>
      ))}
    </Tag>
  );
};

// =====================================================
// DEPTH
// =====================================================

/** 3D tilt that follows the pointer, with a moving highlight. */
export const Tilt = ({ children, className, max = 8, glare = true, ...rest }) => {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 20, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 180, damping: 20, mass: 0.5 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [max, -max]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [-max, max]);
  const gx = useTransform(sx, [-0.5, 0.5], ["0%", "100%"]);
  const gy = useTransform(sy, [-0.5, 0.5], ["0%", "100%"]);
  const light = useMotionTemplate`radial-gradient(520px circle at ${gx} ${gy}, rgba(255,255,255,0.14), transparent 55%)`;

  const onMove = (event) => {
    if (reduce || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left) / rect.width - 0.5);
    y.set((event.clientY - rect.top) / rect.height - 0.5);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      className={cx("group relative", className)}
      style={{ rotateX, rotateY, transformPerspective: 1100, transformStyle: "preserve-3d" }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      {...rest}
    >
      {children}
      {glare && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ backgroundImage: light }}
        />
      )}
    </motion.div>
  );
};

/** Card with a cursor-lit surface and border. */
export const Spot = ({ children, className, ...rest }) => {
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const surface = useMotionTemplate`radial-gradient(380px circle at ${x}px ${y}px, rgba(237,237,238,0.12), transparent 62%)`;
  const edge = useMotionTemplate`radial-gradient(240px circle at ${x}px ${y}px, rgba(237,237,238,0.7), transparent 66%)`;
  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - rect.left);
    y.set(event.clientY - rect.top);
  };
  return (
    <div
      onPointerMove={onMove}
      className={cx(
        "group relative overflow-hidden rounded-[28px] border border-beam/10 bg-panel/60",
        className
      )}
      {...rest}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: surface }}
      />
      <motion.div
        aria-hidden="true"
        className="ring-mask pointer-events-none absolute inset-0 rounded-[inherit] p-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: edge }}
      />
      {children}
    </div>
  );
};

/** Wordmark and mark used by the navbar and footer. */
export const LogoMark = ({ className = "h-8 w-8" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
    <path d="M3.5 12.5C7 7.2 11.4 4.8 16 4.8s9 2.4 12.5 7.7" stroke="#bfbfc5" strokeWidth="1.8" strokeLinecap="round" />
    <path
      d="M9 27.2v-8.1a3.2 3.2 0 0 1 3.2-3.2h7.6a3.2 3.2 0 0 1 3.2 3.2v8.1"
      stroke="#ededee"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <rect x="6.6" y="19.6" width="3.4" height="7.6" rx="1.7" fill="#ededee" />
    <rect x="22" y="19.6" width="3.4" height="7.6" rx="1.7" fill="#ededee" />
    <rect x="11.2" y="10.4" width="9.6" height="4.6" rx="2.3" fill="#f5f5f5" />
  </svg>
);
