import {
  CHAR_HEIGHT,
  CHAR_WIDTH,
  cameraScrollFor,
  createBody,
  shapesToSolids,
  spawnBody,
  stepBody,
} from "./physics";
import {
  controlToken,
  inputFromTokens,
  isGameControl,
  isJumpToken,
  queueJump,
} from "./controls";

import type { FancyPantsElement, Solid } from "./physics";

const DT = 1 / 60;

const run = (
  body: ReturnType<typeof createBody>,
  solids: readonly Solid[],
  input: { left?: boolean; right?: boolean; jump?: boolean },
  seconds: number,
) => {
  let next = body;
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) {
    next = stepBody(
      next,
      solids,
      {
        left: !!input.left,
        right: !!input.right,
        jumpPressed: !!input.jump && i === 0,
      },
      DT,
    );
  }
  return next;
};

describe("fancy pants physics", () => {
  const floor: Solid = { x: 0, y: 200, w: 600, h: 40 };

  it("lands on a rectangle and idles", () => {
    const start = createBody(40, 40);
    const landed = run(start, [floor], {}, 1.2);

    expect(landed.onGround).toBe(true);
    expect(landed.y + landed.h).toBeCloseTo(floor.y, 1);
    expect(landed.anim).toBe("idle");
    expect(landed.vy).toBe(0);
  });

  it("runs to the right across the ground", () => {
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const moved = run(start, [floor], { right: true }, 0.8);

    expect(moved.x).toBeGreaterThan(start.x + 120);
    expect(moved.onGround).toBe(true);
    expect(moved.facing).toBe(1);
    expect(moved.anim).toBe("run");
  });

  it("jumps off the ground and comes back down", () => {
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const rising = run(start, [floor], { jump: true }, 0.15);
    const settled = run(start, [floor], { jump: true }, 1.2);

    expect(rising.y).toBeLessThan(start.y - 20);
    expect(rising.onGround).toBe(false);
    expect(rising.anim).toBe("jump");
    expect(settled.onGround).toBe(true);
    expect(settled.y + settled.h).toBeCloseTo(floor.y, 1);
  });

  it("routes ArrowUp into standing and running jump arcs", () => {
    const event = { key: "ArrowUp", code: "ArrowUp" };
    expect(isGameControl(event)).toBe(true);

    const token = controlToken(event);
    expect(isJumpToken(token)).toBe(true);
    const tokens = new Set([token]);
    const queued = queueJump(false, false, tokens.has("arrowup"));
    const jumpInput = inputFromTokens(tokens, queued);
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const standingLaunch = stepBody(start, [floor], jumpInput, 1 / 120);

    expect(standingLaunch.onGround).toBe(false);
    expect(standingLaunch.vy).toBeLessThan(-600);
    expect(standingLaunch.y).toBeLessThan(start.y - 5);

    const running = run(start, [floor], { right: true }, 0.45);
    const runningInput = inputFromTokens(
      new Set(["arrowright", token]),
      queued,
    );
    const runningLaunch = stepBody(running, [floor], runningInput, 1 / 120);
    const runningApex = run(runningLaunch, [floor], { right: true }, 0.25);
    const runningLanded = run(runningLaunch, [floor], { right: true }, 1.05);

    expect(runningLaunch.vy).toBeLessThan(-600);
    expect(runningLaunch.vx).toBeGreaterThan(250);
    expect(runningApex.y).toBeLessThan(running.y - 60);
    expect(runningApex.x).toBeGreaterThan(running.x + 50);
    expect(runningLanded.onGround).toBe(true);
    expect(runningLanded.x).toBeGreaterThan(running.x + 200);
  });

  it("climbs a vertical side and stands on top", () => {
    const wall: Solid = { x: 160, y: 40, w: 700, h: 200 };
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const climbed = run(start, [floor, wall], { right: true }, 2.2);

    expect(climbed.onGround).toBe(true);
    expect(climbed.y + climbed.h).toBeCloseTo(wall.y, 1);
    expect(climbed.x + climbed.w).toBeGreaterThan(wall.x);
    expect(climbed.x).toBeLessThan(wall.x + wall.w);
  });

  it("wall-slides slower than a free fall", () => {
    const wall: Solid = { x: 100, y: 0, w: 30, h: 500 };
    const start = createBody(100 - CHAR_WIDTH + 2, 80);
    const sliding = run(start, [wall], {}, 0.45);
    const falling = run(start, [], {}, 0.45);

    expect(sliding.y).toBeGreaterThan(start.y + 10);
    expect(sliding.y).toBeLessThan(falling.y - 40);
    expect(sliding.anim).toBe("climb");
  });

  it("centers the camera on the character", () => {
    const body = createBody(100, 50);
    const scroll = cameraScrollFor(body, {
      width: 800,
      height: 600,
      zoom: 1,
    });

    expect(scroll.scrollX).toBeCloseTo(400 - (100 + CHAR_WIDTH / 2));
    expect(scroll.scrollY).toBeCloseTo(300 - (50 + CHAR_HEIGHT / 2));
  });

  it("launches an idle jump with no horizontal speed and lands on the same floor", () => {
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const rising = run(start, [floor], { jump: true }, 0.2);
    const apex = run(start, [floor], { jump: true }, 0.28);
    const landed = run(start, [floor], { jump: true }, 1.2);

    expect(start.onGround).toBe(true);
    expect(rising.onGround).toBe(false);
    expect(rising.anim).toBe("jump");
    expect(rising.y).toBeLessThan(start.y - 40);
    expect(Math.abs(rising.vx)).toBeLessThan(20);
    expect(apex.y).toBeLessThan(rising.y);
    expect(landed.onGround).toBe(true);
    expect(landed.anim).toBe("idle");
    expect(landed.x).toBeCloseTo(start.x, 0);
    expect(landed.y + landed.h).toBeCloseTo(floor.y, 1);
  });

  it("keeps run speed through a running jump", () => {
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const running = run(start, [floor], { right: true }, 0.5);
    const launch = stepBody(
      running,
      [floor],
      { left: false, right: true, jumpPressed: true },
      1 / 120,
    );
    const airborne = run(launch, [floor], { right: true }, 0.22);
    const landed = run(launch, [floor], { right: true }, 1.05);

    expect(running.onGround).toBe(true);
    expect(running.anim).toBe("run");
    expect(launch.onGround).toBe(false);
    expect(launch.vy).toBeLessThan(-600);
    expect(launch.vx).toBeGreaterThan(250);
    expect(airborne.x).toBeGreaterThan(running.x + 40);
    expect(airborne.y).toBeLessThan(running.y - 50);
    expect(landed.onGround).toBe(true);
    expect(landed.x).toBeGreaterThan(running.x + 180);
  });

  it("climbs while holding into a wall", () => {
    const wall: Solid = { x: 120, y: 0, w: 28, h: 420 };
    const start = createBody(120 - CHAR_WIDTH + 2, 280);
    const climbing = run(start, [wall], { right: true }, 0.45);

    expect(climbing.climbing).toBe(true);
    expect(climbing.anim).toBe("climb");
    expect(climbing.onGround).toBe(false);
    expect(climbing.y).toBeLessThan(start.y - 50);
    expect(climbing.facing).toBe(1);
  });

  it("wall-jumps away from a climb", () => {
    const wall: Solid = { x: 120, y: 0, w: 28, h: 420 };
    const start = createBody(120 - CHAR_WIDTH + 2, 220);
    const climbing = run(start, [wall], { right: true }, 0.25);
    const launch = stepBody(
      climbing,
      [wall],
      { left: false, right: true, jumpPressed: true },
      1 / 120,
    );

    expect(climbing.climbing).toBe(true);
    expect(launch.vy).toBeLessThan(-600);
    expect(launch.vx).toBeLessThan(0);
    expect(launch.x).toBeLessThan(climbing.x);
    expect(launch.anim).toBe("jump");
  });

  it("does not double-jump while airborne", () => {
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const rising = run(start, [floor], { jump: true }, 0.12);
    const again = stepBody(
      rising,
      [floor],
      { left: false, right: false, jumpPressed: true },
      1 / 120,
    );

    expect(rising.onGround).toBe(false);
    expect(again.vy).toBeGreaterThan(rising.vy);
    expect(again.vy).toBeGreaterThan(-680);
  });

  it("consumes a held ArrowUp once through the render-frame queue", () => {
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const tokens = new Set(["arrowup"]);
    let pending = false;
    let wasHeld = false;
    let body = start;
    let launches = 0;

    for (let i = 0; i < 90; i++) {
      const held = tokens.has("arrowup");
      pending = queueJump(pending, wasHeld, held);
      wasHeld = held;
      const next = stepBody(
        body,
        [floor],
        inputFromTokens(tokens, pending),
        DT,
      );
      if (pending) {
        pending = false;
      }
      if (body.onGround && !next.onGround) {
        launches += 1;
      }
      body = next;
    }

    expect(launches).toBe(1);
    expect(body.onGround).toBe(true);
  });

  it("keeps a queued ArrowUp across a render that has no physics step", () => {
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const tokens = new Set(["arrowup"]);
    const queued = queueJump(false, false, tokens.has("arrowup"));
    const stillQueued = queueJump(queued, true, tokens.has("arrowup"));
    const launch = stepBody(
      start,
      [floor],
      inputFromTokens(tokens, stillQueued),
      1 / 120,
    );

    expect(queued).toBe(true);
    expect(stillQueued).toBe(true);
    expect(launch.onGround).toBe(false);
    expect(launch.vy).toBeLessThan(-600);
  });

  it("steps onto a low platform and walks off a short ledge", () => {
    const step: Solid = { x: 70, y: 188, w: 90, h: 12 };
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const onStep = run(start, [floor, step], { right: true }, 0.55);

    expect(onStep.onGround).toBe(true);
    expect(onStep.y + onStep.h).toBeCloseTo(step.y, 1);

    const ledge: Solid = { x: 0, y: 200, w: 70, h: 24 };
    const onLedge = spawnBody([ledge], { x: 0, y: 0, w: 800, h: 600 });
    const fallen = run(onLedge, [ledge], { right: true }, 1.2);

    expect(fallen.onGround).toBe(false);
    expect(fallen.y).toBeGreaterThan(onLedge.y + 40);
    expect(fallen.anim).toBe("jump");
  });

  it("hits a ceiling instead of passing through it", () => {
    const lowFloor: Solid = { x: 0, y: 320, w: 600, h: 40 };
    const ceiling: Solid = { x: 0, y: 200, w: 600, h: 16 };
    const start = spawnBody([lowFloor], { x: 0, y: 0, w: 800, h: 600 });
    const jumped = run(start, [lowFloor, ceiling], { jump: true }, 0.22);

    expect(jumped.y).toBeGreaterThanOrEqual(ceiling.y + ceiling.h - 0.5);
    expect(jumped.vy).toBeGreaterThanOrEqual(0);
  });

  it("applies a large dt jump only on the first physics slice", () => {
    const start = spawnBody([floor], { x: 0, y: 0, w: 800, h: 600 });
    const stepped = stepBody(
      start,
      [floor],
      { left: false, right: false, jumpPressed: true },
      2 / 90,
    );

    expect(stepped.onGround).toBe(false);
    expect(stepped.vy).toBeGreaterThan(-680);
    expect(stepped.vy).toBeLessThan(-600);
  });

  it("spawns on the leftmost standable solid and mid-viewport with none", () => {
    const right: Solid = { x: 240, y: 80, w: 80, h: 16 };
    const left: Solid = { x: 40, y: 160, w: 80, h: 16 };
    const onLeft = spawnBody([right, left], { x: 0, y: 0, w: 800, h: 600 });
    expect(onLeft.x).toBeCloseTo(left.x + 8, 1);
    expect(onLeft.y + onLeft.h).toBeCloseTo(left.y - 0.5, 1);
    expect(onLeft.onGround).toBe(true);

    const empty = spawnBody([], { x: 0, y: 0, w: 800, h: 600 });
    expect(empty.x).toBeCloseTo(400 - CHAR_WIDTH / 2);
    expect(empty.y).toBeCloseTo(300 - CHAR_HEIGHT / 2);
    expect(empty.onGround).toBe(false);
  });
});

