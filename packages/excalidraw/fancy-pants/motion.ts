import type { Body } from "./physics";

/** Fixed physics step. Rendering interpolates the leftover fraction. */
export const PHYSICS_DT = 1 / 120;

const STRIDE = 40;
const CLIMB_STRIDE = 26;
const HIP_Y = 26.4;
const SHOULDER_Y = 15.4;
const HEAD_Y = 8.3;
const GROUND_Y = 42.3;
const THIGH = 9.4;
const SHIN = 8.6;
const UPPER_ARM = 6.4;
const FOREARM = 5.6;
const FOOT = 3.3;
const CX = 13;

const SPIKES = [
  { rest: -36, len: 7.2, w: 2.3 },
  { rest: -14, len: 9.4, w: 2.5 },
  { rest: 6, len: 10.2, w: 2.3 },
  { rest: 24, len: 8.2, w: 2.1 },
  { rest: 42, len: 6.4, w: 1.8 },
];

const MODES = ["idle", "run", "jump", "fall", "climb"] as const;
type Mode = typeof MODES[number];

type Limb = { hip: number; knee: number; ankle: number };

type Angles = {
  lean: number;
  bob: number;
  hipX: number;
  shoulderX: number;
  headX: number;
  headY: number;
  legs: [Limb, Limb];
  arms: [Limb, Limb];
};

type Plant = {
  held: boolean;
  worldX: number;
  blend: number;
  hip: number;
  knee: number;
  ankle: number;
};

export type Look = {
  phase: number;
  climbPhase: number;
  face: number;
  faceVel: number;
  weights: Record<Mode, number>;
  compress: number;
  compressVel: number;
  ant: number;
  hair: number;
  hairVel: number;
  spike: number[];
  spikeVel: number[];
  plants: [Plant, Plant];
  airborne: boolean;
  visualX: number;
  visualY: number;
  time: number;
};

export type Chain = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  dx: number;
  dy: number;
};

export type FramePose = {
  scaleX: number;
  bob: number;
  lean: number;
  compress: number;
  hipX: number;
  hipY: number;
  shoulderX: number;
  shoulderY: number;
  headX: number;
  headY: number;
  eyeX: number;
  eyeY: number;
  legs: [Chain, Chain];
  arms: [Chain, Chain];
  hairX: number;
  hairY: number;
  spikes: { angle: number; len: number; w: number }[];
  planted: [boolean, boolean];
  footWorldX: [number, number];
};

export type LookSample = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  climbing: boolean;
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

const wrap = (v: number) => ((v % 1) + 1) % 1;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smooth = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

const endPoint = (x: number, y: number, rad: number, len: number) => ({
  x: x + Math.sin(rad) * len,
  y: y + Math.cos(rad) * len,
});

const emptyPlant = (): Plant => ({
  held: false,
  worldX: 0,
  blend: 0,
  hip: 0,
  knee: 0.2,
  ankle: 0.3,
});

export function createLook(x: number, y: number, facing: 1 | -1 = 1): Look {
  return {
    phase: 0,
    climbPhase: 0,
    face: facing,
    faceVel: 0,
    weights: { idle: 1, run: 0, jump: 0, fall: 0, climb: 0 },
    compress: 0,
    compressVel: 0,
    ant: 0,
    hair: -facing * 14,
    hairVel: 0,
    spike: SPIKES.map((spike) => -facing * 14 + spike.rest),
    spikeVel: SPIKES.map(() => 0),
    plants: [emptyPlant(), emptyPlant()],
    airborne: false,
    visualX: x,
    visualY: y,
    time: 0,
  };
}

export function interpolatePosition(
  prev: { x: number; y: number },
  next: { x: number; y: number },
  alpha: number,
) {
  const t = clamp(alpha, 0, 1);
  return {
    x: prev.x + (next.x - prev.x) * t,
    y: prev.y + (next.y - prev.y) * t,
  };
}

const CONTACT = { hip: 0.48, knee: 0.22, ankle: 0.55 };
const TOEOFF = { hip: -0.55, knee: 0.16, ankle: -0.35 };

