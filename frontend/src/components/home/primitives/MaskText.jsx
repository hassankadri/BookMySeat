
import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * Headline whose words rise out of a mask. Plays once, when it scrolls into view,
 * or immediately with `now`. With reduced motion the text is simply shown.
 * Assistive technology reads the whole headline through aria-label.
 */
const MaskText = ({ text, as: Tag = "h2", className, now = false, delay = 0, id }) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const show = reduce || now || inView;

  return (
    <Tag ref={ref} id={id} className={className} aria-label={text}>
      {text.split(" ").map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          {index > 0 && " "}
          <span aria-hidden="true" className="-mb-[0.14em] -mr-[0.1em] inline-block overflow-hidden pb-[0.14em] pr-[0.1em] align-top">
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

export default MaskText;
