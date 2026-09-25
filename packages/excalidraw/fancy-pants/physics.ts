export const CHAR_WIDTH = 26;
export const CHAR_HEIGHT = 44;

const GRAVITY = 2800;
const RUN_SPEED = 280;
const GROUND_ACCEL = 2400;
const AIR_ACCEL = 1600;
const JUMP_SPEED = -680;
const CLIMB_SPEED = 170;
const WALL_SLIDE = 80;
const MAX_FALL = 980;
const STEP_UP = 16;
const MAX_STEP_DT = 1 / 90;

export type Anim = "idle" | "run" | "jump" | "climb";

export type Solid = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Body = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  climbing: boolean;
  anim: Anim;
  time: number;
};

export type FancyPantsInput = {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
};

export type FancyPantsElement = {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  strokeWidth?: number;
  isDeleted?: boolean;
  points?: ReadonlyArray<readonly [number, number]>;
};

const FILLED = new Set(["rectangle", "image", "text", "embeddable", "iframe"]);

const HOLLOW = new Set(["frame", "magicframe"]);

const STROKED = new Set(["line", "arrow", "freedraw"]);

export function createBody(x: number, y: number, onGround = false): Body {
  return {
    x,
    y,
    w: CHAR_WIDTH,
    h: CHAR_HEIGHT,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround,
    climbing: false,
    anim: onGround ? "idle" : "jump",
    time: 0,
  };
}

export function shapesToSolids(
  elements: readonly FancyPantsElement[],
): Solid[] {
  const solids: Solid[] = [];

  for (const element of elements) {
    if (element.isDeleted || element.type === "selection") {
      continue;
    }

    if (STROKED.has(element.type)) {
      solids.push(...polylineSolids(element));
      continue;
    }

    if (element.width < 1 && element.height < 1) {
      continue;
    }

    if (HOLLOW.has(element.type)) {
      // Frames read as a border, so the inside of the frame stays open.
      solids.push(
        ...hollowRect(element.x, element.y, element.width, element.height, 14),
      );
      continue;
    }

    const angle = element.angle || 0;

    if (element.type === "ellipse" && !angle) {
      solids.push(...ellipseSlices(element));
      continue;
    }

    if (element.type === "diamond" && !angle) {
      solids.push(...diamondSlices(element));
      continue;
    }

    if (
      FILLED.has(element.type) ||
      element.type === "ellipse" ||
      element.type === "diamond"
    ) {
      solids.push(
        rotatedAabb(element.x, element.y, element.width, element.height, angle),
      );
    }
  }

  return solids;
}

export function spawnBody(
  solids: readonly Solid[],
  viewport: { x: number; y: number; w: number; h: number },
): Body {
  if (!solids.length) {
    return createBody(
      viewport.x + viewport.w / 2 - CHAR_WIDTH / 2,
      viewport.y + viewport.h / 2 - CHAR_HEIGHT / 2,
    );
  }

  const standable = solids.filter((solid) => solid.w >= 8 && solid.h >= 4);
  const pool = standable.length ? standable : solids;
  const platform = pool.reduce((best, solid) => {
    if (solid.x < best.x - 0.5) {
      return solid;
    }
    if (Math.abs(solid.x - best.x) <= 0.5 && solid.y < best.y) {
      return solid;
    }
    return best;
  });

  const inset = Math.max(0, Math.min(8, platform.w - CHAR_WIDTH));

  return createBody(platform.x + inset, platform.y - CHAR_HEIGHT - 0.5, true);
}

export function cameraScrollFor(
  body: Body,
  view: { width: number; height: number; zoom: number },
): { scrollX: number; scrollY: number } {
  const zoom = view.zoom || 1;
  return {
    scrollX: view.width / 2 / zoom - (body.x + body.w / 2),
    scrollY: view.height / 2 / zoom - (body.y + body.h / 2),
  };
}

export function stepBody(
  body: Body,
  solids: readonly Solid[],
  input: FancyPantsInput,
  dt: number,
): Body {
  if (dt > MAX_STEP_DT) {
    let next = body;
    let left = dt;
    let jumpPressed = input.jumpPressed;
    while (left > 1e-6) {
      const slice = Math.min(MAX_STEP_DT, left);
      next = stepBodyOnce(next, solids, { ...input, jumpPressed }, slice);
      jumpPressed = false;
      left -= slice;
    }
    return next;
  }

  return stepBodyOnce(body, solids, input, dt);
}

