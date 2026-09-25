import {
  hairBlowDegrees,
  runArm,
  runFoot,
  runHand,
  runLeg,
  stepWind,
} from "./poses";

describe("fancy pants stick poses", () => {
  it("swings the feet through a stride instead of a two-pose flip", () => {
    const samples = [0, 0.5, 1, 1.5, 2, 2.5, 3].map(
      (phase) => runFoot(phase).x,
    );
    const reach = runFoot(Math.PI / 2);
    const push = runFoot(Math.PI / 2 + Math.PI);

    expect(reach.x).toBeGreaterThan(6);
    expect(push.x).toBeLessThan(-6);
    expect(runLeg(0).knee).toBeGreaterThan(runLeg(Math.PI / 2).knee);
    expect(runLeg(0).thigh).toBeGreaterThan(0.3);
    const swing = runFoot(0);
    const stance = runFoot(Math.PI);
    expect(stance.y).toBeGreaterThan(swing.y + 3);
    expect(stance.y).toBeGreaterThan(16);
    expect(new Set(samples.map((x) => Math.sign(x))).size).toBeGreaterThan(1);
    const unique = new Set(samples.map((x) => Math.round(x)));
    expect(unique.size).toBeGreaterThan(4);
  });

  it("swings the arms opposite the legs", () => {
    const phase = Math.PI / 2;
    expect(Math.sign(runLeg(phase).thigh)).not.toBe(
      Math.sign(runArm(phase).thigh),
    );
    expect(runHand(phase).x).toBeLessThan(0);
    expect(runFoot(phase).x).toBeGreaterThan(0);
  });

  it("blows hair backward and settles it when speed drops", () => {
    expect(hairBlowDegrees(280, 1, 1)).toBeLessThan(-40);
    expect(hairBlowDegrees(-280, 1, -1)).toBeLessThan(-40);
    // A turn flips facing before velocity. The trail stays behind the nose.
    expect(hairBlowDegrees(280, 1, -1)).toBeLessThan(-40);
    expect(hairBlowDegrees(-280, 1, 1)).toBeLessThan(-40);
    expect(hairBlowDegrees(0, 0, 1)).toBe(0);

    let wind = 0;
    for (let i = 0; i < 12; i++) {
      wind = stepWind(wind, 280);
    }
    expect(wind).toBeGreaterThan(0.7);
    for (let i = 0; i < 8; i++) {
      wind = stepWind(wind, 0);
    }
    expect(wind).toBeLessThan(0.7);
    expect(wind).toBeGreaterThan(0.05);
  });
});
