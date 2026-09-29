import type { Body } from "./physics";

/** Fixed physics step. Rendering interpolates the leftover fraction. */
export const PHYSICS_DT = 1 / 120;

/**
 * The collision body stays 26×44 scene units, while the drawn character is
 * deliberately larger. Pose-space/world-space conversions must include this
 * scale or a numerically "planted" foot visibly skates.
 */
export const CHARACTER_RENDER_SCALE = 3;

/** World distance for one full stride (both feet). */
export const STRIDE = 104;

/** How hard a landing squashes the figure toward the feet. */
export const BODY_SQUASH = 0.42;

const CLIMB_STRIDE = 64;
const HIP_Y = 28.4;
const RUN_HIP_Y = 27.2;
const SHOULDER_Y = 15.4;
const HEAD_Y = 8.3;
const GROUND_Y = 42.3;
const THIGH = 11.6;
const SHIN = 11.0;
const RUN_THIGH = 13.6;
const RUN_SHIN = 12.8;
const IDLE_THIGH = 8.8;
const IDLE_SHIN = 8.3;
const UPPER_ARM = 6.6;
const FOREARM = 5.8;
const FOOT = 4.2;
const CX = 13;
const TURN_TIME = 0.48;
const STANCE_FRONT = STRIDE / 4 / CHARACTER_RENDER_SCALE;
const STANCE_BACK = -STANCE_FRONT;
const SWING_LIFT = 9;
const SPIKES = [
  { rest: -12, len: 7.5, w: 2.5, k: 34, c: 8.5 },
  { rest: -6, len: 10.5, w: 2.7, k: 28, c: 7.5 },
  { rest: 0, len: 13, w: 2.8, k: 23, c: 6.7 },
  { rest: 6, len: 10.2, w: 2.6, k: 19, c: 6.1 },
  { rest: 12, len: 7.2, w: 2.4, k: 16, c: 5.7 },
];

const MODES = ["idle", "run", "jump", "fall", "climb"] as const;
type Mode = typeof MODES[number];

type Limb = { hip: number; knee: number; ankle: number };

type Plant = {
  held: boolean;
  worldX: number;
};

type Stick = {
  lean: number;
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
};

