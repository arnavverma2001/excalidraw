import {
  PANT_HALF_ANKLE,
  PANT_HALF_HIP,
  PANT_HALF_KNEE,
  PANTS,
  pantPolygon,
} from "./FancyPantsCharacter";

describe("fancy pants character colors", () => {
  it("uses a solid orange for the pants", () => {
    expect(PANTS).toBe("#ff6b1a");

    const n = parseInt(PANTS.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;

    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(170);
    expect(b).toBeLessThan(80);
  });

  it("fills a closed pant shape wide enough to cover the ink legs", () => {
    expect(PANT_HALF_HIP).toBeGreaterThanOrEqual(4);
    expect(PANT_HALF_KNEE).toBeGreaterThanOrEqual(3.5);
    expect(PANT_HALF_ANKLE).toBeGreaterThanOrEqual(3);

    const points = pantPolygon({
      ax: 13,
      ay: 28,
      bx: 13,
      by: 35,
      cx: 13,
      cy: 42,
      dx: 16,
      dy: 42,
    })
      .split(" ")
      .map((pair) => pair.split(",").map(Number));

    expect(points).toHaveLength(6);
    const xs = points.map(([x]) => x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(6);
  });
});
