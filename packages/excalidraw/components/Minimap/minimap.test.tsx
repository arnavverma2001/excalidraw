import React from "react";
import { fireEvent, queryByTestId } from "@testing-library/react";

import { CaptureUpdateAction } from "@excalidraw/element";
import { getVisibleSceneBounds } from "@excalidraw/element";

import { Excalidraw } from "../..";
import { actionToggleMinimap } from "../../actions";
import { clearAppStateForLocalStorage } from "../../appState";
import { API } from "../../tests/helpers/api";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "../../tests/test-utils";

import {
  getMinimapSceneBounds,
  getMinimapTransform,
  getViewportRectOnMinimap,
  hasElementsOutsideViewport,
  minimapCoordsToScene,
  sceneCoordsToMinimap,
} from "./utils";

const { h } = window;

describe("minimap utils", () => {
  it("unions element and viewport bounds", () => {
    const elementsBounds = [0, 0, 100, 50] as const;
    const viewportBounds = [-20, -10, 200, 150] as const;
    expect(getMinimapSceneBounds(elementsBounds, viewportBounds)).toEqual([
      -20, -10, 200, 150,
    ]);
  });

  it("maps scene coords to minimap and back", () => {
    const transform = getMinimapTransform([0, 0, 1000, 500], 200, 100, 0);
    const minimapPoint = sceneCoordsToMinimap(250, 125, transform);
    const scenePoint = minimapCoordsToScene(
      minimapPoint.x,
      minimapPoint.y,
      transform,
    );
    expect(scenePoint.x).toBeCloseTo(250);
    expect(scenePoint.y).toBeCloseTo(125);
  });

  it("computes viewport rectangle on the minimap", () => {
    const transform = getMinimapTransform([0, 0, 1000, 1000], 100, 100, 0);
    const rect = getViewportRectOnMinimap([100, 100, 300, 300], transform);
    expect(rect.x).toBeCloseTo(10);
    expect(rect.y).toBeCloseTo(10);
    expect(rect.width).toBeCloseTo(20);
    expect(rect.height).toBeCloseTo(20);
  });

  it("detects elements outside the viewport", () => {
    expect(
      hasElementsOutsideViewport([0, 0, 50, 50], [0, 0, 100, 100]),
    ).toBe(false);
    expect(
      hasElementsOutsideViewport([0, 0, 150, 50], [0, 0, 100, 100]),
    ).toBe(true);
  });
});

describe("minimap", () => {
  beforeEach(async () => {
    localStorage.clear();
    // Desktop-sized viewport so the minimap is not auto-hidden for phones.
    mockBoundingClientRect({
      width: 1024,
      height: 768,
      top: 0,
      left: 0,
      x: 0,
      y: 0,
      right: 1024,
      bottom: 768,
    });
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("is hidden on an empty canvas", async () => {
    expect(h.state.showMinimap).toBe(true);
    expect(queryByTestId(document.body, "minimap")).toBeNull();
  });

  it("shows when elements exist outside the viewport", async () => {
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 1000,
        y: 1000,
        width: 200,
        height: 100,
      }),
    ]);

    await waitFor(() => {
      expect(queryByTestId(document.body, "minimap")).not.toBeNull();
    });
  });

  it("hides when preference is toggled off", async () => {
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 1000,
        y: 1000,
        width: 200,
        height: 100,
      }),
    ]);

    await waitFor(() => {
      expect(queryByTestId(document.body, "minimap")).not.toBeNull();
    });

    API.executeAction(actionToggleMinimap);
    expect(h.state.showMinimap).toBe(false);
    expect(queryByTestId(document.body, "minimap")).toBeNull();
  });

  it("persists showMinimap preference for local storage", () => {
    API.setAppState({ showMinimap: false });
    const persisted = clearAppStateForLocalStorage(h.state);
    expect(persisted.showMinimap).toBe(false);

    API.setAppState({ showMinimap: true });
    expect(clearAppStateForLocalStorage(h.state).showMinimap).toBe(true);
  });

  it("tracks viewport rectangle against zoom and pan", async () => {
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
      }),
      API.createElement({
        type: "rectangle",
        x: 2000,
        y: 1500,
        width: 100,
        height: 80,
      }),
    ]);

    await waitFor(() => {
      expect(queryByTestId(document.body, "minimap")).not.toBeNull();
    });

    const before = getVisibleSceneBounds(h.state);
    API.setAppState({
      scrollX: h.state.scrollX - 250,
      scrollY: h.state.scrollY - 180,
      zoom: { value: 1.5 as typeof h.state.zoom.value },
    });
    const after = getVisibleSceneBounds(h.state);

    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[2] - after[0]).toBeCloseTo(h.state.width / 1.5);
    expect(after[3] - after[1]).toBeCloseTo(h.state.height / 1.5);
    expect(queryByTestId(document.body, "minimap")).not.toBeNull();
  });

  it("pans the canvas when clicking the minimap", async () => {
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 40,
        height: 40,
      }),
      API.createElement({
        type: "rectangle",
        x: 1800,
        y: 1200,
        width: 120,
        height: 80,
      }),
    ]);

    await waitFor(() => {
      expect(queryByTestId(document.body, "minimap-canvas")).not.toBeNull();
    });

    const canvas = queryByTestId(
      document.body,
      "minimap-canvas",
    ) as HTMLCanvasElement;
    const previousScrollX = h.state.scrollX;
    const previousScrollY = h.state.scrollY;

    // Point near the far element in the minimap overview.
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 140,
      clientY: 90,
    });

    expect(h.state.scrollX).not.toBe(previousScrollX);
    expect(h.state.scrollY).not.toBe(previousScrollY);
  });

  it("does not create undo history entries when panning via minimap", async () => {
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 1500,
        y: 1500,
        width: 100,
        height: 100,
      }),
    ]);

    await waitFor(() => {
      expect(queryByTestId(document.body, "minimap-canvas")).not.toBeNull();
    });

    const canvas = queryByTestId(
      document.body,
      "minimap-canvas",
    ) as HTMLCanvasElement;

    API.updateScene({
      appState: { name: "baseline" },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    const undoStackSizeBefore = h.history.undoStack.length;

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 100,
      clientY: 70,
    });

    expect(h.history.undoStack.length).toBe(undoStackSizeBefore);
  });

  it("hides in zen mode", async () => {
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 1200,
        y: 800,
        width: 100,
        height: 100,
      }),
    ]);

    await waitFor(() => {
      expect(queryByTestId(document.body, "minimap")).not.toBeNull();
    });

    API.setAppState({ zenModeEnabled: true });
    expect(queryByTestId(document.body, "minimap")).toBeNull();
  });
});
