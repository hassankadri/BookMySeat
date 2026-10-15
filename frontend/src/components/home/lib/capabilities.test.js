
import { chooseHallMode } from "./capabilities";

describe("chooseHallMode", () => {
  test("a capable desktop gets the real 3D hall", () => {
    expect(chooseHallMode({ webgl2: true, cores: 8 })).toBe("three");
  });
  test("reduced motion, data saver and missing WebGL2 all use the CSS hall", () => {
    expect(chooseHallMode({ reduce: true })).toBe("css");
    expect(chooseHallMode({ saveData: true })).toBe("css");
    expect(chooseHallMode({ webgl2: false })).toBe("css");
  });
  test("a small phone with few cores uses the CSS hall, a strong phone does not", () => {
    expect(chooseHallMode({ narrow: true, cores: 4 })).toBe("css");
    expect(chooseHallMode({ narrow: true, cores: 8 })).toBe("three");
  });
  test("a desktop with few cores still gets 3D, and an unknown core count is not penalised", () => {
    expect(chooseHallMode({ narrow: false, cores: 2 })).toBe("three");
    expect(chooseHallMode({ narrow: true, cores: 0 })).toBe("three");
  });
});
