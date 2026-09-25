import {
  STRIDE,
  createLook,
  flightStage,
  interpolatePosition,
  legCycle,
  stepLook,
} from "./motion";

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
    expect(look.phase - before).toBeCloseTo(8 / STRIDE, 2);

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
    const planted = runs.some((run) => run.best >= 4 && run.bestSpan < 1.5);
    expect(planted).toBe(true);

    let split = false;
    let bothPlanted = 0;
    let bothAir = 0;
    x = 0;
    const again = createLook(0, 0, 1);
    for (let i = 0; i < 80; i++) {
      x += 280 / 60;
      const frame = stepLook(again, sample(x), 1 / 60);
      if (frame.planted[0] && frame.planted[1]) {
        bothPlanted += 1;
      }
      const down = frame.legs.filter((leg) => leg.cy > 41.5).length;
      if (i > 18 && down === 0) {
        bothAir += 1;
      }
      if (frame.planted[0] !== frame.planted[1]) {
        const stance = frame.planted[0] ? 0 : 1;
        const swing = 1 - stance;
        if (frame.legs[stance].cy > 41.5 && frame.legs[swing].cy < 36) {
          split = true;
        }
      }
    }
    expect(split).toBe(true);
    expect(bothPlanted).toBe(0);
    expect(bothAir).toBe(0);
  });

  it("eases a turn instead of mirroring in one frame", () => {
    const look = createLook(0, 0, 1);
    let x = 0;
    for (let i = 0; i < 20; i++) {
      x += 4;
      stepLook(look, sample(x, { vx: 280, facing: 1 }), 1 / 60);
    }
    expect(look.face).toBeGreaterThan(0.9);

    const faces: number[] = [];
    const footX: number[] = [];
    const frames: ReturnType<typeof stepLook>[] = [];
    const phaseAtTurn = look.phase;
    let phaseMid = phaseAtTurn;
    for (let i = 0; i < 24; i++) {
      x -= 4;
      const frame = stepLook(look, sample(x, { vx: -280, facing: -1 }), 1 / 60);
      faces.push(look.face);
      footX.push(frame.legs[0].cx);
      frames.push(frame);
      if (i === 12) {
        phaseMid = look.phase;
      }
    }

    expect(Math.abs(phaseMid - phaseAtTurn)).toBeLessThan(0.02);
    expect(faces[0]).toBeGreaterThan(0.7);
    expect(faces.some((face) => Math.abs(face) < 0.35)).toBe(true);
    expect(faces[faces.length - 1]).toBeLessThan(-0.85);
    expect(
      frames.some(
        (frame) =>
          Math.abs(frame.lean) > 18 &&
          frame.compress > 0.2 &&
          frame.legs[0].cy > 40 &&
          frame.legs[1].cy > 40,
      ),
    ).toBe(true);
    expect(
      frames.some(
        (frame) =>
          Math.abs(frame.legs[0].cx - 13) < 4 &&
          Math.abs(frame.legs[1].cx - 13) < 4 &&
          Math.abs(frame.eyeX - frame.headX) < 0.8,
      ),
    ).toBe(true);
    let maxStep = 0;
    for (let i = 1; i < faces.length; i++) {
      maxStep = Math.max(maxStep, Math.abs(faces[i] - faces[i - 1]));
    }
    expect(maxStep).toBeLessThan(0.4);
    let maxFoot = 0;
    for (let i = 1; i < footX.length; i++) {
      maxFoot = Math.max(maxFoot, Math.abs(footX[i] - footX[i - 1]));
    }
    expect(maxFoot).toBeLessThan(8);
  });

  it("keeps hair in world space and overshoots a reversal", () => {
    const look = createLook(0, 0, 1);
    let x = 0;
    let prevHair = look.hair;
    let maxStep = 0;
    for (let i = 0; i < 90; i++) {
      x += 4;
      stepLook(look, sample(x, { vx: 280, facing: 1 }), 1 / 60);
      maxStep = Math.max(maxStep, Math.abs(look.hair - prevHair));
      prevHair = look.hair;
    }
    expect(look.hair).toBeLessThan(-40);
    expect(look.spike[2]).toBeLessThan(-20);

    for (let i = 0; i < 8; i++) {
      x -= 4;
      stepLook(look, sample(x, { vx: -280, facing: -1 }), 1 / 60);
      maxStep = Math.max(maxStep, Math.abs(look.hair - prevHair));
      prevHair = look.hair;
    }
    expect(look.hair).toBeLessThan(-10);
    expect(look.spike[2]).toBeLessThan(0);

    let peak = look.hair;
    for (let i = 0; i < 72; i++) {
      x -= 4;
      stepLook(look, sample(x, { vx: -280, facing: -1 }), 1 / 60);
      maxStep = Math.max(maxStep, Math.abs(look.hair - prevHair));
      prevHair = look.hair;
      peak = Math.max(peak, look.hair);
    }
    expect(maxStep).toBeLessThan(20);
    expect(look.hair).toBeGreaterThan(20);
    expect(peak).toBeGreaterThan(look.hair + 8);

    for (let i = 0; i < 90; i++) {
      stepLook(look, sample(x, { vx: 0, facing: -1 }), 1 / 60);
    }
    expect(Math.abs(look.hair)).toBeLessThan(18);
  });

  it("selects distinct takeoff, ascent, apex, fall, and reach stages", () => {
    expect(flightStage(0.04, -620)).toBe("crouch");
    expect(flightStage(0.13, -400)).toBe("extend");
    expect(flightStage(0.2, -180)).toBe("rise");
    expect(flightStage(0.32, 20)).toBe("apex");
    expect(flightStage(0.45, 260)).toBe("fall");
    expect(flightStage(0.58, 500)).toBe("reach");
  });

  it("crouches, extends, reaches, and compresses through a jump", () => {
    const look = createLook(0, 0, 1);
    let x = 40;
    for (let i = 0; i < 24; i++) {
      x += 4;
      stepLook(look, sample(x, { vx: 280, onGround: true, vy: 0 }), 1 / 60);
    }

    const legLen = (index: number, frame: ReturnType<typeof stepLook>) => {
      const leg = frame.legs[index];
      return Math.hypot(leg.cx - leg.ax, leg.cy - leg.ay);
    };
    const frames: ReturnType<typeof stepLook>[] = [];
    let y = 0;
    let vy = -680;
    for (let i = 0; i < 34; i++) {
      y += vy / 60;
      frames.push(
        stepLook(
          look,
          sample(x, { x, y, vx: 40, vy, onGround: false, facing: 1 }),
          1 / 60,
        ),
      );
      vy += 2800 / 60;
    }

    let maxPoint = 0;
    for (let i = 1; i < frames.length; i++) {
      for (let leg = 0; leg < 2; leg++) {
        const prev = frames[i - 1].legs[leg];
        const next = frames[i].legs[leg];
        for (const key of ["bx", "by", "cx", "cy"] as const) {
          const dx = key === "bx" || key === "cx" ? next[key] - prev[key] : 0;
          const dy = key === "by" || key === "cy" ? next[key] - prev[key] : 0;
          maxPoint = Math.max(maxPoint, Math.hypot(dx, dy));
        }
      }
    }
    expect(maxPoint).toBeLessThan(2.6);

    const lengthAt = (index: number) =>
      (legLen(0, frames[index]) + legLen(1, frames[index])) / 2;
    const early = Math.min(...[2, 3, 4, 5, 6].map(lengthAt));
    const ascent = Math.max(...[9, 10, 11, 12, 13].map(lengthAt));
    expect(ascent).toBeGreaterThan(early + 1.5);

    const footY = (index: number) =>
      (frames[index].legs[0].cy + frames[index].legs[1].cy) / 2;
    const apex = frames.reduce(
      (best, _, index) =>
        Math.abs(-680 + index * (2800 / 60)) <
        Math.abs(-680 + best * (2800 / 60))
          ? index
          : best,
      0,
    );
    const late = frames.length - 1;
    expect(footY(late)).toBeGreaterThan(footY(apex) + 2);

    const landing = [
      stepLook(
        look,
        sample(x, { x, y: 0, vx: 180, vy: 0, onGround: true, facing: 1 }),
        1 / 60,
      ),
    ];
    expect(landing[0].compress).toBeGreaterThan(0.05);
    expect(landing[0].compress).toBeLessThan(0.4);
    for (let i = 0; i < 18; i++) {
      x += 3;
      landing.push(
        stepLook(
          look,
          sample(x, { x, y: 0, vx: 180, vy: 0, onGround: true, facing: 1 }),
          1 / 60,
        ),
      );
    }
    const peak = Math.max(
      ...landing.slice(0, 10).map((frame) => frame.compress),
    );
    expect(peak).toBeGreaterThan(0.8);
    expect(
      landing.filter((frame) => frame.compress > 0.45).length,
    ).toBeGreaterThan(3);
    expect(landing[landing.length - 1].compress).toBeLessThan(0.15);
  });

  it("cycles a climb without a joint pop", () => {
    const look = createLook(0, 100, 1);
    let y = 100;
    let prev = 0;
    let seen = false;
    let armOrderChanges = 0;
    let previousOrder = 0;
    for (let i = 0; i < 120; i++) {
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
      const order = Math.sign(frame.arms[0].cy - frame.arms[1].cy);
      if (previousOrder && order && order !== previousOrder) {
        armOrderChanges += 1;
      }
      if (order) {
        previousOrder = order;
      }
    }
    expect(look.weights.climb).toBeGreaterThan(0.8);
    expect(armOrderChanges).toBeGreaterThanOrEqual(5);
  });

  it("blends a climb dismount instead of snapping", () => {
    const look = createLook(0, 100, 1);
    let y = 100;
    let knee = 0;
    for (let i = 0; i < 24; i++) {
      y -= 170 / 60;
      const frame = stepLook(
        look,
        sample(0, {
          x: 0,
          y,
          vx: 0,
          vy: -170,
          onGround: false,
          climbing: true,
        }),
        1 / 60,
      );
      knee = frame.legs[0].by;
    }
    let prev = knee;
    for (let i = 0; i < 10; i++) {
      const frame = stepLook(
        look,
        sample(0, {
          x: 0,
          y,
          vx: 0,
          vy: 0,
          onGround: true,
          climbing: false,
        }),
        1 / 60,
      );
      expect(Math.abs(frame.legs[0].by - prev)).toBeLessThan(3);
      prev = frame.legs[0].by;
    }
  });
});
