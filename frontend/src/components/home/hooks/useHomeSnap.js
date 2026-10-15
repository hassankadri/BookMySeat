
import { useEffect } from "react";

/**
 * Turns proximity scroll snapping on for the homepage only.
 * The CSS (home.css) already limits it to 1024px and wider and to people who have
 * not asked for reduced motion, so this hook only has to add and remove the class.
 * It is removed again on unmount, so no other page is ever affected.
 */
const useHomeSnap = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return undefined;
    const root = document.documentElement;
    root.classList.add("bms-snap");
    return () => root.classList.remove("bms-snap");
  }, [enabled]);
};

export default useHomeSnap;
