
// Decides whether this visitor gets the real WebGL hall or the CSS-3D one.
// Everything here is a plain function so the rules can be tested.

/** Real WebGL2 support, checked with a throwaway context that is released straight away. */
export const hasWebGL2 = () => {
  try {
    if (typeof window === "undefined" || !window.WebGL2RenderingContext) return false;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
};

export const readDevice = () => ({
  webgl2: hasWebGL2(),
  saveData: Boolean(typeof navigator !== "undefined" && navigator.connection && navigator.connection.saveData),
  cores: (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 0,
});

/**
 * "three" = the real 3D hall. "css" = the CSS-3D hall (same artwork, no WebGL).
 * The CSS hall is used for reduced motion, data saver, no WebGL2, and small phones
 * with few CPU cores, where the real scene would not stay smooth.
 */
export const chooseHallMode = ({ reduce = false, saveData = false, webgl2 = true, cores = 8, narrow = false } = {}) => {
  if (reduce || saveData || !webgl2) return "css";
  if (narrow && cores > 0 && cores <= 4) return "css";
  return "three";
};
