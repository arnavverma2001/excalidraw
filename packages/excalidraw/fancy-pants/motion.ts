import type { Body } from "./physics";

/** Fixed physics step. Rendering interpolates the leftover fraction. */
export const PHYSICS_DT = 1 / 120;

/** World distance for one full stride (both feet). */
export const STRIDE = 70;

const CLIMB_STRIDE = 26;
const HIP_Y = 28.4;
const SHOULDER_Y = 15.4;
const HEAD_Y = 8.3;
const GROUND_Y = 42.3;
const THIGH = 11.6;
const SHIN = 11.0;
const UPPER_ARM = 6.6;
const FOREARM = 5.8;
const FOOT = 3.5;
const CX = 13;
const TURN_TIME = 0.18;
const STANCE_A = 0.06;
const STANCE_B = 0.44;
/** Ankle, in facing-forward units, at contact and at toe-off. */
const CONTACT_X = 11;
const TOEOFF_X = CONTACT_X - (STANCE_B - STANCE_A) * STRIDE;

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
};

export type Look = {
  phase: number;
  climbPhase: number;
  /** Eased facing, -1..1. This is not applied as an SVG mirror. */
  face: number;
  turnFrom: number;
  turnTo: number;
  turnU: number;
  weights: Record<Mode, number>;
  compress: number;
  hair: number;
  hairVel: number;
  spike: number[];
  spikeVel: number[];
  plants: [Plant, Plant];
  airborne: boolean;
  visualX: number;
  visualY: number;
  time: number;
  prevVx: number;
  vxReady: boolean;
  airTime: number;
  landAge: number;
  recover: number;
  prevLegs: [Chain, Chain] | null;
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
});

export function createLook(x: number, y: number, facing: 1 | -1 = 1): Look {
  return {
    phase: 0,
    climbPhase: 0,
    face: facing,
    turnFrom: facing,
    turnTo: facing,
    turnU: 1,
    weights: { idle: 1, run: 0, jump: 0, fall: 0, climb: 0 },
    compress: 0,
    hair: 0,
    hairVel: 0,
    spike: SPIKES.map((spike) => spike.rest),
    spikeVel: SPIKES.map(() => 0),
    plants: [emptyPlant(), emptyPlant()],
    airborne: false,
    visualX: x,
    visualY: y,
    time: 0,
    prevVx: 0,
    vxReady: false,
    airTime: 0,
    landAge: -1,
    recover: 0,
    prevLegs: null,
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
      stance: t >= STANCE_A && t < STANCE_B,
    };
  }
  const s = (t - 0.5) / 0.5;
  const e = smooth(s);
  const lift = Math.sin(s * Math.PI) ** 2;
  return {
    hip: lerp(TOEOFF.hip, CONTACT.hip, e),
    knee: lerp(TOEOFF.knee, CONTACT.knee, e) + lift * 0.9,
    ankle: lerp(TOEOFF.ankle, CONTACT.ankle, e) + lift * 0.2,
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
    bob: Math.sin(time * 2.4) * 0.4,
    hipX: CX,
    shoulderX: CX,
    headX: CX,
    headY: HEAD_Y + Math.sin(time * 2.4) * 0.2,
    legs: [limbTo(2.2 + sway, GROUND_Y), limbTo(-1.6 - sway, GROUND_Y)],
    arms: [
      { hip: -0.16 + sway, knee: 0.16, ankle: 0 },
      { hip: 0.18 - sway, knee: 0.14, ankle: 0 },
    ],
  };
}

function runAngles(phase: number, speed: number): Angles {
  const rock = Math.sin(phase * Math.PI * 4) * speed;
  return {
    lean: 8 + speed * 6 + Math.sin(phase * Math.PI * 2) * 1.6 * speed,
    bob: Math.cos(phase * Math.PI * 4) * 1.15 * speed,
    hipX: CX + rock * 0.8,
    shoulderX: CX - rock * 0.7,
    headX: CX - rock * 0.25,
    headY: HEAD_Y + Math.cos((phase - 0.05) * Math.PI * 4) * 0.55 * speed,
    legs: [legCycle(phase), legCycle(phase + 0.5)],
    arms: [armCycle(phase), armCycle(phase + 0.5)],
  };
}

function poseOf(
  lean: number,
  bob: number,
  legs: [Limb, Limb],
  arms: [Limb, Limb],
  headY = HEAD_Y,
): Angles {
  return {
    lean,
    bob,
    hipX: CX,
    shoulderX: CX,
    headX: CX,
    headY,
    legs,
    arms,
  };
}