function stepBodyOnce(
  body: Body,
  solids: readonly Solid[],
  input: FancyPantsInput,
  dt: number,
): Body {
  const next: Body = {
    ...body,
    onGround: false,
    climbing: false,
    time: body.time + dt,
  };

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    next.facing = dir as 1 | -1;
  }

  const accel = body.onGround ? GROUND_ACCEL : AIR_ACCEL;
  if (dir !== 0) {
    next.vx = approach(next.vx, dir * RUN_SPEED, accel * dt);
  } else if (body.onGround) {
    next.vx = approach(next.vx, 0, GROUND_ACCEL * dt);
  }

  next.x += next.vx * dt;

  let wallDir: -1 | 0 | 1 = 0;
  let wall: Solid | null = null;

  for (let pass = 0; pass < 2; pass++) {
    for (const solid of solids) {
      if (!overlaps(next, solid)) {
        continue;
      }
      if (body.y + body.h <= solid.y + 0.8) {
        continue;
      }
      if (body.y >= solid.y + solid.h - 0.8) {
        continue;
      }

      const fromLeft = body.x + body.w <= solid.x + 1.25;
      const fromRight = body.x >= solid.x + solid.w - 1.25;
      const stepRoom = body.y + body.h - solid.y;
      const canStep =
        body.onGround && stepRoom > 0 && stepRoom <= STEP_UP && body.vy >= 0;

      if ((fromLeft && next.vx >= 0) || (!fromRight && next.x < solid.x)) {
        if (canStep && fromLeft) {
          next.y -= stepRoom;
          continue;
        }
        if (
          fromLeft ||
          next.x + next.w - solid.x < solid.x + solid.w - next.x
        ) {
          next.x = solid.x - next.w;
          if (next.vx > 0) {
            next.vx = 0;
          }
          wallDir = 1;
          wall = solid;
        }
      } else if (fromRight || next.x > solid.x) {
        if (canStep && fromRight) {
          next.y -= stepRoom;
          continue;
        }
        next.x = solid.x + solid.w;
        if (next.vx < 0) {
          next.vx = 0;
        }
        wallDir = -1;
        wall = solid;
      }
    }
  }

  const pushingInto =
    (wallDir === 1 && input.right) || (wallDir === -1 && input.left);
  const pushingAway =
    (wallDir === 1 && input.left) || (wallDir === -1 && input.right);
  const wallIsClimbable = !!wall && wall.y < body.y + body.h - 8;

  if (input.jumpPressed && (body.onGround || wallDir !== 0)) {
    next.vy = JUMP_SPEED;
    if (wallDir !== 0 && !body.onGround) {
      next.vx = -wallDir * RUN_SPEED * 0.95;
      next.x += -wallDir * 6;
      wallDir = 0;
      wall = null;
    }
  } else if (wall && pushingInto && wallIsClimbable) {
    next.climbing = true;
    next.vy = -CLIMB_SPEED;
    next.vx = wallDir * 50;
  } else if (wall && !pushingAway && !body.onGround) {
    if (next.vy >= 0) {
      next.vy = WALL_SLIDE;
    }
    next.climbing = true;
    next.vx = wallDir * 40;
  } else {
    next.vy = Math.min(MAX_FALL, next.vy + GRAVITY * dt);
  }

  const prevY = next.y;
  next.y += next.vy * dt;

  for (const solid of solids) {
    if (!overlapX(next, solid)) {
      continue;
    }

    const prevBottom = prevY + next.h;
    const nextBottom = next.y + next.h;
    if (
      next.vy >= 0 &&
      prevBottom <= solid.y + 1 &&
      nextBottom >= solid.y &&
      next.x + next.w > solid.x + 0.5 &&
      next.x < solid.x + solid.w - 0.5
    ) {
      next.y = solid.y - next.h;
      next.vy = 0;
      next.onGround = true;
      next.climbing = false;
      continue;
    }

    if (
      next.vy < 0 &&
      prevY >= solid.y + solid.h - 1 &&
      next.y <= solid.y + solid.h
    ) {
      next.y = solid.y + solid.h;
      next.vy = 0;
      if (next.climbing) {
        next.climbing = false;
      }
    }
  }

  if (next.climbing && wall && pushingInto) {
    const feet = next.y + next.h;
    if (feet <= wall.y + 4) {
      const landedX =
        wallDir === 1
          ? Math.min(wall.x + 2, wall.x + Math.max(0, wall.w - next.w))
          : Math.max(wall.x, wall.x + wall.w - next.w - 2);
      next.x = landedX;
      next.y = wall.y - next.h;
      next.vy = 0;
      next.vx = wallDir * 60;
      next.onGround = true;
      next.climbing = false;
    }
  }

  if (next.climbing) {
    next.anim = "climb";
  } else if (!next.onGround) {
    next.anim = "jump";
  } else if (Math.abs(next.vx) > 18 || dir !== 0) {
    next.anim = "run";
  } else {
    next.anim = "idle";
  }

  return next;
}