/** One leg across a full cycle (both steps). u and u+0.5 are the two feet. */
export function legCycle(u: number): Limb & { stance: boolean } {
  const t = wrap(u);
  if (t < 0.5) {
    const s = smooth(t / 0.5);
    return {
      hip: lerp(CONTACT.hip, TOEOFF.hip, s),
      knee: lerp(CONTACT.knee, TOEOFF.knee, s),
      ankle: lerp(CONTACT.ankle, TOEOFF.ankle, s),
      stance: t > 0.07 && t < 0.43,
    };
  }
  const s = (t - 0.5) / 0.5;
  const e = smooth(s);
  const lift = Math.sin(s * Math.PI) ** 2;
  return {
    hip: lerp(TOEOFF.hip, CONTACT.hip, e),
    knee: lerp(TOEOFF.knee, CONTACT.knee, e) + lift * 1.15,
    ankle: lerp(TOEOFF.ankle, CONTACT.ankle, e) + lift * 0.25,
    stance: false,
  };
}

function armCycle(u: number): Limb {
  const leg = legCycle(u);
  return {
    hip: -leg.hip * 0.95,
    knee: 0.18 + leg.knee * 0.16,
    ankle: 0,
  };
}

function climbLeg(u: number): Limb {
  const a = u * Math.PI * 2;
  return {
    hip: 0.42 + Math.sin(a) * 0.48,
    knee: 0.42 + (0.5 + 0.5 * Math.cos(a)) * 0.7,
    ankle: 0.25 + Math.sin(a) * 0.15,
  };
}

function climbArm(u: number): Limb {
  const a = (u + 0.5) * Math.PI * 2;
  return {
    hip: 2.02 + Math.sin(a) * 0.42,
    knee: 0.28 + (0.5 + 0.5 * Math.cos(a)) * 0.35,
    ankle: 0,
  };
}

function idleAngles(time: number): Angles {
  const sway = Math.sin(time * 2.2) * 0.05;
  return {
    lean: 1.5 + Math.sin(time * 2.2) * 1.2,
    bob: Math.sin(time * 2.4) * 0.45,
    hipX: CX,
    shoulderX: CX,
    headX: CX,
    headY: HEAD_Y + Math.sin(time * 2.4) * 0.25,
    legs: [
      { hip: 0.14 + sway, knee: 0.14, ankle: 0.35 },
      { hip: -0.1 - sway, knee: 0.12, ankle: 0.3 },
    ],
    arms: [
      { hip: -0.16 + sway, knee: 0.16, ankle: 0 },
      { hip: 0.18 - sway, knee: 0.14, ankle: 0 },
    ],
  };
}

function runAngles(phase: number, speed: number): Angles {
  const rock = Math.sin(phase * Math.PI * 4) * speed;
  return {
    lean: 7 + speed * 7 + Math.sin(phase * Math.PI * 2) * 2.4 * speed,
    bob: Math.cos(phase * Math.PI * 4) * 1.7 * speed,
    hipX: CX + rock * 1.15,
    shoulderX: CX - rock * 0.85,
    headX: CX - rock * 0.35,
    headY: HEAD_Y + Math.cos((phase - 0.05) * Math.PI * 4) * 0.85 * speed,
    legs: [legCycle(phase), legCycle(phase + 0.5)],
    arms: [armCycle(phase), armCycle(phase + 0.5)],
  };
}

function airAngles(vy: number): Angles {
  const rise = clamp(-vy / 680, 0, 1);
  const drop = clamp(vy / 920, 0, 1);
  const tuck = rise * 0.85 + (1 - drop) * 0.15;
  return {
    lean: lerp(8, -12, rise) + drop * 4,
    bob: -rise * 1.2 + drop * 0.6,
    hipX: CX,
    shoulderX: CX,
    headX: CX,
    headY: HEAD_Y - rise * 0.4,
    legs: [
      {
        hip: lerp(0.2, 0.72, tuck) - drop * 0.15,
        knee: lerp(0.28, 0.95, tuck),
        ankle: 0.35,
      },
      {
        hip: lerp(-0.12, -0.28, tuck) - drop * 0.2,
        knee: lerp(0.32, 1.05, tuck),
        ankle: 0.2,
      },
    ],
    arms: [
      {
        hip: lerp(0.4, 2.25, rise) + drop * 0.2,
        knee: 0.22,
        ankle: 0,
      },
      {
        hip: lerp(-0.2, 1.9, rise),
        knee: 0.28,
        ankle: 0,
      },
    ],
  };
}

