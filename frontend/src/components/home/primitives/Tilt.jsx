
import React from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import cx from "../lib/cx";

/** A 3D tilt toward the pointer with a soft white highlight. Mouse and pen only; off for reduced motion. */
const Tilt = ({ children, className, max = 5, ...rest }) => {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 20, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 180, damping: 20, mass: 0.5 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [max, -max]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [-max, max]);
  const gx = useTransform(sx, [-0.5, 0.5], ["0%", "100%"]);
  const gy = useTransform(sy, [-0.5, 0.5], ["0%", "100%"]);
  const light = useMotionTemplate`radial-gradient(420px circle at ${gx} ${gy}, rgba(255,255,255,0.16), transparent 55%)`;

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
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      {...rest}
    >
      {children}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ backgroundImage: light }}
      />
    </motion.div>
  );
};

export default Tilt;