export type Look = {
  phase: number;
  climbPhase: number;
  /** Eased facing, -1..1. Limb geometry does not use this as a scale. */
  face: number;
  turnFrom: number;
  turnTo: number;
  turnU: number;
  skidFace: 1 | -1;
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
  takeoffAge: number;
  lastGroundY: number;
  wasClimbing: boolean;
  mountU: number;
  mountFrom: Stick | null;
  dismountU: number;
  dismountFrom: Stick | null;
  brakeFrom: Stick | null;
  prevStick: Stick | null;
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
  /** Scene pixels to hold the sprite on the ground during takeoff. */
  drop: number;
  shadowY: number;
  shadowOpacity: number;
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

const emptyPlant = (): Plant => ({ held: false, worldX: 0 });

const blankChain = (): Chain => ({
  ax: CX,
  ay: RUN_HIP_Y,
  bx: CX,
  by: RUN_HIP_Y,
  cx: CX,
  cy: GROUND_Y,
  dx: CX,
  dy: GROUND_Y,
});

export function createLook(x: number, y: number, facing: 1 | -1 = 1): Look {
  return {
    phase: 0,
    climbPhase: 0,
    face: facing,
    turnFrom: facing,
    turnTo: facing,
    turnU: 1,
    skidFace: facing,
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
    takeoffAge: -1,
    lastGroundY: y,
    wasClimbing: false,
    mountU: 1,
    mountFrom: null,
    dismountU: 1,
    dismountFrom: null,
    brakeFrom: null,
    prevStick: null,
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
const STANCE_A = 0.06;
const STANCE_B = 0.44;

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

function solveJoint(
  ax: number,
  ay: number,
  tx: number,
  ty: number,
  upper: number,
  lower: number,
) {
  let dx = tx - ax;
  let dy = ty - ay;
  let dist = Math.hypot(dx, dy) || 0.001;
  const max = upper + lower - 0.05;
  const min = Math.abs(upper - lower) + 0.05;
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
      (upper * upper + dist * dist - lower * lower) / (2 * upper * dist),
      -1,
      1,
    ),
  );
  const options = [1, -1].map((sign) => {
    const thigh = aim + sign * hipOff;
    return {
      bx: ax + Math.sin(thigh) * upper,
      by: ay + Math.cos(thigh) * upper,
    };
  });
  options.sort((a, b) => a.by - b.by);
  return {
    bx: options[0].bx,
    by: options[0].by,
    cx: ax + dx,
    cy: ay + dy,
  };
}

function makeLeg(
  hipX: number,
  hipY: number,
  ankleX: number,
  ankleY: number,
  toeDir: number,
  toeLift: number,
  thigh = RUN_THIGH,
  shin = RUN_SHIN,
): Chain {
  const ik = solveJoint(hipX, hipY, ankleX, ankleY, thigh, shin);
  return {
    ax: hipX,
    ay: hipY,
    bx: ik.bx,
    by: ik.by,
    cx: ik.cx,
    cy: ik.cy,
    dx: ik.cx + toeDir * FOOT,
    dy: ik.cy - toeLift,
  };
}

function makeArm(sx: number, sy: number, hx: number, hy: number): Chain {
  const ik = solveJoint(sx, sy, hx, hy, UPPER_ARM, FOREARM);
  return {
    ax: sx,
    ay: sy,
    bx: ik.bx,
    by: ik.by,
    cx: ik.cx,
    cy: ik.cy,
    dx: ik.cx,
    dy: ik.cy,
  };
}

function rotateDeg(x: number, y: number, ox: number, oy: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = x - ox;
  const dy = y - oy;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: ox + dx * c - dy * s, y: oy + dx * s + dy * c };
}

