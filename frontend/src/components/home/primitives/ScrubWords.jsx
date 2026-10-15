
import React, { useRef } from "react";
import { motion, useReducedMotion, useTransform } from "framer-motion";
import useScrollProgress from "../hooks/useScrollProgress";

const Word = ({ progress, range, children }) => {
  const opacity = useTransform(progress, range, [0.2, 1]);
  return <motion.span style={{ opacity }}>{children}</motion.span>;
};

/**
 * Words brighten from 20% to 100% as the block scrolls through the viewport.
 * Pure scroll-linked opacity, so it costs nothing per frame beyond compositing.
 * With reduced motion every word is simply fully visible.
 */
const ScrubWords = ({ words, className, as: Tag = "div", from = 0.85, to = 0.55 }) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const scrollYProgress = useScrollProgress(ref, { a: from, b: to });
  const count = Math.max(words.length, 1);

  return (
    <Tag ref={ref} className={className}>
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          {index > 0 && " "}
          {reduce ? (
            <span>{word}</span>
          ) : (
            <Word progress={scrollYProgress} range={[(index / count) * 0.85, Math.min(1, ((index + 1) / count) * 0.85 + 0.15)]}>
              {word}
            </Word>
          )}
        </React.Fragment>
      ))}
    </Tag>
  );
};

export default ScrubWords;
