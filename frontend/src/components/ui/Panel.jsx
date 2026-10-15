
import React from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import cx from "./cx";

/** A charcoal surface. With `spot`, its surface and edge light up in crimson under the cursor. */
const Panel = ({ children, className, spot = false, as: Tag = "div", ...rest }) => {
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const surface = useMotionTemplate`radial-gradient(360px circle at ${x}px ${y}px, rgba(215,25,53,0.13), transparent 62%)`;
  const edge = useMotionTemplate`radial-gradient(220px circle at ${x}px ${y}px, rgba(215,25,53,0.8), transparent 66%)`;
  const move = (event) => {
    if (!spot) return;
    const r = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - r.left);
    y.set(event.clientY - r.top);
  };
  return (
    <Tag
      onPointerMove={move}
      className={cx("group/panel relative overflow-hidden rounded-3xl border border-white/10 bg-char/70 backdrop-blur-sm", className)}
      {...rest}
    >
      {spot && (
        <>
          <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/panel:opacity-100" style={{ background: surface }} />
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] p-px opacity-0 transition-opacity duration-500 group-hover/panel:opacity-100"
            style={{ background: edge, WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }}
          />
        </>
      )}
      <div className="relative">{children}</div>
    </Tag>
  );
};

export default Panel;