/** Continuous flight: crouch, extend, apex, fall, then a downward reach. */
function flightAngles(airTime: number, vy: number): Angles {
  const crouch = poseOf(
    14,
    2.4,
    [limbTo(1.1, HIP_Y + 5.1), limbTo(-0.8, HIP_Y + 5.4)],
    [
      { hip: -0.65, knee: 0.45, ankle: 0 },
      { hip: -0.3, knee: 0.4, ankle: 0 },
    ],
    HEAD_Y + 1.1,
  );
  const extend = poseOf(
    -8,
    -1.6,
    [limbTo(-11, GROUND_Y - 0.8), limbTo(7, GROUND_Y - 1.4)],
    [
      { hip: 2.2, knee: 0.16, ankle: 0 },
      { hip: 1.85, knee: 0.22, ankle: 0 },
    ],
    HEAD_Y - 0.4,
  );
  const apex = poseOf(
    1,
    -0.3,
    [limbTo(3.2, HIP_Y + 6.2), limbTo(-1.4, HIP_Y + 6.6)],
    [
      { hip: 1.65, knee: 0.4, ankle: 0 },
      { hip: 2.05, knee: 0.28, ankle: 0 },
    ],
  );
  const fall = poseOf(
    11,
    0.3,
    [limbTo(6, GROUND_Y - 6), limbTo(-7, GROUND_Y - 5)],
    [
      { hip: 2.15, knee: 0.22, ankle: 0 },
      { hip: 1.55, knee: 0.48, ankle: 0 },
    ],
  );
  const reach = poseOf(
    5,
    0.8,
    [limbTo(9, GROUND_Y - 0.6), limbTo(2.2, GROUND_Y - 1.2)],
    [
      { hip: 0.85, knee: 0.32, ankle: 0 },
      { hip: 0.35, knee: 0.42, ankle: 0 },
    ],
  );

  const tuck = clamp(1 - Math.max(0, airTime - 0.02) / 0.1, 0, 1);
  const rising = clamp(-vy / 220, 0, 1);
  const extendW =
    smooth(clamp((airTime - 0.11) / 0.1, 0, 1)) * rising * (1 - tuck);
  const apexW =
    clamp(1 - Math.abs(vy) / 150, 0, 1) *
    smooth(clamp((airTime - 0.16) / 0.1, 0, 1));
  const fallW = smooth(clamp((vy + 40) / 320, 0, 1));
  const reachW = smooth(clamp((vy - 180) / 320, 0, 1));
  const raw = [
    tuck * (1 - extendW),
    extendW * (1 - apexW) * (1 - fallW),
    apexW * (1 - reachW),
    fallW * (1 - reachW) * (1 - apexW),
    reachW,
  ];
  let sum = raw.reduce((total, value) => total + value, 0);
  if (sum < 1e-4) {
    raw[2] = 1;
    sum = 1;
  }
  return blendList(
    [crouch, extend, apex, fall, reach],
    raw.map((value) => value / sum),
  );
}

function climbAngles(phase: number, up: boolean): Angles {
  return {
    lean: up ? 16 : 8,
    bob: Math.sin(phase * Math.PI * 4) * 0.35,
    hipX: CX + 3.2,
    shoulderX: CX + 3.6,
    headX: CX + 2.4,
    headY: HEAD_Y,
    legs: [climbLeg(phase), climbLeg(phase + 0.5)],
    arms: [climbArm(phase), climbArm(phase + 0.5)],
  };
}

function blendList(sources: Angles[], weights: number[]): Angles {
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
  sources.forEach((src, index) => {
    const w = weights[index];
    if (w < 1e-4) {
      return;
    }
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
  });
  return acc;
}

function blendAngles(
  parts: Record<Mode, Angles>,
  weights: Record<Mode, number>,
): Angles {
  return blendList(
    MODES.map((mode) => parts[mode]),
    MODES.map((mode) => weights[mode]),
  );
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
  const bend = Math.acos(
    clamp(
      (THIGH * THIGH + SHIN * SHIN - dist * dist) / (2 * THIGH * SHIN),
      -1,
      1,
    ),
  );
  // Two bends reach the same ankle. Keep the knee above the other one.
  const options = [1, -1].map((sign) => {
    const thigh = aim + sign * hipOff;
    const knee = sign * (Math.PI - bend);
    return {
      hip: thigh,
      knee,
      shin: thigh - knee,
      kneeY: HIP_Y + Math.cos(thigh) * THIGH,
    };
  });
  options.sort((a, b) => a.kneeY - b.kneeY);
  return options[0];
}

