
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import copy from "../copy";
import useMedia from "../hooks/useMedia";
import useScrollProgress from "../hooks/useScrollProgress";
import Button from "../primitives/Button";
import MaskText from "../primitives/MaskText";

// For people who do not know what to watch. The only white surface on the page.
// The four prompts are the assistant's own examples, shown as text: the assistant page cannot be
// pre-filled yet, so the one real control is "Open the assistant".

const Content = ({ reduce }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setI((n) => (n + 1) % copy.ask.prompts.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [reduce]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 md:px-10">
      <MaskText id="ask-title" text={copy.ask.heading} className="bms-display bms-on-paper text-[clamp(3rem,8.6vw,9rem)]" />
      <div className="mt-8 h-[2.6em] overflow-hidden text-[clamp(1.5rem,3.2vw,3rem)] leading-[1.3]" aria-live="off" data-testid="ask-prompt">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={i}
            className="font-display font-semibold tracking-[-0.02em] text-[#5a5a5a] [font-variation-settings:'wdth'_92,'opsz'_48]"
            initial={reduce ? false : { y: "70%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: "-70%", opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.1, 1] }}
          >
            {`\u201C${copy.ask.prompts[i]}\u201D`}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mt-6">
        <Button to="/ai-search" variant="inverse" size="lg" data-testid="ask-open">
          {copy.ask.action}
        </Button>
      </div>
    </div>
  );
};

const Ask = () => {
  const reduce = useReducedMotion();
  const desktop = useMedia("(min-width: 1024px)");
  const pinned = desktop && !reduce;

  const section = useRef(null);
  const scrolled = useScrollProgress(section, { a: 0, b: 1, enabled: pinned });
  const still = useMotionValue(0.5);
  const p = pinned ? scrolled : still;
  // The card opens from a rounded frame to full-bleed, holds, then closes to a thin line.
  const clip = useTransform(
    p,
    [0, 0.32, 0.8, 1],
    [
      "inset(9% 14% 9% 14% round 32px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(49.6% 8% 49.6% 8% round 0px)",
    ]
  );

  if (!pinned) {
    return (
      <section id="ask" aria-labelledby="ask-title" className="bg-ink px-3 sm:px-4" data-testid="ask">
        <div className="flex min-h-[80svh] items-center rounded-[28px] bg-paper py-20 text-ink">
          <Content reduce={reduce} />
        </div>
      </section>
    );
  }

  return (
    <section ref={section} id="ask" aria-labelledby="ask-title" className="relative h-[200svh] bg-ink" data-testid="ask">
      {/* Snap point: the frame is fully open here. */}
      <div aria-hidden="true" className="bms-snap-start pointer-events-none absolute left-0 top-[32svh] h-px w-px" />
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <motion.div className="flex h-full w-full items-center bg-paper text-ink" style={{ clipPath: clip }}>
          <Content reduce={reduce} />
        </motion.div>
      </div>
    </section>
  );
};

export default Ask;
