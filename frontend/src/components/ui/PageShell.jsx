
import React from "react";
import cx from "./cx";

// The stage every non-homepage page sits on: near-black, a soft crimson light from one edge,
// and a fine film grain. Each page picks a different light direction so no two feel alike.

const GLOWS = {
  top: "radial-gradient(60% 45% at 50% -8%, rgba(215,25,53,.22), transparent 72%)",
  left: "radial-gradient(48% 60% at -4% 18%, rgba(215,25,53,.2), transparent 72%)",
  right: "radial-gradient(48% 60% at 104% 8%, rgba(215,25,53,.2), transparent 72%)",
  bottom: "radial-gradient(60% 40% at 50% 108%, rgba(215,25,53,.2), transparent 72%)",
  twin: "radial-gradient(40% 50% at 0% 0%, rgba(215,25,53,.18), transparent 70%), radial-gradient(40% 50% at 100% 100%, rgba(215,25,53,.14), transparent 70%)",
  none: "none",
};

const PageShell = ({ glow = "top", children, className, testId, as: Tag = "div", ...rest }) => (
  <Tag
    data-testid={testId}
    className={cx("cine-grain relative min-h-screen overflow-x-clip bg-void pt-16 text-bone", className)}
    {...rest}
  >
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[80vh]" style={{ background: GLOWS[glow] || GLOWS.top }} />
    <div className="relative">{children}</div>
  </Tag>
);

export default PageShell;
