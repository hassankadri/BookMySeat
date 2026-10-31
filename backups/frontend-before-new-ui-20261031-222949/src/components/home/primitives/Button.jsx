
import React from "react";
import { Link } from "react-router-dom";
import cx from "../lib/cx";

// Monochrome buttons.
//   solid   white on black         (primary)
//   line    1px outline            (secondary)
//   quiet   text only
//   inverse black on white         (primary, for use on the white card)
const VARIANTS = {
  solid: "bg-paper text-ink hover:bg-[#e6e6e6]",
  line: "border border-line-strong text-paper hover:border-paper",
  quiet: "text-soft hover:text-paper",
  inverse: "bg-ink text-paper hover:bg-[#262626]",
};

const SIZES = {
  sm: "h-10 px-5 text-sm",
  md: "h-12 px-7 text-[15px]",
  lg: "h-14 px-9 text-base",
};

/** The label slides up and is replaced by a copy of itself, on hover and keyboard focus. */
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

/**
 * Renders a router Link when `to` is given, an anchor when `href` is given,
 * and a button otherwise. Extra props (onClick, disabled, data-testid, ...) pass through.
 */
const Button = ({ to, href, variant = "solid", size = "md", className, children, ...rest }) => {
  const classes = cx(
    "group relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-semibold",
    "outline-none transition-[transform,background-color,border-color,color] duration-300",
    "focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
    SIZES[size],
    VARIANTS[variant],
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

export default Button;
