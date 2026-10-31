
import { applyMatrix3d, quadToMatrix3d } from "./quad";

const near = (p, x, y) => {
  expect(p.x).toBeCloseTo(x, 3);
  expect(p.y).toBeCloseTo(y, 3);
};

describe("quadToMatrix3d", () => {
  test("a perspective quad lands every corner of the box exactly on its target", () => {
    const quad = [
      { x: 120, y: 80 },
      { x: 700, y: 140 },
      { x: 660, y: 420 },
      { x: 90, y: 360 },
    ];
    const m = quadToMatrix3d(1100, 500, quad);
    near(applyMatrix3d(m, 0, 0), 120, 80);
    near(applyMatrix3d(m, 1100, 0), 700, 140);
    near(applyMatrix3d(m, 1100, 500), 660, 420);
    near(applyMatrix3d(m, 0, 500), 90, 360);
  });

  test("the centre of the box lands inside the quad", () => {
    const quad = [
      { x: 0, y: 0 },
      { x: 800, y: 100 },
      { x: 760, y: 500 },
      { x: 40, y: 420 },
    ];
    const c = applyMatrix3d(quadToMatrix3d(400, 200, quad), 200, 100);
    expect(c.x).toBeGreaterThan(40);
    expect(c.x).toBeLessThan(800);
    expect(c.y).toBeGreaterThan(0);
    expect(c.y).toBeLessThan(500);
  });

  test("a plain rectangle needs no perspective", () => {
    const quad = [
      { x: 10, y: 20 },
      { x: 510, y: 20 },
      { x: 510, y: 270 },
      { x: 10, y: 270 },
    ];
    const m = quadToMatrix3d(1000, 500, quad);
    near(applyMatrix3d(m, 1000, 500), 510, 270);
    near(applyMatrix3d(m, 500, 250), 260, 145);
    expect(m.split(",")[3]).toBe("0"); // no perspective term
  });

  test("a degenerate quad is rejected instead of producing NaN", () => {
    const p = { x: 5, y: 5 };
    expect(quadToMatrix3d(100, 100, [p, p, p, p])).not.toMatch(/NaN|Infinity/);
    const line = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }];
    expect(() => quadToMatrix3d(100, 100, line)).not.toThrow();
  });
});
