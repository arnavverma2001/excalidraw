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

/** 0 is straight down. Positive thigh swings toward the facing direction. */
export function runLeg(phase: number): Joint {
  return {
    thigh: Math.sin(phase) * 1.02,
    knee: 0.18 + Math.max(0, Math.cos(phase)) * 1.2,
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
 * Hair streams opposite velocity. Positive speed (moving right) yields a
 * negative SVG rotation so the spikes point backward. `wind` is 0..1.
 */
export function hairBlowDegrees(speed: number, wind: number, facing: 1 | -1) {
  if (wind === 0) {
    return 0;
  }
  const direction = speed === 0 ? facing : Math.sign(speed);
  return -wind * direction * facing * 62;
}

export function stepWind(current: number, speed: number) {
  const target = Math.min(1, Math.abs(speed) / 200);
  const rate = target > current ? 0.22 : 0.07;
  return current + (target - current) * rate;
}