function rotateChain(chain: Chain, ox: number, oy: number, deg: number): Chain {
  const turn = (x: number, y: number) => rotateDeg(x, y, ox, oy, deg);
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

function cloneChain(chain: Chain): Chain {
  return { ...chain };
}

function cloneStick(stick: Stick): Stick {
  return {
    ...stick,
    legs: [cloneChain(stick.legs[0]), cloneChain(stick.legs[1])],
    arms: [cloneChain(stick.arms[0]), cloneChain(stick.arms[1])],
  };
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

function mixStick(a: Stick, b: Stick, t: number): Stick {
  const m = (from: number, to: number) => lerp(from, to, t);
  return {
    lean: m(a.lean, b.lean),
    hipX: m(a.hipX, b.hipX),
    hipY: m(a.hipY, b.hipY),
    shoulderX: m(a.shoulderX, b.shoulderX),
    shoulderY: m(a.shoulderY, b.shoulderY),
    headX: m(a.headX, b.headX),
    headY: m(a.headY, b.headY),
    eyeX: m(a.eyeX, b.eyeX),
    eyeY: m(a.eyeY, b.eyeY),
    legs: [
      mixChain(a.legs[0], b.legs[0], t),
      mixChain(a.legs[1], b.legs[1], t),
    ],
    arms: [
      mixChain(a.arms[0], b.arms[0], t),
      mixChain(a.arms[1], b.arms[1], t),
    ],
  };
}

function moveToward(
  px: number,
  py: number,
  tx: number,
  ty: number,
  max: number,
) {
  const dx = tx - px;
  const dy = ty - py;
  const dist = Math.hypot(dx, dy);
  if (dist <= max || dist < 1e-6) {
    return { x: tx, y: ty };
  }
  const s = max / dist;
  return { x: px + dx * s, y: py + dy * s };
}

function capChain(prev: Chain, next: Chain, max: number): Chain {
  const a = moveToward(prev.ax, prev.ay, next.ax, next.ay, max);
  const b = moveToward(prev.bx, prev.by, next.bx, next.by, max);
  const c = moveToward(prev.cx, prev.cy, next.cx, next.cy, max);
  const d = moveToward(prev.dx, prev.dy, next.dx, next.dy, max);
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

function capStick(prev: Stick, next: Stick, max: number): Stick {
  const shoulder = moveToward(
    prev.shoulderX,
    prev.shoulderY,
    next.shoulderX,
    next.shoulderY,
    max,
  );
  const head = moveToward(prev.headX, prev.headY, next.headX, next.headY, max);
  const eye = moveToward(prev.eyeX, prev.eyeY, next.eyeX, next.eyeY, max);
  const hip = moveToward(prev.hipX, prev.hipY, next.hipX, next.hipY, max);
  return {
    lean: next.lean,
    hipX: hip.x,
    hipY: hip.y,
    shoulderX: shoulder.x,
    shoulderY: shoulder.y,
    headX: head.x,
    headY: head.y,
    eyeX: eye.x,
    eyeY: eye.y,
    legs: [
      capChain(prev.legs[0], next.legs[0], max),
      capChain(prev.legs[1], next.legs[1], max),
    ],
    arms: [
      capChain(prev.arms[0], next.arms[0], max),
      capChain(prev.arms[1], next.arms[1], max),
    ],
  };
}

function clearPlants(look: Look) {
  look.plants[0].held = false;
  look.plants[1].held = false;
}

const visibleFootX = (bodyX: number, localX: number) =>
  bodyX + CX + (localX - CX) * CHARACTER_RENDER_SCALE;

const localFootX = (bodyX: number, worldX: number) =>
  CX + (worldX - bodyX - CX) / CHARACTER_RENDER_SCALE;

/** Feet positions for one gait cycle. Exactly one foot is in stance. */
function footLocal(u: number, face: number, hipX: number) {
  const t = wrap(u);
  if (t < 0.5) {
    const along = t / 0.5;
    return {
      x: hipX + lerp(STANCE_FRONT, STANCE_BACK, along) * face,
      y: GROUND_Y,
      lift: 0,
      stance: true,
    };
  }
  const s = (t - 0.5) / 0.5;
  const along = Math.sin((s * Math.PI) / 2);
  return {
    x: hipX + lerp(STANCE_BACK, STANCE_FRONT, along) * face,
    y: GROUND_Y - Math.sin(s * Math.PI) * SWING_LIFT,
    lift: Math.sin(s * Math.PI) * 2.6,
    stance: false,
  };
}

function applyLean(
  stick: Stick,
  lean: number,
  eyeOffset: number,
  headDrop: number,
) {
  const hipX = stick.hipX;
  const hipY = stick.hipY;
  const shoulder = rotateDeg(hipX, SHOULDER_Y, hipX, hipY, lean);
  const head = rotateDeg(hipX, HEAD_Y + headDrop, hipX, hipY, lean);
  const eye = rotateDeg(
    hipX + eyeOffset,
    HEAD_Y + headDrop - 0.2,
    hipX,
    hipY,
    lean,
  );
  stick.lean = lean;
  stick.shoulderX = shoulder.x;
  stick.shoulderY = shoulder.y;
  stick.headX = head.x;
  stick.headY = head.y;
  stick.eyeX = eye.x;
  stick.eyeY = eye.y;
  stick.arms = [
    rotateChain(stick.arms[0], hipX, hipY, lean),
    rotateChain(stick.arms[1], hipX, hipY, lean),
  ];
}

function armPair(hipX: number, phase: number, face: number): [Chain, Chain] {
  return [0, 1].map((index) => {
    const swing = Math.cos(wrap(phase + index * 0.5) * Math.PI * 2);
    return makeArm(
      hipX,
      SHOULDER_Y,
      hipX + -7.4 * swing * face,
      SHOULDER_Y + 6.6,
    );
  }) as [Chain, Chain];
}

function baseStick(): Stick {
  return {
    lean: 0,
    hipX: CX,
    hipY: RUN_HIP_Y,
    shoulderX: CX,
    shoulderY: SHOULDER_Y,
    headX: CX,
    headY: HEAD_Y,
    eyeX: CX,
    eyeY: HEAD_Y - 0.2,
    legs: [blankChain(), blankChain()],
    arms: [blankChain(), blankChain()],
  };
}

function poseFeet(
  offsets: [number, number],
  ys: [number, number],
  face: number,
  lifts: [number, number] = [0, 0],
): [Chain, Chain] {
  return [0, 1].map((index) =>
    makeLeg(
      CX,
      RUN_HIP_Y,
      CX + offsets[index] * face,
      ys[index],
      face || (index === 0 ? 1 : -1),
      lifts[index],
    ),
  ) as [Chain, Chain];
}

function idleStick(time: number, face: number): Stick {
  const sway = Math.sin(time * 2.2) * 0.6;
  const stick = baseStick();
  const dir = face || 1;
  stick.legs = [2.4 + sway, -1.8 - sway].map((offset, index) =>
    makeLeg(
      CX,
      RUN_HIP_Y,
      CX + offset * dir,
      GROUND_Y,
      index === 0 ? dir : -dir,
      0,
      IDLE_THIGH,
      IDLE_SHIN,
    ),
  ) as [Chain, Chain];
  stick.arms = [
    makeArm(CX, SHOULDER_Y, CX - 1.4 * dir, SHOULDER_Y + 8.2),
    makeArm(CX, SHOULDER_Y, CX + 1.6 * dir, SHOULDER_Y + 7.6),
  ];
  applyLean(stick, 2 * dir, 1.35 * dir, Math.sin(time * 2.4) * 0.25);
  return stick;
}

function kinematicRun(phase: number, face: number): Stick {
  const stick = baseStick();
  stick.legs = [0, 1].map((index) => {
    const foot = footLocal(phase + index * 0.5, face, CX);
    return makeLeg(CX, RUN_HIP_Y, foot.x, foot.y, face, foot.lift);
  }) as [Chain, Chain];
  stick.arms = armPair(CX, phase, face);
  applyLean(stick, 16 * face, 1.7 * face, 0);
  return stick;
}

/**
 * Stance ankle stays at a fixed world X. The swing foot is the only one
 * that leaves the ground. Phase 0..0.5 and 0.5..1 never overlap.
 */
function lockedRun(
  phase: number,
  face: number,
  sample: LookSample,
  look: Look,
): Stick {
  const stick = baseStick();
  stick.arms = armPair(CX, phase, face);
  stick.legs = [0, 1].map((index) => {
    const foot = footLocal(phase + index * 0.5, face, CX);
    const plant = look.plants[index];
    if (foot.stance) {
      if (!plant.held) {
        const prevX = look.prevStick?.legs[index].cx;
        plant.worldX =
          prevX === undefined
            ? visibleFootX(sample.x, foot.x)
            : visibleFootX(look.visualX, prevX);
        plant.held = true;
      }
      const ankleX = localFootX(sample.x, plant.worldX);
      return makeLeg(CX, RUN_HIP_Y, ankleX, GROUND_Y, face, 0);
    }
    plant.held = false;
    return makeLeg(CX, RUN_HIP_Y, foot.x, foot.y, face, foot.lift);
  }) as [Chain, Chain];
  applyLean(stick, 16 * face, 1.7 * face, 0);
  return stick;
}

function brakeStick(oldFace: number): Stick {
  const stick = baseStick();
  stick.legs = poseFeet([8, -6], [GROUND_Y, GROUND_Y], oldFace);
  stick.arms = [
    makeArm(CX, SHOULDER_Y, CX - 9 * oldFace, SHOULDER_Y + 1.2),
    makeArm(CX, SHOULDER_Y, CX + 7 * oldFace, SHOULDER_Y + 8.4),
  ];
  applyLean(stick, -38 * oldFace, 1.7 * oldFace, 0.4);
  return stick;
}

function narrowStick(): Stick {
  const stick = baseStick();
  stick.legs = [
    makeLeg(CX, RUN_HIP_Y, CX + 1.3, GROUND_Y, 1, 0),
    makeLeg(CX, RUN_HIP_Y, CX - 1.3, GROUND_Y, -1, 0),
  ];
  stick.arms = [
    makeArm(CX, SHOULDER_Y, CX + 1.4, SHOULDER_Y + 8),
    makeArm(CX, SHOULDER_Y, CX - 1.4, SHOULDER_Y + 8),
  ];
  applyLean(stick, 0, 0, 0.6);
  return stick;
}

function squashStick(face: number): Stick {
  const stick = baseStick();
  stick.legs = poseFeet([3.2, -2.4], [GROUND_Y, GROUND_Y], face || 1);
  stick.arms = [
    makeArm(CX, SHOULDER_Y, CX - 4 * face, SHOULDER_Y + 4),
    makeArm(CX, SHOULDER_Y, CX + 2 * face, SHOULDER_Y + 5),
  ];
  applyLean(stick, 8 * face, 1.2 * face, 3.2);
  return stick;
}

function flightStick(kind: string, face: number): Stick {
  const dir = face || 1;
  const stick = baseStick();
  if (kind === "crouch") {
    stick.legs = poseFeet([1.2, -0.8], [RUN_HIP_Y + 4.6, RUN_HIP_Y + 5.2], dir);
    stick.arms = [
      makeArm(CX, SHOULDER_Y, CX - 3 * dir, SHOULDER_Y + 3),
      makeArm(CX, SHOULDER_Y, CX + 1 * dir, SHOULDER_Y + 4),
    ];
    applyLean(stick, 12 * dir, 1.4 * dir, 2.4);
    return stick;
  }
  if (kind === "extend") {
    stick.legs = poseFeet([-12, 5], [GROUND_Y - 0.4, GROUND_Y - 1.2], dir);
    stick.arms = [
      makeArm(CX, SHOULDER_Y, CX + 2 * dir, SHOULDER_Y - 6),
      makeArm(CX, SHOULDER_Y, CX + 5 * dir, SHOULDER_Y - 4),
    ];
    applyLean(stick, -10 * dir, 1.6 * dir, -0.6);
    return stick;
  }
  if (kind === "rise") {
    stick.legs = poseFeet(
      [-7.5, 5.5],
      [GROUND_Y - 5, GROUND_Y - 8],
      dir,
      [0.8, 1.2],
    );
    stick.arms = [
      makeArm(CX, SHOULDER_Y, CX + 4 * dir, SHOULDER_Y - 4.5),
      makeArm(CX, SHOULDER_Y, CX - 2 * dir, SHOULDER_Y - 2),
    ];
    applyLean(stick, -4 * dir, 1.5 * dir, -0.2);
    return stick;
  }
  if (kind === "apex") {
    stick.legs = poseFeet([2.4, -1.2], [RUN_HIP_Y + 6.2, RUN_HIP_Y + 6.8], dir);
    stick.arms = [
      makeArm(CX, SHOULDER_Y, CX - 1 * dir, SHOULDER_Y - 5),
      makeArm(CX, SHOULDER_Y, CX + 3 * dir, SHOULDER_Y - 3),
    ];
    applyLean(stick, 2 * dir, 1.3 * dir, 0.2);
    return stick;
  }
  if (kind === "fall") {
    stick.legs = poseFeet(
      [7, -6],
      [GROUND_Y - 7, GROUND_Y - 6],
      dir,
      [1.2, 1.4],
    );
    stick.arms = [
      makeArm(CX, SHOULDER_Y, CX - 6 * dir, SHOULDER_Y - 2),
      makeArm(CX, SHOULDER_Y, CX + 2 * dir, SHOULDER_Y - 1),
    ];
    applyLean(stick, 14 * dir, 1.5 * dir, 0.4);
    return stick;
  }
  stick.legs = poseFeet(
    [9, 2],
    [GROUND_Y - 0.4, GROUND_Y - 1.1],
    dir,
    [0.4, 0.8],
  );
  stick.arms = [
    makeArm(CX, SHOULDER_Y, CX + 1 * dir, SHOULDER_Y + 2),
    makeArm(CX, SHOULDER_Y, CX - 3 * dir, SHOULDER_Y + 3),
  ];
  applyLean(stick, 6 * dir, 1.4 * dir, 0.8);
  return stick;
}

function climbStick(phase: number, face: number, up: boolean): Stick {
  const lean = up ? 12 : 6;
  const hipX = CX + 1.8 * face;
  const shoulderX = CX + 2.8 * face;
  const headX = CX + 2.4 * face;
  const cycle = (index: number) =>
    (phase + index * 0.5) * Math.PI * 2;
  const legs = [0, 1].map((index) => {
    const a = cycle(index);
    const ankleX = CX + face * (7.2 + Math.cos(a) * 1.6);
    const ankleY = 34.5 - Math.sin(a) * 5.5;
    return makeLeg(hipX, HIP_Y, ankleX, ankleY, face, 0.7, THIGH, SHIN);
  }) as [Chain, Chain];
  const arms = [0, 1].map((index) => {
    const a = cycle(index);
    return makeArm(
      shoulderX,
      SHOULDER_Y,
      CX + face * (8.8 + Math.cos(a) * 1.4),
      11.5 + Math.sin(a) * 5,
    );
  }) as [Chain, Chain];
  const shoulder = rotateDeg(shoulderX, SHOULDER_Y, hipX, HIP_Y, lean * face);
  const head = rotateDeg(headX, HEAD_Y, hipX, HIP_Y, lean * face);
  const eye = rotateDeg(
    headX + face * 1.45,
    HEAD_Y - 0.2,
    hipX,
    HIP_Y,
    lean * face,
  );
  return {
    lean,
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
  };
}

function enforcePlants(
  stick: Stick,
  look: Look,
  sample: LookSample,
  face: number,
) {
  look.plants.forEach((plant, index) => {
    if (!plant.held) {
      return;
    }
    stick.legs[index] = makeLeg(
      stick.hipX,
      stick.hipY,
      localFootX(sample.x, plant.worldX),
      GROUND_Y,
      face,
      0,
    );
  });
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

export type FlightStage =
  | "crouch"
  | "extend"
  | "rise"
  | "apex"
  | "fall"
  | "reach";

export function flightStage(age: number, vy: number): FlightStage {
  if (age < 0.1) {
    return "crouch";
  }
  if (age < 0.17) {
    return "extend";
  }
  if (vy < -90) {
    return "rise";
  }
  if (vy < 130) {
    return "apex";
  }
  if (vy < 390) {
    return "fall";
  }
  return "reach";
}

function turnStick(look: Look, phase: number): Stick {
  const from = look.brakeFrom ?? kinematicRun(phase, look.skidFace);
  const brake = brakeStick(look.skidFace);
  const narrow = narrowStick();
  const next = kinematicRun(phase, look.turnTo as 1 | -1);
  const u = look.turnU;
  if (u < 0.34) {
    return mixStick(from, brake, smooth(u / 0.34));
  }
  if (u < 0.67) {
    return mixStick(brake, narrow, smooth((u - 0.34) / 0.33));
  }
  return mixStick(narrow, next, smooth((u - 0.67) / 0.33));
}

/**
 * Advance the drawable pose by one rendered frame.
 * A reversal freezes the stride and blends joint positions through a brake
 * and a narrow in-between pose. Hair is a world-space spring.
 */
export function stepLook(
  look: Look,
  sample: LookSample,
  dt: number,
): FramePose {
  const step = clamp(dt, 0, 0.05);
  look.time += step;

  const dx = clamp(sample.x - look.visualX, -500 * step, 500 * step);
  const dy = clamp(sample.y - look.visualY, -1200 * step, 1200 * step);

  if (sample.facing !== look.turnTo) {
    look.skidFace = look.turnTo < 0 ? -1 : 1;
    look.brakeFrom = look.prevStick ? cloneStick(look.prevStick) : null;
    look.turnFrom = look.face;
    look.turnTo = sample.facing;
    look.turnU = 0;
    clearPlants(look);
  }
  if (look.turnU < 1) {
    look.turnU = Math.min(1, look.turnU + step / TURN_TIME);
    look.face = lerp(look.turnFrom, look.turnTo, smooth(look.turnU));
  } else {
    look.face = look.turnTo;
  }

  // The stride keeps spinning if phase advances through the brake.
  if (look.turnU >= 1) {
    look.phase = wrap(look.phase + Math.abs(dx) / STRIDE);
  }
  if (sample.climbing) {
    look.climbPhase = wrap(look.climbPhase + Math.abs(dy) / CLIMB_STRIDE);
  }

  const mode = modeOf(sample);
  const blend = 1 - Math.exp(-12 * step);
  for (const key of MODES) {
    const target = key === mode ? 1 : 0;
    look.weights[key] += (target - look.weights[key]) * blend;
  }

  const braking = look.turnU < 1;
  if (sample.climbing) {
    look.airTime = 0;
    look.landAge = -1;
    look.takeoffAge = -1;
  } else if (!sample.onGround) {
    if (look.takeoffAge < 0) {
      look.takeoffAge = 0;
    }
    look.takeoffAge += step;
    look.airTime = look.takeoffAge;
    look.landAge = -1;
  } else {
    if (look.airborne) {
      look.landAge = 0;
    }
    if (look.landAge >= 0) {
      look.landAge += step;
    }
    look.airTime = 0;
    look.takeoffAge = -1;
    look.lastGroundY = sample.y;
  }

  const landing = sample.onGround && look.landAge >= 0 && look.landAge < 0.42;
  const dir = (braking ? look.turnTo : sample.facing) as 1 | -1;
  let cap = 8;
  let target: Stick;

  if (sample.climbing) {
    const climb = climbStick(look.climbPhase, sample.facing, sample.vy <= 0);
    if (!look.wasClimbing) {
      look.mountFrom = look.prevStick ? cloneStick(look.prevStick) : null;
      look.mountU = look.mountFrom ? 0 : 1;
      look.wasClimbing = true;
    }
    if (look.mountFrom && look.mountU < 1) {
      look.mountU = Math.min(1, look.mountU + step / 0.22);
      target = mixStick(look.mountFrom, climb, smooth(look.mountU));
    } else {
      target = climb;
    }
    look.dismountFrom = cloneStick(target);
    look.dismountU = 1;
    clearPlants(look);
    cap = look.mountU < 1 ? 2.4 : 99;
  } else if (look.wasClimbing || look.dismountU < 1) {
    if (look.wasClimbing) {
      look.wasClimbing = false;
      look.dismountU = 0;
    }
    look.dismountU = Math.min(1, look.dismountU + step / 0.28);
    const ground = idleStick(look.time, sample.facing);
    target = look.dismountFrom
      ? mixStick(look.dismountFrom, ground, smooth(look.dismountU))
      : ground;
    clearPlants(look);
    cap = 2.4;
  } else if (braking) {
    target = turnStick(look, look.phase);
    clearPlants(look);
    cap = 4;
  } else if (!sample.onGround) {
    target = flightStick(flightStage(look.takeoffAge, sample.vy), dir);
    clearPlants(look);
    cap = 2;
  } else if (landing) {
    const squash = squashStick(sample.facing);
    // Hold the crouch through the squash peak, then open back into the run.
    if (look.landAge < 0.16) {
      target = squash;
    } else {
      const run = kinematicRun(look.phase, sample.facing);
      target = mixStick(squash, run, smooth((look.landAge - 0.16) / 0.26));
    }
    clearPlants(look);
    cap = 2;
  } else if (
    sample.onGround &&
    Math.abs(sample.vx) > 18 &&
    look.weights.run > 0.92
  ) {
    target = lockedRun(look.phase, sample.facing, sample, look);
    cap = 8;
  } else {
    const run = kinematicRun(look.phase, sample.facing || look.turnTo);
    target = mixStick(
      idleStick(look.time, sample.facing || look.turnTo),
      run,
      clamp(look.weights.run / 0.92, 0, 1),
    );
    clearPlants(look);
    cap = 2.4;
  }

  if (look.prevStick && cap < 90) {
    target = capStick(look.prevStick, target, cap);
  }
  if (!sample.climbing && !braking && !landing && sample.onGround) {
    enforcePlants(target, look, sample, sample.facing);
  }

  let ax = 0;
  if (look.vxReady) {
    ax = (sample.vx - look.prevVx) / Math.max(step, 1 / 240);
  } else {
    look.vxReady = true;
  }
  look.prevVx = sample.vx;
  const hairTarget = clamp(
    (-sample.vx / 280) * 70 + clamp(-ax / 8000, -16, 16),
    -78,
    78,
  );
  const hair = spring(look.hair, look.hairVel, hairTarget, 14, 3.2, step);
  look.hair = hair.value;
  look.hairVel = hair.vel;

  const spikes = SPIKES.map((spike, index) => {
    const next = spring(
      look.spike[index],
      look.spikeVel[index],
      spike.rest + look.hair,
      spike.k,
      spike.c,
      step,
    );
    look.spike[index] = next.value;
    look.spikeVel[index] = next.vel;
    return { angle: next.value, len: spike.len, w: spike.w };
  });

  let compress = 0;
  if (
    !sample.onGround &&
    !sample.climbing &&
    look.takeoffAge >= 0 &&
    look.takeoffAge < 0.16
  ) {
    const rise = smooth(look.takeoffAge / 0.08);
    const fall = 1 - smooth(clamp((look.takeoffAge - 0.07) / 0.09, 0, 1));
    compress = 0.62 * rise * fall;
  }
  if (look.landAge >= 0 && look.landAge < 0.24) {
    compress = Math.sin(Math.PI * clamp(look.landAge / 0.24, 0, 1));
  }
  if (braking) {
    const brakeU = clamp(look.turnU / 0.7, 0, 1);
    compress = Math.max(compress, Math.sin(brakeU * Math.PI) * 0.42);
  }
  look.compress = compress;

  let drop = 0;
  if (
    !sample.onGround &&
    !sample.climbing &&
    sample.vy < -80 &&
    look.takeoffAge >= 0
  ) {
    const hold = 0.1;
    const release = 0.12;
    const pin = look.lastGroundY - sample.y;
    if (look.takeoffAge < hold) {
      drop = pin;
    } else if (look.takeoffAge < hold + release) {
      const t = (look.takeoffAge - hold) / release;
      drop = pin * (1 - smooth(t));
    }
  }

  const sy = 1 - clamp(compress, -0.35, 1.2) * BODY_SQUASH;
  const hairY = GROUND_Y + sy * (target.headY - GROUND_Y);
  const heightFromGround = Math.max(0, look.lastGroundY - sample.y - drop);
  const shadowY =
    GROUND_Y + heightFromGround / CHARACTER_RENDER_SCALE;
  const shadowOpacity = sample.climbing
    ? 0
    : sample.onGround
      ? 0.16
      : 0.13 * (1 - clamp(heightFromGround / 140, 0, 0.8));

  look.prevStick = cloneStick(target);
  look.visualX = sample.x;
  look.visualY = sample.y;
  look.airborne = !sample.onGround && !sample.climbing;

  return {
    bob: 0,
    lean: target.lean,
    compress,
    drop,
    shadowY,
    shadowOpacity,
    hipX: target.hipX,
    hipY: target.hipY,
    shoulderX: target.shoulderX,
    shoulderY: target.shoulderY,
    headX: target.headX,
    headY: target.headY,
    eyeX: target.eyeX,
    eyeY: target.eyeY,
    legs: target.legs,
    arms: target.arms,
    hairX: target.headX,
    hairY,
    spikes,
    planted: [look.plants[0].held, look.plants[1].held],
    footWorldX: [
      visibleFootX(sample.x, target.legs[0].cx),
      visibleFootX(sample.x, target.legs[1].cx),
    ],
  };
}

export function lookFromBody(body: Body): Look {
  return createLook(body.x, body.y, body.facing);
}
