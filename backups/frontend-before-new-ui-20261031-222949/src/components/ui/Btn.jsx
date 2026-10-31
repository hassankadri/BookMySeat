
import React from "react";
import { Link } from "react-router-dom";
import cx from "./cx";

const VARIANTS = {
  primary: "bg-crimson text-white hover:bg-crimson-hot hover:shadow-[0_16px_44px_-14px_rgba(215,25,53,.8)]",
  light: "bg-bone text-void hover:bg-white",
  line: "border border-white/15 text-bone hover:border-white/50 hover:bg-white/[0.05]",
  quiet: "text-zinc-300 hover:text-white",
  danger: "border border-crimson/50 text-red-400 hover:bg-crimson/10",
};
const SIZES = { sm: "h-10 px-5 text-sm", md: "h-12 px-7 text-[15px]", lg: "h-14 px-9 text-base" };

const Roll = ({ children }) => (
  <span className="relative block overflow-hidden">
    <span className="block transition-transform duration-500 ease-roll group-hover:-translate-y-full group-focus-visible:-translate-y-full">{children}</span>
    <span aria-hidden="true" className="absolute inset-0 block translate-y-full transition-transform duration-500 ease-roll group-hover:translate-y-0 group-focus-visible:translate-y-0">{children}</span>
  </span>
);

/** Router link when `to` is set, anchor when `href` is set, button otherwise. */
const Btn = ({ to, href, variant = "primary", size = "md", className, children, roll = true, ...rest }) => {
  const cls = cx(
    "group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold outline-none",
    "transition-[transform,background-color,border-color,color,box-shadow] duration-300 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
    SIZES[size],
    VARIANTS[variant],
    className
  );
  const label = roll && typeof children === "string" ? <Roll>{children}</Roll> : children;
  if (to) return <Link to={to} className={cls} {...rest}>{label}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{label}</a>;
  return <button type="button" className={cls} {...rest}>{label}</button>;
};

export default Btn;