function climbAngles(phase: number, up: boolean): Angles {
  return {
    lean: up ? 16 : 8,
    bob: Math.sin(phase * Math.PI * 4) * 0.45,
    hipX: CX + 3.2,
    shoulderX: CX + 3.6,
    headX: CX + 2.4,
    headY: HEAD_Y,
    legs: [climbLeg(phase), climbLeg(phase + 0.5)],
    arms: [climbArm(phase), climbArm(phase + 0.5)],
  };
}

function blendAngles(
  parts: Record<Mode, Angles>,
  weights: Record<Mode, number>,
): Angles {
  const acc: Angles = {
    lean: 0,
    bob: 0,
    hipX: 0,
    shoulderX: 0,
    headX: 0,
    headY: 0,
    legs: [
      { hip: 0, knee: 0, ankle: 0 },
      { hip: 0, knee: 0, ankle: 0 },
    ],
    arms: [
      { hip: 0, knee: 0, ankle: 0 },
      { hip: 0, knee: 0, ankle: 0 },
    ],
  };
  for (const mode of MODES) {
    const w = weights[mode];
    if (w < 1e-4) {
      continue;
    }
    const src = parts[mode];
    acc.lean += src.lean * w;
    acc.bob += src.bob * w;
    acc.hipX += src.hipX * w;
    acc.shoulderX += src.shoulderX * w;
    acc.headX += src.headX * w;
    acc.headY += src.headY * w;
    for (let i = 0; i < 2; i++) {
      acc.legs[i].hip += src.legs[i].hip * w;
      acc.legs[i].knee += src.legs[i].knee * w;
      acc.legs[i].ankle += src.legs[i].ankle * w;
      acc.arms[i].hip += src.arms[i].hip * w;
      acc.arms[i].knee += src.arms[i].knee * w;
      acc.arms[i].ankle += src.arms[i].ankle * w;
    }
  }
  return acc;
}

function buildChain(
  x: number,
  y: number,
  limb: Limb,
  upper: number,
  lower: number,
  tip: number,
): Chain {
  const joint = endPoint(x, y, limb.hip, upper);
  const shin = limb.hip - limb.knee;
  const end = endPoint(joint.x, joint.y, shin, lower);
  const toe = endPoint(end.x, end.y, shin + limb.ankle, tip);
  return {
    ax: x,
    ay: y,
    bx: joint.x,
    by: joint.y,
    cx: end.x,
    cy: end.y,
    dx: toe.x,
    dy: toe.y,
  };
}

function solveLeg(hipX: number, targetX: number, targetY: number) {
  let dx = targetX - hipX;
  let dy = targetY - HIP_Y;
  let dist = Math.hypot(dx, dy) || 0.001;
  const max = THIGH + SHIN - 0.08;
  const min = Math.abs(THIGH - SHIN) + 0.08;
  if (dist > max) {
    dx *= max / dist;
    dy *= max / dist;
    dist = max;
  } else if (dist < min) {
    dx *= min / dist;
    dy *= min / dist;
    dist = min;
  }
  const aim = Math.atan2(dx, dy);
  const hipOff = Math.acos(
    clamp(
      (THIGH * THIGH + dist * dist - SHIN * SHIN) / (2 * THIGH * dist),
      -1,
      1,
    ),
  );
  const thigh = aim + hipOff;
  const knee =
    Math.PI -
    Math.acos(
      clamp(
        (THIGH * THIGH + SHIN * SHIN - dist * dist) / (2 * THIGH * SHIN),
        -1,
        1,
      ),
    );
  const shin = thigh - knee;
  return { hip: thigh, knee, ankle: 1.15 - shin };
}

function rotateDeg(x: number, y: number, ox: number, oy: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = x - ox;
  const dy = y - oy;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: ox + dx * c - dy * s, y: oy + dx * s + dy * c };
}

