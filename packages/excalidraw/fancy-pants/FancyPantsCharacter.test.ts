import { PANTS } from "./FancyPantsCharacter";

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
});
