
import React, { forwardRef, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1];
const MotionLink = motion(Link);

/**
 * Reveal content once it enters the viewport.
 * Motion is disabled for reduced-motion preferences.
 */
export function CinematicReveal({
  as = "div",
  children,
  className = "",
  delay = 0,
  distance = 24,
  once = true,
  ...rest
}) {
  const reduceMotion = useReducedMotion();
  const MotionElement = motion[as] || motion.div;

  return (
    <MotionElement
      initial={reduceMotion ? false : { opacity: 0, y: distance }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.12 }}
      transition={{ duration: 0.72, delay, ease: EASE }}
      className={className}
      {...rest}
    >
      {children}
    </MotionElement>
  );
}

/**
 * Reusable editorial heading with optional crimson emphasis.
 */
export function CinematicHeading({
  kicker,
  before,
  accent,
  after,
  description,
  as: Tag = "h2",
  className = "",
}) {
  return (
    <div className={`bms-v2-heading ${className}`}>
      {kicker && <p className="bms-v2-heading__kicker">{kicker}</p>}

      <Tag className="bms-v2-heading__title">
        {before}
        {before && accent ? " " : ""}
        {accent && (
          <span className="bms-v2-heading__accent">
            {accent}
          </span>
        )}
        {after && <> {after}</>}
      </Tag>

      {description && (
        <p className="bms-v2-heading__description">
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * Shared visual treatment for native buttons and links.
 * Internal navigation uses React Router.
 */
export const CinematicAction = forwardRef(function CinematicAction(
  {
    children,
    to,
    href,
    variant = "solid",
    className = "",
    disabled = false,
    loading = false,
    type = "button",
    onClick,
    showArrow = true,
    ...rest
  },
  ref
) {
  const reduceMotion = useReducedMotion();
  const blocked = disabled || loading;

  const shared = {
    ref,
    className: `bms-v2-action bms-v2-action--${variant} ${className}`,
    "aria-disabled": blocked || undefined,
    "aria-busy": loading || undefined,
    onClick: (event) => {
      if (blocked) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    },
    whileHover:
      reduceMotion || blocked ? undefined : { y: -2 },
    whileTap:
      reduceMotion || blocked ? undefined : { scale: 0.985 },
    transition: { duration: 0.24, ease: EASE },
    ...rest,
  };

  const content = (
    <>
      <span aria-hidden="true" className="bms-v2-action__sweep" />
      <span className="bms-v2-action__label">
        {loading ? "Please wait…" : children}
      </span>

      {showArrow && (
        <ArrowUpRight
          aria-hidden="true"
          size={17}
          strokeWidth={1.75}
          className="bms-v2-action__arrow"
        />
      )}
    </>
  );

  if (to) {
    return (
      <MotionLink
        {...shared}
        to={to}
        tabIndex={blocked ? -1 : rest.tabIndex}
      >
        {content}
      </MotionLink>
    );
  }

  if (href) {
    return (
      <motion.a
        {...shared}
        href={href}
        tabIndex={blocked ? -1 : rest.tabIndex}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      {...shared}
      type={type}
      disabled={blocked}
    >
      {content}
    </motion.button>
  );
});

/**
 * Pointer-responsive depth for editorial cards.
 * No React state updates are triggered by mouse movement.
 * Do not use tilt effects for payment or critical controls.
 */
export function CinematicPanel({
  children,
  className = "",
  interactive = true,
  as: Tag = "div",
  ...rest
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef(null);

  const reset = () => {
    const panel = panelRef.current;
    if (!panel) return;

    panel.style.setProperty("--bms-rotate-x", "0deg");
    panel.style.setProperty("--bms-rotate-y", "0deg");
    panel.style.setProperty("--bms-spot-x", "50%");
    panel.style.setProperty("--bms-spot-y", "50%");
  };

  const move = (event) => {
    if (
      !interactive ||
      reduceMotion ||
      event.pointerType !== "mouse"
    ) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) return;

    const bounds = panel.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const x = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width)
    );

    const y = Math.max(
      0,
      Math.min(1, (event.clientY - bounds.top) / bounds.height)
    );

    panel.style.setProperty(
      "--bms-rotate-x",
      `${((0.5 - y) * 5).toFixed(2)}deg`
    );

    panel.style.setProperty(
      "--bms-rotate-y",
      `${((x - 0.5) * 5).toFixed(2)}deg`
    );

    panel.style.setProperty(
      "--bms-spot-x",
      `${(x * 100).toFixed(1)}%`
    );

    panel.style.setProperty(
      "--bms-spot-y",
      `${(y * 100).toFixed(1)}%`
    );
  };

  return (
    <Tag
      ref={panelRef}
      onPointerMove={move}
      onPointerLeave={reset}
      className={`bms-v2-panel ${
        interactive ? "bms-v2-panel--interactive" : ""
      } ${className}`}
      {...rest}
    >
      <span
        className="bms-v2-panel__light"
        aria-hidden="true"
      />
      <div className="bms-v2-panel__content">
        {children}
      </div>
    </Tag>
  );
}