function toScreen(
  x: number,
  y: number,
  scaleX: number,
  lean: number,
  compress: number,
  bob: number,
) {
  let p = rotateDeg(x, y, CX, GROUND_Y, lean);
  p = { x: CX + scaleX * (p.x - CX), y: p.y };
  const sy = 1 - clamp(compress, -0.35, 1.2) * 0.16;
  p = { x: p.x, y: GROUND_Y + sy * (p.y - GROUND_Y) };
  return { x: p.x, y: p.y + bob };
}

function modeOf(sample: LookSample): Mode {
  if (sample.climbing) {
    return "climb";
  }
  if (!sample.onGround) {
    return sample.vy < 0 ? "jump" : "fall";
  }
  if (Math.abs(sample.vx) > 18) {
    return "run";
  }
  return "idle";
}

function spring(
  value: number,
  vel: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
) {
  let nextVel = vel + (target - value) * stiffness * dt;
  nextVel *= Math.exp(-damping * dt);
  return { value: value + nextVel * dt, vel: nextVel };
}

/**
 * Advance the drawable pose by one rendered frame.
 * Physics x/y are already interpolated; gait phase follows that distance.
 */
export function stepLook(
  look: Look,
  sample: LookSample,
  dt: number,
): FramePose {
  const step = clamp(dt, 0, 0.05);
  look.time += step;

  const rawDx = sample.x - look.visualX;
  const rawDy = sample.y - look.visualY;
  const dx = clamp(rawDx, -500 * step, 500 * step);
  const dy = clamp(rawDy, -1200 * step, 1200 * step);

  look.phase = wrap(look.phase + Math.abs(dx) / STRIDE);
  if (sample.climbing) {
    look.climbPhase = wrap(look.climbPhase + Math.abs(dy) / CLIMB_STRIDE);
  }

  const mode = modeOf(sample);
  const blend = 1 - Math.exp(-12 * step);
  for (const key of MODES) {
    const target = key === mode ? 1 : 0;
    look.weights[key] += (target - look.weights[key]) * blend;
  }

  const turned = spring(look.face, look.faceVel, sample.facing, 360, 24, step);
  look.face = turned.value;
  look.faceVel = turned.vel;
  // Keep a little width through the zero crossing so the turn doesn't vanish.
  const scaleX =
    (look.face >= 0 ? 1 : -1) * clamp(Math.abs(look.face), 0.42, 1.08);

  if (look.airborne && sample.onGround) {
    look.compressVel = 8.2;
  }
  if (!look.airborne && !sample.onGround && sample.vy < -120) {
    look.ant = 1;
  }
  look.ant = Math.max(0, look.ant - step / 0.11);
  const landed = spring(look.compress, look.compressVel, 0, 78, 11, step);
  look.compress = landed.value;
  look.compressVel = landed.vel;

  const speed = clamp(Math.abs(sample.vx) / 280, 0, 1);
  const parts: Record<Mode, Angles> = {
    idle: idleAngles(look.time),
    run: runAngles(look.phase, Math.max(speed, 0.35)),
    jump: airAngles(sample.vy),
    fall: airAngles(sample.vy),
    climb: climbAngles(look.climbPhase, sample.vy <= 0),
  };
  const angles = blendAngles(parts, look.weights);
  const crouch = look.ant * look.ant;
  angles.bob +=
    crouch * 2.6 +
    Math.max(0, look.compress) * 2.2 +
    Math.min(0, look.compress) * 1.1;
  angles.lean += crouch * 5;
  for (const leg of angles.legs) {
    leg.knee += crouch * 0.5 + Math.max(0, look.compress) * 0.38;
  }

  const aligned =
    Math.sign(scaleX) === sample.facing && Math.abs(look.face) > 0.82;
  const scale = scaleX;
  const maxReach = Math.sqrt(
    Math.max(0, (THIGH + SHIN) ** 2 - (GROUND_Y - HIP_Y) ** 2),
  );

  const legs: [Chain, Chain] = [0, 1].map((index) => {
    const limb = angles.legs[index];
    const cycle = legCycle(look.phase + index * 0.5);
    const plant = look.plants[index];
    const animated = buildChain(angles.hipX, HIP_Y, limb, THIGH, SHIN, FOOT);
    const want =
      cycle.stance &&
      sample.onGround &&
      look.weights.run > 0.6 &&
      aligned &&
      !sample.climbing;

    if (want && !plant.held) {
      const offset = animated.cx - angles.hipX;
      if (Math.abs(offset) < maxReach - 0.2) {
        plant.held = true;
        plant.worldX = sample.x + CX + scale * (animated.cx - CX);
      }
    }

    if (plant.held) {
      const localX = CX + (plant.worldX - sample.x - CX) / scale;
      const offset = localX - angles.hipX;
      if (!want || Math.abs(offset) > maxReach + 0.15) {
        plant.held = false;
      } else {
        const ik = solveLeg(angles.hipX, localX, GROUND_Y);
        plant.hip = ik.hip;
        plant.knee = ik.knee;
        plant.ankle = ik.ankle;
        plant.blend = Math.min(1, plant.blend + step / 0.02);
      }
    } else {
      plant.blend = Math.max(0, plant.blend - step / 0.04);
    }

    if (plant.blend < 0.02) {
      return animated;
    }
    const mixed: Limb = {
      hip: lerp(limb.hip, plant.hip, plant.blend),
      knee: lerp(limb.knee, plant.knee, plant.blend),
      ankle: lerp(limb.ankle, plant.ankle, plant.blend),
    };
    return buildChain(angles.hipX, HIP_Y, mixed, THIGH, SHIN, FOOT);
  }) as [Chain, Chain];

  const arms: [Chain, Chain] = [0, 1].map((index) =>
    buildChain(
      angles.shoulderX,
      SHOULDER_Y,
      angles.arms[index],
      UPPER_ARM,
      FOREARM,
      0,
    ),
  ) as [Chain, Chain];

  const hairTarget =
    Math.abs(sample.vx) < 12
      ? -sample.facing * 12
      : -Math.sign(sample.vx) * (26 + speed * 50);
  const hair = spring(look.hair, look.hairVel, hairTarget, 86, 10, step);
  look.hair = hair.value;
  look.hairVel = hair.vel;

  const spikes = SPIKES.map((spike, index) => {
    const follow = 0.7 + (spike.len / 10.2) * 0.48;
    const flutter =
      Math.sin(look.time * 13 + index * 0.8) * (1.4 + speed * 3.5);
    const target =
      spike.rest * (1 - speed * 0.6) + look.hair * follow + flutter;
    const next = spring(
      look.spike[index],
      look.spikeVel[index],
      target,
      42 - index * 3,
      8,
      step,
    );
    look.spike[index] = next.value;
    look.spikeVel[index] = next.vel;
    return {
      angle: next.value,
      len: spike.len * (1 + speed * 0.4),
      w: spike.w,
    };
  });

  const hairPoint = toScreen(
    angles.headX,
    angles.headY - 4.2,
    scale,
    angles.lean,
    look.compress,
    angles.bob,
  );

  const planted: [boolean, boolean] = [
    look.plants[0].held,
    look.plants[1].held,
  ];
  const footWorldX: [number, number] = [
    sample.x + CX + scale * (legs[0].cx - CX),
    sample.x + CX + scale * (legs[1].cx - CX),
  ];

  look.visualX = sample.x;
  look.visualY = sample.y;
  look.airborne = !sample.onGround;

  return {
    scaleX: scale,
    bob: angles.bob,
    lean: angles.lean,
    compress: look.compress,
    hipX: angles.hipX,
    hipY: HIP_Y,
    shoulderX: angles.shoulderX,
    shoulderY: SHOULDER_Y,
    headX: angles.headX,
    headY: angles.headY,
    eyeX: angles.headX + 1.5,
    eyeY: angles.headY - 0.15,
    legs,
    arms,
    hairX: hairPoint.x,
    hairY: hairPoint.y,
    spikes,
    planted,
    footWorldX,
  };
}

export function lookFromBody(body: Body): Look {
  return createLook(body.x, body.y, body.facing);
}
