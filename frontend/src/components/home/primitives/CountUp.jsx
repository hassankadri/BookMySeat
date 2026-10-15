
import React, { useEffect, useMemo, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

/**
 * Counts from 0 to `value` once, the first time it is on screen.
 * The animated digits are hidden from assistive technology; a plain copy of the final
 * number is exposed instead. With reduced motion the final number is shown at once.
 * Text is updated directly in the DOM, so counting never re-renders React.
 */
const CountUp = ({ value, duration = 1.2, className }) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const nf = useMemo(() => new Intl.NumberFormat("en-IN"), []);

  useEffect(() => {
    if (!inView || reduce) return undefined;
    const controls = animate(0, value, {
      duration,
      ease: [0.2, 0.7, 0.1, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = nf.format(Math.round(latest));
      },
      onComplete: () => {
        if (ref.current) ref.current.textContent = nf.format(value);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, duration, nf]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true">
        {nf.format(reduce ? value : 0)}
      </span>
      <span className="bms-sr">{nf.format(value)}</span>
    </span>
  );
};

export default CountUp;
