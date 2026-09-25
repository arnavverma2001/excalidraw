import { createLook, interpolatePosition, legCycle, stepLook } from "./motion";

import type { LookSample } from "./motion";

const sample = (
  lookX: number,
  patch: Partial<LookSample> = {},
): LookSample => ({
  x: lookX,
  y: 0,
  vx: 280,
  vy: 0,
  facing: 1,
  onGround: true,
  climbing: false,
  ...patch,
});

describe("fancy pants motion", () => {
  it("interpolates visual position between physics steps", () => {
    expect(interpolatePosition({ x: 0, y: 10 }, { x: 8, y: 14 }, 0)).toEqual({
      x: 0,
      y: 10,
    });
    expect(interpolatePosition({ x: 0, y: 10 }, { x: 8, y: 14 }, 1)).toEqual({
      x: 8,
      y: 14,
    });
    const mid = interpolatePosition({ x: 0, y: 10 }, { x: 8, y: 14 }, 0.5);
    expect(mid.x).toBeCloseTo(4);
    expect(mid.y).toBeCloseTo(12);
  });

  it("advances gait phase from distance and keeps joint steps small", () => {
    const look = createLook(0, 0, 1);
    stepLook(look, sample(0, { vx: 0, onGround: true }), 1 / 60);
    const before = look.phase;
    stepLook(look, sample(8), 1 / 60);
    expect(look.phase).toBeGreaterThan(before);
    expect(look.phase - before).toBeCloseTo(8 / 40, 2);

    let prev = legCycle(0).knee;
    for (let i = 1; i <= 24; i++) {
      const knee = legCycle(i / 24).knee;
      expect(Math.abs(knee - prev)).toBeLessThan(0.35);
      prev = knee;
    }
    expect(legCycle(0.5).hip).toBeCloseTo(legCycle(0.5 + 1e-6).hip, 2);
    expect(legCycle(0).hip).toBeGreaterThan(0.2);
    expect(legCycle(0.5).hip).toBeLessThan(-0.3);
    expect(legCycle(0.25).knee).toBeLessThan(legCycle(0.75).knee);
  });

  it("blends into a run instead of switching in one frame", () => {
    const look = createLook(0, 0, 1);
    stepLook(look, sample(4), 1 / 60);
    expect(look.weights.run).toBeGreaterThan(0.1);
    expect(look.weights.run).toBeLessThan(0.45);
    expect(look.weights.idle).toBeGreaterThan(0.5);
  });

  it("plants a supporting foot while the body moves", () => {
    const look = createLook(0, 0, 1);
    let x = 0;
    const stuck: number[][] = [[], []];
    for (let i = 0; i < 80; i++) {
      x += 280 / 60;
      const frame = stepLook(look, sample(x), 1 / 60);
      for (let leg = 0; leg < 2; leg++) {
        if (frame.planted[leg]) {
          stuck[leg].push(frame.footWorldX[leg]);
        } else if (stuck[leg].length) {
          stuck[leg].push(NaN);
        }
      }
    }
    const runs = stuck.map((series) => {
      let best = 0;
      let cur = 0;
      let lo = Infinity;
      let hi = -Infinity;
      let bestSpan = Infinity;
      const flush = () => {
        if (cur > best) {
          best = cur;
          bestSpan = hi - lo;
        }
        cur = 0;
        lo = Infinity;
        hi = -Infinity;
      };
      for (const value of series) {
        if (Number.isNaN(value)) {
          flush();
          continue;
        }
        cur += 1;
        lo = Math.min(lo, value);
        hi = Math.max(hi, value);
      }
      flush();
      return { best, bestSpan };
    });
    const planted = runs.some((run) => run.best >= 2 && run.bestSpan < 1.5);
    expect(planted).toBe(true);
  });

  it("overshoots the hair spring when velocity reverses", () => {
    const look = createLook(0, 0, 1);
    let x = 0;
    for (let i = 0; i < 90; i++) {
      x += 4;
      stepLook(look, sample(x, { vx: 280, facing: 1 }), 1 / 60);
    }
    const trailingLeft = look.hair;
    expect(trailingLeft).toBeLessThan(-40);

    let peak = look.hair;
    for (let i = 0; i < 50; i++) {
      x -= 4;
      const frame = stepLook(look, sample(x, { vx: -280, facing: -1 }), 1 / 60);
      peak = Math.max(peak, frame.spikes[2].angle);
    }
    expect(peak).toBeGreaterThan(70);
    expect(look.hair).toBeGreaterThan(20);
  });

  it("cycles a climb without a joint pop", () => {
    const look = createLook(0, 100, 1);
    let y = 100;
    let prev = 0;
    let seen = false;
    for (let i = 0; i < 40; i++) {
      y -= 170 / 60;
      const frame = stepLook(
        look,
        sample(0, {
          x: 0,
          y,
          vx: 30,
          vy: -170,
          onGround: false,
          climbing: true,
        }),
        1 / 60,
      );
      const knee = frame.legs[0].by;
      if (seen) {
        expect(Math.abs(knee - prev)).toBeLessThan(2.4);
      }
      prev = knee;
      seen = true;
    }
    expect(look.weights.climb).toBeGreaterThan(0.8);
  });
});
