/** One full stride (both feet) in radians per second. */
export const RUN_OMEGA = 15;
export const CLIMB_OMEGA = 11;

const THIGH = 9.2;
const SHIN = 8.4;
const UPPER_ARM = 6.4;
const FOREARM = 5.6;

export type Joint = {
  thigh: number;
  knee: number;
};

export type Point = {
  x: number;
  y: number;
};

/**
 * 0 is straight down. Positive thigh swings toward the facing direction.
 * The knee lifts while the thigh is still driving forward, then the leg
 * extends. A sine on the thigh alone kicks the heel back and both feet
 * leave the ground in a split.
 */
export function runLeg(phase: number): Joint {
  const lift = Math.max(0, Math.cos(phase));
  return {
    thigh: Math.sin(phase) * 0.92 + lift * 0.62,
    knee: 0.14 + lift * lift * 1.4,
  };
}

export function runArm(phase: number): Joint {
  const swing = phase + Math.PI;
  return {
    thigh: Math.sin(swing) * 0.95,
    knee: 0.28 + Math.max(0, -Math.sin(swing)) * 0.65,
  };
}

export function climbLeg(phase: number): Joint {
  return {
    thigh: 0.55 + Math.sin(phase) * 0.7,
    knee: 0.55 + Math.max(0, Math.cos(phase)) * 0.95,
  };
}

export function climbArm(phase: number): Joint {
  const swing = phase + Math.PI;
  return {
    thigh: 2.15 + Math.sin(swing) * 0.45,
    knee: 0.35 + Math.max(0, Math.cos(swing)) * 0.4,
  };
}

export function jumpLegs(): { lead: Joint; trail: Joint } {
  return {
    lead: { thigh: 0.85, knee: 0.35 },
    trail: { thigh: -0.7, knee: 1.05 },
  };
}

export function jumpArms(): { lead: Joint; trail: Joint } {
  return {
    lead: { thigh: 2.35, knee: 0.25 },
    trail: { thigh: 1.85, knee: 0.45 },
  };
}

/** Two-bone chain. Angle 0 points down, positive rotates toward +x. */
export function chainEnd(
  joint: Joint,
  upper: number,
  lower: number,
): { knee: Point; end: Point } {
  const shin = joint.thigh - joint.knee;
  const knee = {
    x: Math.sin(joint.thigh) * upper,
    y: Math.cos(joint.thigh) * upper,
  };
  return {
    knee,
    end: {
      x: knee.x + Math.sin(shin) * lower,
      y: knee.y + Math.cos(shin) * lower,
    },
  };
}

export function runFoot(phase: number): Point {
  return chainEnd(runLeg(phase), THIGH, SHIN).end;
}

export function runHand(phase: number): Point {
  return chainEnd(runArm(phase), UPPER_ARM, FOREARM).end;
}

/**
 * Local degrees, 0 upright and negative trailing behind the nose.
 * The sprite mirror applies `facing`, so the trail flips with the turn
 * instead of pointing forward while velocity is still the old way.
 * `wind` is 0..1 and eases off when speed drops.
 */
export function hairBlowDegrees(speed: number, wind: number, facing: 1 | -1) {
  if (wind === 0) {
    return 0;
  }
  const along = Math.min(1, Math.abs(speed) / 220);
  // `facing` only mirrors the sprite. The local trail is the same either way.
  return -wind * (0.35 + 0.65 * along) * 72 * Math.abs(facing);
}

export function stepWind(current: number, speed: number) {
  const target = Math.min(1, Math.abs(speed) / 200);
  const rate = target > current ? 0.22 : 0.07;
  return current + (target - current) * rate;
}
