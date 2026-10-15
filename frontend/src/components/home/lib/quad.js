
// Maps a w x h rectangle (an <img> box, say) onto an arbitrary quadrilateral on screen, as a CSS
// matrix3d. The 3D hall uses it to pin the film artwork exactly onto the projected cinema screen,
// so the artwork is a normal DOM image and never needs CORS.
//
// `quad` holds the four corners in pixels, in the order top-left, top-right, bottom-right,
// bottom-left. The element must use transform-origin: 0 0.

export const quadToMatrix3d = (w, h, quad) => {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  // Unit square -> quad (Heckbert). A parallelogram has no perspective terms.
  let g = 0;
  let k = 0;
  if (dx3 !== 0 || dy3 !== 0) {
    const det = dx1 * dy2 - dx2 * dy1;
    if (det === 0) return null;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    k = (dx1 * dy3 - dx3 * dy1) / det;
  }
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + k * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + k * p3.y;
  const f = p0.y;

  // Rescale so the input is element pixels instead of the unit square.
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, c, f, 0, 1];
  if (m.some((v) => !Number.isFinite(v))) return null;
  return `matrix3d(${m.map((v) => +v.toPrecision(12)).join(",")})`;
};

/** Applies the matrix to a point, with the perspective divide. Used by the tests. */
export const applyMatrix3d = (matrix, x, y) => {
  const m = matrix.slice(9, -1).split(",").map(Number);
  const X = m[0] * x + m[4] * y + m[12];
  const Y = m[1] * x + m[5] * y + m[13];
  const W = m[3] * x + m[7] * y + m[15];
  return { x: X / W, y: Y / W };
};