function polylineSolids(element: FancyPantsElement): Solid[] {
  const points = element.points;
  if (!points || points.length < 2) {
    return [];
  }

  const thickness = Math.max(14, (element.strokeWidth || 1) + 10);
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const angle = element.angle || 0;
  const solids: Solid[] = [];

  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = rotatePoint(
      element.x + points[i - 1][0],
      element.y + points[i - 1][1],
      cx,
      cy,
      angle,
    );
    const [x2, y2] = rotatePoint(
      element.x + points[i][0],
      element.y + points[i][1],
      cx,
      cy,
      angle,
    );
    solids.push(...segmentSolids(x1, y1, x2, y2, thickness));
  }

  return solids;
}

function segmentSolids(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
): Solid[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 0.5 && ady < 0.5) {
    return [];
  }

  if (ady <= adx * 0.4) {
    return [
      {
        x: Math.min(x1, x2),
        y: (y1 + y2) / 2 - thickness / 2,
        w: Math.max(adx, thickness),
        h: thickness,
      },
    ];
  }

  if (adx <= ady * 0.4) {
    return [
      {
        x: (x1 + x2) / 2 - thickness / 2,
        y: Math.min(y1, y2),
        w: thickness,
        h: Math.max(ady, thickness),
      },
    ];
  }

  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / (thickness * 0.55)));
  const solids: Solid[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    solids.push({
      x: x1 + dx * t - thickness / 2,
      y: y1 + dy * t - thickness / 2,
      w: thickness,
      h: thickness,
    });
  }
  return solids;
}

function ellipseSlices(element: FancyPantsElement): Solid[] {
  return slicedShape(element, (mid) => {
    const ny = (mid - 0.5) * 2;
    return Math.sqrt(Math.max(0, 1 - ny * ny));
  });
}

function diamondSlices(element: FancyPantsElement): Solid[] {
  return slicedShape(element, (mid) => {
    return mid <= 0.5 ? mid / 0.5 : (1 - mid) / 0.5;
  });
}

function slicedShape(
  element: FancyPantsElement,
  halfScale: (mid: number) => number,
): Solid[] {
  const slices = 8;
  const solids: Solid[] = [];
  for (let i = 0; i < slices; i++) {
    const t0 = i / slices;
    const t1 = (i + 1) / slices;
    const mid = (t0 + t1) / 2;
    const span = Math.max(4, element.width * halfScale(mid));
    solids.push({
      x: element.x + element.width / 2 - span / 2,
      y: element.y + element.height * t0,
      w: span,
      h: Math.max(1, element.height * (t1 - t0)),
    });
  }
  return solids;
}

function hollowRect(
  x: number,
  y: number,
  w: number,
  h: number,
  thickness: number,
): Solid[] {
  const t = Math.min(thickness, w / 3, h / 3);
  if (t <= 0) {
    return [];
  }
  return [
    { x, y, w, h: t },
    { x, y: y + h - t, w, h: t },
    { x, y, w: t, h },
    { x: x + w - t, y, w: t, h },
  ];
}

function rotatedAabb(
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
): Solid {
  if (!angle) {
    return { x, y, w, h };
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  const corners: Array<[number, number]> = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of corners) {
    const [rx, ry] = rotatePoint(px, py, cx, cy, angle);
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angle: number,
): [number, number] {
  if (!angle) {
    return [px, py];
  }
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [dx * cos - dy * sin + cx, dx * sin + dy * cos + cy];
}

function approach(value: number, target: number, delta: number) {
  if (value < target) {
    return Math.min(target, value + delta);
  }
  if (value > target) {
    return Math.max(target, value - delta);
  }
  return target;
}

function overlapX(a: { x: number; w: number }, b: { x: number; w: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: Solid) {
  return overlapX(a, b) && a.y < b.y + b.h && a.y + a.h > b.y;
}
