
import React from "react";
import MaskText from "../home/primitives/MaskText";
import cx from "./cx";

/** Big masked headline with an optional line above, a lead paragraph and actions. */
const PageHeader = ({ kicker, title, subtitle, actions, className, size = "xl", as = "h1", align = "left" }) => (
  <header className={cx("mx-auto max-w-[1280px] px-5 pb-10 pt-16 md:px-8 md:pb-14 md:pt-24", align === "center" && "text-center", className)}>
    {kicker && (
      <p className={cx("mb-5 flex items-center gap-3 text-sm text-zinc-400", align === "center" && "justify-center")}>
        <span aria-hidden="true" className="h-px w-8 bg-crimson" />
        {kicker}
      </p>
    )}
    <MaskText
      as={as}
      now
      text={title}
      className={cx(
        "cine-display text-bone",
        size === "xl" && "text-[clamp(3rem,8vw,7.6rem)]",
        size === "lg" && "text-[clamp(2.4rem,5.6vw,5rem)]",
        size === "md" && "text-[clamp(2rem,4vw,3.4rem)]"
      )}
    />
    {(subtitle || actions) && (
      <div className={cx("mt-7 flex flex-wrap items-end justify-between gap-6", align === "center" && "justify-center text-center")}>
        {subtitle && <p className="max-w-xl text-[17px] leading-relaxed text-zinc-400">{subtitle}</p>}
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    )}
  </header>
);

export default PageHeader;