function limbTo(offsetX: number, targetY: number): Limb {
  const ik = solveLeg(CX, CX + offsetX, targetY);
  const toeAng = Math.atan2(Math.sign(offsetX || 1), 0.45);
  return { hip: ik.hip, knee: ik.knee, ankle: toeAng - ik.shin };
}

function rotateDeg(x: number, y: number, ox: number, oy: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = x - ox;
  const dy = y - oy;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: ox + dx * c - dy * s, y: oy + dx * s + dy * c };
}

function leanChain(chain: Chain, hipX: number, deg: number): Chain {
  const turn = (x: number, y: number) => rotateDeg(x, y, hipX, HIP_Y, deg);
  const a = turn(chain.ax, chain.ay);
  const b = turn(chain.bx, chain.by);
  const c = turn(chain.cx, chain.cy);
  const d = turn(chain.dx, chain.dy);
  return {
    ax: a.x,
    ay: a.y,
    bx: b.x,
    by: b.y,
    cx: c.x,
    cy: c.y,
    dx: d.x,
    dy: d.y,
  };
}

function mirrorLimb(limb: Limb, face: number): Limb {
  return {
    hip: limb.hip * face,
    knee: limb.knee * face,
    ankle: limb.ankle * face,
  };
}

function posedLegs(src: Angles, face: number, hipX: number): [Chain, Chain] {
  return [0, 1].map((index) =>
    buildChain(
      hipX,
      HIP_Y,
      mirrorLimb(src.legs[index], face),
      THIGH,
      SHIN,
      FOOT,
    ),
  ) as [Chain, Chain];
}

function footLocal(u: number) {
  const t = wrap(u);
  if (t >= STANCE_A && t < STANCE_B) {
    const st = (t - STANCE_A) / (STANCE_B - STANCE_A);
    const roll = st > 0.72 ? smooth((st - 0.72) / 0.28) : 0;
    return {
      x: lerp(CONTACT_X, TOEOFF_X, st),
      lift: 0,
      roll,
      stance: true,
    };
  }
  const p = t >= STANCE_B ? t - STANCE_B : t + (1 - STANCE_B);
  const span = STANCE_A + (1 - STANCE_B);
  const s = clamp(p / span, 0, 1);
  return {
    x: lerp(TOEOFF_X, CONTACT_X, smooth(s)),
    lift: Math.sin(s * Math.PI) * 8,
    roll: 0,
    stance: false,
  };
}

function chainFromAnkle(
  hipX: number,
  ankleX: number,
  ankleY: number,
  roll: number,
  forward: number,
): Chain {
  const ik = solveLeg(hipX, ankleX, ankleY);
  const dir = forward >= 0 ? 1 : -1;
  const flat = Math.atan2(dir, 0.2);
  const pitched = Math.atan2(dir * 0.35, 0.95);
  const toeAng = lerp(flat, pitched, roll);
  return buildChain(
    hipX,
    HIP_Y,
    { hip: ik.hip, knee: ik.knee, ankle: toeAng - ik.shin },
    THIGH,
    SHIN,
    FOOT,
  );
}

function strideLegs(
  phase: number,
  hipX: number,
  face: number,
  bob: number,
  sample: LookSample,
  plants: [Plant, Plant],
  lock: boolean,
  dt: number,
): [Chain, Chain] {
  const built: Chain[] = [];
  for (let index = 0; index < 2; index++) {
    const local = footLocal(phase + index * 0.5);
    const plant = plants[index];
    const other = plants[1 - index];
    const hipAnkle = hipX + local.x * face;
    const ankleY = GROUND_Y - bob - local.lift;
    let ankleX = hipAnkle;
    const canLock =
      lock && local.stance && !other.held && Math.abs(face) > 0.84;
    if (canLock) {
      if (!plant.held) {
        plant.held = true;
        plant.worldX = sample.x + hipAnkle;
      }
      const lockedX = plant.worldX - sample.x;
      if (Math.abs(lockedX - hipX) > 16.8) {
        plant.held = false;
        plant.blend = Math.max(0, plant.blend - dt / 0.04);
        ankleX = lerp(hipAnkle, lockedX, plant.blend);
      } else {
        plant.blend = 1;
        ankleX = lockedX;
      }
    } else {
      const lockedX = plant.worldX - sample.x;
      plant.held = false;
      plant.blend = Math.max(0, plant.blend - dt / 0.05);
      ankleX =
        plant.blend > 0 ? lerp(hipAnkle, lockedX, plant.blend) : hipAnkle;
    }
    built.push(chainFromAnkle(hipX, ankleX, ankleY, local.roll, face));
  }
  return built as [Chain, Chain];
}

