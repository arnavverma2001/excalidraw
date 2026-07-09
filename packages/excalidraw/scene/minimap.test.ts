import { describe, expect, it } from "vitest";

import { getDefaultAppState } from "../appState";
import { API } from "../tests/helpers/api";
import {
  getMinimapData,
  getMinimapViewportRect,
  hasElementsOutsideViewport,
  minimapToSceneCoords,
  sceneToMinimapCoords,
} from "./minimap";

import type { NormalizedZoomValue } from "../types";

describe("minimap", () => {
  it("returns null when there are no visible elements", () => {
    const appState = {
      ...getDefaultAppState(),
      width: 800,
      height: 600,
    };
    expect(getMinimapData([], appState)).toBeNull();
    expect(hasElementsOutsideViewport([], appState)).toBe(false);
  });

  it("detects elements outside the viewport", () => {
    const appState = {
      ...getDefaultAppState(),
      width: 800,
      height: 600,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 as NormalizedZoomValue },
    };
    const elements = [
      API.createElement({
        type: "rectangle",
        x: 1000,
        y: 1000,
        width: 100,
        height: 100,
      }),
    ];

    expect(hasElementsOutsideViewport(elements, appState)).toBe(true);
  });

  it("returns false when all elements are inside the viewport", () => {
    const appState = {
      ...getDefaultAppState(),
      width: 800,
      height: 600,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 as NormalizedZoomValue },
    };
    const elements = [
      API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      }),
    ];

    expect(hasElementsOutsideViewport(elements, appState)).toBe(false);
  });

  it("calculates viewport rectangle inside minimap bounds", () => {
    const appState = {
      ...getDefaultAppState(),
      width: 400,
      height: 300,
      scrollX: -100,
      scrollY: -50,
      zoom: { value: 1 as NormalizedZoomValue },
    };
    const elements = [
      API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      }),
    ];
    const data = getMinimapData(elements, appState);

    expect(data).not.toBeNull();
    const viewportRect = getMinimapViewportRect(appState, data!);

    expect(viewportRect.width).toBeGreaterThan(0);
    expect(viewportRect.height).toBeGreaterThan(0);
    expect(viewportRect.x).toBeGreaterThanOrEqual(0);
    expect(viewportRect.y).toBeGreaterThanOrEqual(0);
    expect(viewportRect.x + viewportRect.width).toBeLessThanOrEqual(data!.width);
    expect(viewportRect.y + viewportRect.height).toBeLessThanOrEqual(
      data!.height,
    );
  });

  it("converts between scene and minimap coordinates", () => {
    const appState = {
      ...getDefaultAppState(),
      width: 800,
      height: 600,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 as NormalizedZoomValue },
    };
    const elements = [
      API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      }),
    ];
    const data = getMinimapData(elements, appState)!;

    const minimapPoint = sceneToMinimapCoords(200, 150, data);
    const scenePoint = minimapToSceneCoords(minimapPoint.x, minimapPoint.y, data);

    expect(scenePoint.x).toBeCloseTo(200, 1);
    expect(scenePoint.y).toBeCloseTo(150, 1);
  });

  it("updates viewport rectangle when zoom changes", () => {
    const elements = [
      API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
      }),
    ];
    const baseState = {
      ...getDefaultAppState(),
      width: 800,
      height: 600,
      scrollX: 0,
      scrollY: 0,
    };

    const zoomedOut = {
      ...baseState,
      zoom: { value: 0.5 as NormalizedZoomValue },
    };
    const zoomedIn = {
      ...baseState,
      zoom: { value: 2 as NormalizedZoomValue },
    };

    const data = getMinimapData(elements, zoomedOut)!;
    const viewportZoomedOut = getMinimapViewportRect(zoomedOut, data);
    const viewportZoomedIn = getMinimapViewportRect(zoomedIn, data);

    expect(viewportZoomedIn.width).toBeLessThan(viewportZoomedOut.width);
    expect(viewportZoomedIn.height).toBeLessThan(viewportZoomedOut.height);
  });
});
