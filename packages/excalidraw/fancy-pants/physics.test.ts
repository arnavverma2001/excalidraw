import {
  CHAR_HEIGHT,
  CHAR_WIDTH,
  cameraScrollFor,
  createBody,
  shapesToSolids,
  spawnBody,
  stepBody,
} from "./physics";

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
});
