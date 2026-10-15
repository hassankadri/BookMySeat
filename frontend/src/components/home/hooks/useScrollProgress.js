
import { useEffect } from "react";
import { useMotionValue } from "framer-motion";

/**
 * Scroll progress of an element as a 0 to 1 motion value, always measured from where the element
 * really is. (Framer's own useScroll caches an element's position when it mounts, which goes stale
 * when content above or inside it changes height, as it does once the schedule has loaded.)
 *
 *   progress = (a * viewportHeight - rect.top) / ((a - b) * viewportHeight + rect.height)
 *
 * 0 when the element's top reaches `a` of the way down the viewport; 1 when its bottom reaches `b`.
 *   pinned runway: a = 0, b = 1   (top at the top of the screen, bottom at the bottom of the screen)
 *   passing block: a = 0.85, b = 0.55
 */
const useScrollProgress = (ref, { a = 0, b = 1, enabled = true } = {}) => {
  const value = useMotionValue(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const span = (a - b) * vh + rect.height;
      const p = span > 0 ? (a * vh - rect.top) / span : 0;
      value.set(Math.min(1, Math.max(0, p)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Re-measure when anything changes the page's height (data arriving, fonts loading).
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    if (ref.current) observer.observe(ref.current);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [ref, a, b, enabled, value]);

  return value;
};

export default useScrollProgress;