function idleLegs(face: number, hipX: number, bob: number): [Chain, Chain] {
  return [2.2, -1.6].map((offset) => {
    const ankleX = hipX + offset * face;
    const ankleY = GROUND_Y - bob;
    return chainFromAnkle(hipX, ankleX, ankleY, 0, face || 1);
  }) as [Chain, Chain];
}

function mixChain(a: Chain, b: Chain, t: number): Chain {
  const m = (from: number, to: number) => lerp(from, to, t);
  return {
    ax: m(a.ax, b.ax),
    ay: m(a.ay, b.ay),
    bx: m(a.bx, b.bx),
    by: m(a.by, b.by),
    cx: m(a.cx, b.cx),
    cy: m(a.cy, b.cy),
    dx: m(a.dx, b.dx),
    dy: m(a.dy, b.dy),
  };
}

function mixPair(
  a: [Chain, Chain],
  b: [Chain, Chain],
  t: number,
): [Chain, Chain] {
  return [mixChain(a[0], b[0], t), mixChain(a[1], b[1], t)];
}

function cloneChain(chain: Chain): Chain {
  return { ...chain };
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

function place(x: number, y: number, compress: number, bob: number) {
  const sy = 1 - clamp(compress, -0.35, 1.2) * 0.16;
  return { x, y: GROUND_Y + sy * (y - GROUND_Y) + bob };
}

/**
 * Advance the drawable pose by one rendered frame.
 * Facing eases through a turn; hair is a world-space spring and is not mirrored.
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

  // Crossfade facing over ~180ms. Limb targets use this scalar; nothing flips scaleX.
  if (sample.facing !== look.turnTo) {
    look.turnFrom = look.face;
    look.turnTo = sample.facing;
    look.turnU = 0;
  }
  if (look.turnU < 1) {
    look.turnU = Math.min(1, look.turnU + step / TURN_TIME);
    look.face = lerp(look.turnFrom, look.turnTo, smooth(look.turnU));
  } else {
    look.face = look.turnTo;
  }
  const turnLean =
    look.turnU < 1 ? Math.sin(look.turnU * Math.PI) * 42 * look.turnTo : 0;

  if (sample.climbing) {
    look.airTime = 0.4;
    look.landAge = -1;
  } else if (!sample.onGround) {
    look.airTime += step;
    look.landAge = -1;
  } else {
    if (look.airborne) {
      look.landAge = 0;
    }
    if (look.landAge >= 0) {
      look.landAge += step;
    }
    look.airTime = 0;
  }
  const landEnv =
    look.landAge >= 0 && look.landAge < 0.18
      ? Math.cos(clamp(look.landAge / 0.18, 0, 1) * (Math.PI / 2))
      : 0;
  const antIn = smooth(clamp(look.airTime / 0.08, 0, 1));
  const antOut = clamp(1 - Math.max(0, look.airTime - 0.06) / 0.12, 0, 1);
  const ant = !sample.onGround && !sample.climbing ? antIn * antOut : 0;

  const speed = clamp(Math.abs(sample.vx) / 280, 0, 1);
  const parts: Record<Mode, Angles> = {
    idle: idleAngles(look.time),
    run: runAngles(look.phase, Math.max(speed, 0.35)),
    jump: flightAngles(look.airTime, sample.vy),
    fall: flightAngles(look.airTime, sample.vy),
    climb: climbAngles(look.climbPhase, sample.vy <= 0),
  };
  const angles = blendAngles(parts, look.weights);
  angles.bob += ant * 3.6 + landEnv * 4.8;
  angles.lean = clamp(angles.lean + turnLean + ant * 7, -50, 50);
  look.compress = landEnv * 0.95 + ant * 0.22;

  const face = look.face;
  const hipX = CX + face * (angles.hipX - CX);
  const shoulderX = CX + face * (angles.shoulderX - CX);
  const headX = CX + face * (angles.headX - CX);
  const lockStride =
    sample.onGround &&
    !sample.climbing &&
    look.weights.run > 0.92 &&
    Math.abs(face) > 0.84 &&
    look.turnU >= 1;

  const groundTarget = (): [Chain, Chain] => {
    const stride = strideLegs(
      look.phase,
      hipX,
      face,
      angles.bob,
      sample,
      look.plants,
      lockStride,
      step,
    );
    if (lockStride) {
      return stride;
    }
    const idle = idleLegs(face, hipX, angles.bob);
    const w = clamp(look.weights.run / 0.92, 0, 1);
    return mixPair(idle, stride, w);
  };

  let legs: [Chain, Chain];
  if (sample.climbing) {
    legs = posedLegs(angles, face, hipX);
    look.recover = 0;
    for (const plant of look.plants) {
      plant.held = false;
      plant.blend = 0;
    }
  } else if (!sample.onGround || look.recover > 0) {
    const flight = flightAngles(look.airTime, sample.vy);
    const target = !sample.onGround
      ? posedLegs(flight, face, hipX)
      : groundTarget();
    const follow = 1 - Math.exp(-step / 0.04);
    legs = look.prevLegs ? mixPair(look.prevLegs, target, follow) : target;
    if (sample.onGround) {
      look.recover = Math.max(0, look.recover - step / 0.22);
    } else {
      look.recover = 1;
      for (const plant of look.plants) {
        plant.held = false;
      }
    }
  } else {
    legs = groundTarget();
  }
  look.prevLegs = [cloneChain(legs[0]), cloneChain(legs[1])];

  const arms = [0, 1].map((index) => {
    const chain = buildChain(
      shoulderX,
      SHOULDER_Y,
      mirrorLimb(angles.arms[index], face),
      UPPER_ARM,
      FOREARM,
      0,
    );
    return leanChain(chain, hipX, angles.lean);
  }) as [Chain, Chain];

  const head = rotateDeg(headX, angles.headY, hipX, HIP_Y, angles.lean);
  const eye = rotateDeg(
    headX + face * 1.45,
    angles.headY - 0.2,
    hipX,
    HIP_Y,
    angles.lean,
  );
  const shoulder = rotateDeg(shoulderX, SHOULDER_Y, hipX, HIP_Y, angles.lean);

  let ax = 0;
  if (look.vxReady) {
    ax = (sample.vx - look.prevVx) / Math.max(step, 1 / 240);
  } else {
    look.vxReady = true;
  }
  look.prevVx = sample.vx;
  // Opposite velocity, plus a kick from acceleration so a reversal overshoots.
  const hairTarget = clamp(
    (-sample.vx / 280) * 62 + (-ax / 2800) * 28,
    -78,
    78,
  );
  const hair = spring(look.hair, look.hairVel, hairTarget, 42, 6.5, step);
  look.hair = hair.value;
  look.hairVel = hair.vel;

  const spikes = SPIKES.map((spike, index) => {
    const follow = 0.72 + (spike.len / 10.2) * 0.5;
    const flutter = Math.sin(look.time * 11 + index) * (0.8 + speed * 2.2);
    const target =
      spike.rest * (1 - speed * 0.55) + look.hair * follow + flutter;
    const next = spring(
      look.spike[index],
      look.spikeVel[index],
      target,
      26 - index * 2,
      5.2,
      step,
    );
    look.spike[index] = next.value;
    look.spikeVel[index] = next.vel;
    return {
      angle: next.value,
      len: spike.len * (1 + speed * 0.35),
      w: spike.w,
    };
  });

  const hairPoint = place(
    rotateDeg(headX, angles.headY - 4.2, hipX, HIP_Y, angles.lean).x,
    rotateDeg(headX, angles.headY - 4.2, hipX, HIP_Y, angles.lean).y,
    look.compress,
    angles.bob,
  );

  look.visualX = sample.x;
  look.visualY = sample.y;
  look.airborne = !sample.onGround && !sample.climbing;

  return {
    bob: angles.bob,
    lean: angles.lean,
    compress: look.compress,
    hipX,
    hipY: HIP_Y,
    shoulderX: shoulder.x,
    shoulderY: shoulder.y,
    headX: head.x,
    headY: head.y,
    eyeX: eye.x,
    eyeY: eye.y,
    legs,
    arms,
    hairX: hairPoint.x,
    hairY: hairPoint.y,
    spikes,
    planted: [look.plants[0].held, look.plants[1].held],
    footWorldX: [sample.x + legs[0].cx, sample.x + legs[1].cx],
  };
}

export function lookFromBody(body: Body): Look {
  return createLook(body.x, body.y, body.facing);
}
