import { describe, expect, it } from "vitest";

import type { NormalizedZoomValue } from "../../types";

import {
  EMPTY_SCENE_HALF_SIZE,
  MINIMAP_HEIGHT,
  MINIMAP_PADDING,
  MINIMAP_WIDTH,
  computeMinimapTransform,
  getMainViewportBounds,
  getMinimapSceneBounds,
  getViewportRectInMinimap,
  minimapToSceneCoords,
  sceneToMinimapCoords,
} from "./minimapUtils";

import type { SceneBounds } from "./minimapUtils";

describe("minimapUtils", () => {
  it("returns default bounds for an empty scene", () => {
    expect(getMinimapSceneBounds([])).toEqual([
      -EMPTY_SCENE_HALF_SIZE - MINIMAP_PADDING,
      -EMPTY_SCENE_HALF_SIZE - MINIMAP_PADDING,
      EMPTY_SCENE_HALF_SIZE + MINIMAP_PADDING,
      EMPTY_SCENE_HALF_SIZE + MINIMAP_PADDING,
    ]);
  });

  it("computes a transform that fits content into the minimap", () => {
    const sceneBounds: SceneBounds = [0, 0, 100, 50];
    const transform = computeMinimapTransform(sceneBounds);

    expect(transform.width).toBe(MINIMAP_WIDTH);
    expect(transform.height).toBe(MINIMAP_HEIGHT);
    expect(transform.zoom.value).toBeCloseTo(
      Math.min(MINIMAP_WIDTH / 100, MINIMAP_HEIGHT / 50),
    );
  });

  it("maps scene coordinates to minimap coordinates and back", () => {
    const transform = computeMinimapTransform([0, 0, 200, 200]);
    const scenePoint = { x: 50, y: 75 };
    const minimapPoint = sceneToMinimapCoords(
      scenePoint.x,
      scenePoint.y,
      transform,
    );
    const roundTrip = minimapToSceneCoords(
      minimapPoint.x,
      minimapPoint.y,
      transform,
    );

    expect(roundTrip.x).toBeCloseTo(scenePoint.x);
    expect(roundTrip.y).toBeCloseTo(scenePoint.y);
  });

  it("maps the main viewport into minimap space", () => {
    const transform = computeMinimapTransform([0, 0, 400, 400]);
    const viewportRect = getViewportRectInMinimap(transform, [50, 50, 150, 150]);

    expect(viewportRect.width).toBeGreaterThan(0);
    expect(viewportRect.height).toBeGreaterThan(0);
    expect(viewportRect.left).toBeGreaterThanOrEqual(0);
    expect(viewportRect.top).toBeGreaterThanOrEqual(0);
    expect(viewportRect.left + viewportRect.width).toBeLessThanOrEqual(
      MINIMAP_WIDTH + 1,
    );
    expect(viewportRect.top + viewportRect.height).toBeLessThanOrEqual(
      MINIMAP_HEIGHT + 1,
    );
  });

  it("derives main viewport bounds from app state", () => {
    expect(
      getMainViewportBounds({
        scrollX: -10,
        scrollY: -20,
        width: 800,
        height: 600,
        zoom: { value: 1 as NormalizedZoomValue },
      }),
    ).toEqual([10, 20, 810, 620]);
  });
});