describe("fancy pants solids", () => {
  const base = {
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    angle: 0,
    strokeWidth: 2,
  };

  it("turns rectangles, ellipses, diamonds, lines, arrows, and freedraw into solids", () => {
    const rectangle = shapesToSolids([{ ...base, type: "rectangle" }]);
    expect(rectangle).toEqual([{ x: 10, y: 20, w: 100, h: 80 }]);

    const ellipse = shapesToSolids([{ ...base, type: "ellipse" }]);
    expect(ellipse.length).toBeGreaterThan(1);
    expect(ellipse[0].w).toBeLessThan(ellipse[3].w);

    const diamond = shapesToSolids([{ ...base, type: "diamond" }]);
    expect(diamond.length).toBeGreaterThan(1);
    expect(diamond[0].w).toBeLessThan(diamond[3].w);

    const line = shapesToSolids([
      {
        ...base,
        type: "line",
        width: 160,
        height: 0,
        points: [
          [0, 0],
          [160, 0],
        ],
      },
    ]);
    expect(line).toHaveLength(1);
    expect(line[0].w).toBeGreaterThan(100);
    expect(line[0].h).toBeGreaterThan(10);

    const arrow = shapesToSolids([
      {
        ...base,
        type: "arrow",
        width: 0,
        height: 140,
        points: [
          [0, 0],
          [0, 140],
        ],
      },
    ]);
    expect(arrow).toHaveLength(1);
    expect(arrow[0].h).toBeGreaterThan(100);

    const freedraw = shapesToSolids([
      {
        ...base,
        type: "freedraw",
        width: 90,
        height: 4,
        points: [
          [0, 0],
          [30, 2],
          [60, -1],
          [90, 1],
        ],
      },
    ]);
    expect(freedraw.length).toBeGreaterThan(0);
    const span = freedraw.reduce(
      (max, solid) => Math.max(max, solid.x + solid.w),
      0,
    );
    expect(span).toBeGreaterThan(base.x + 70);
  });

  it("ignores deleted elements and the selection box", () => {
    const elements: FancyPantsElement[] = [
      { ...base, type: "rectangle", isDeleted: true },
      { ...base, type: "selection" },
    ];
    expect(shapesToSolids(elements)).toEqual([]);
  });

  it("does not mutate the source element", () => {
    const element: FancyPantsElement = {
      ...base,
      type: "line",
      points: [
        [0, 0],
        [40, 0],
      ],
    };
    shapesToSolids([element]);
    expect(element.x).toBe(10);
    expect(element.points).toEqual([
      [0, 0],
      [40, 0],
    ]);
  });

  it("keeps frame interiors open and expands rotated rectangles", () => {
    const frame = shapesToSolids([
      { ...base, type: "frame", x: 0, y: 0, width: 400, height: 300 },
    ]);
    expect(frame).toHaveLength(4);
    const interior: Solid = { x: 80, y: 80, w: 40, h: 40 };
    const hitsInterior = frame.some(
      (solid) =>
        interior.x < solid.x + solid.w &&
        interior.x + interior.w > solid.x &&
        interior.y < solid.y + solid.h &&
        interior.y + interior.h > solid.y,
    );
    expect(hitsInterior).toBe(false);

    const inside = createBody(180, 120);
    const falling = run(inside, frame, {}, 0.35);
    expect(falling.y).toBeGreaterThan(inside.y + 20);

    const rotated = shapesToSolids([
      {
        ...base,
        type: "rectangle",
        width: 100,
        height: 40,
        angle: Math.PI / 4,
      },
    ]);
    expect(rotated).toHaveLength(1);
    expect(rotated[0].w).toBeGreaterThan(100);
    expect(rotated[0].h).toBeGreaterThan(40);

    expect(
      shapesToSolids([{ ...base, type: "rectangle", width: 0, height: 0 }]),
    ).toEqual([]);
  });
});
