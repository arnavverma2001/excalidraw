import React from "react";
import { act } from "@testing-library/react";
import { vi } from "vitest";

import { Excalidraw } from "../..";
import { actionToggleMinimap } from "../../actions";
import { clearAppStateForLocalStorage } from "../../appState";
import { API } from "../../tests/helpers/api";
import { Pointer, UI } from "../../tests/helpers/ui";
import {
  fireEvent,
  queryByTestId,
  render,
  waitFor,
  withExcalidrawDimensions,
} from "../../tests/test-utils";

import {
  getMinimapSceneBounds,
  getMinimapTransform,
  getViewportRectInMinimap,
  hasContentOutsideViewport,
  minimapToScene,
  sceneToMinimap,
} from "./utils";

const { h } = window;
const mouse = new Pointer("mouse");

describe("minimap utils", () => {
  it("computes scene bounds as union of elements and viewport with padding", () => {
    const scene = getMinimapSceneBounds([0, 0, 100, 100], [-50, -50, 50, 50]);
    expect(scene.minX).toBeLessThan(0);
    expect(scene.minY).toBeLessThan(0);
    expect(scene.maxX).toBeGreaterThan(100);
    expect(scene.maxY).toBeGreaterThan(100);
  });

  it("maps scene ↔ minimap coordinates round-trip", () => {
    const scene = getMinimapSceneBounds([0, 0, 200, 100], [0, 0, 100, 50]);
    const transform = getMinimapTransform(scene);
    const mini = sceneToMinimap(100, 50, scene, transform);
    const back = minimapToScene(mini.x, mini.y, scene, transform);
    expect(back.x).toBeCloseTo(100, 5);
    expect(back.y).toBeCloseTo(50, 5);
  });

  it("computes viewport rectangle inside the minimap", () => {
    const viewport: [number, number, number, number] = [0, 0, 100, 50];
    const scene = getMinimapSceneBounds([0, 0, 400, 200], viewport);
    const transform = getMinimapTransform(scene);
    const rect = getViewportRectInMinimap(viewport, scene, transform);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
  });

  it("detects content outside the viewport", () => {
    expect(hasContentOutsideViewport([0, 0, 100, 100], [0, 0, 200, 200])).toBe(
      false,
    );
    expect(
      hasContentOutsideViewport([-10, 0, 100, 100], [0, 0, 200, 200]),
    ).toBe(true);
    expect(hasContentOutsideViewport(null, [0, 0, 200, 200])).toBe(false);
  });
});

describe("minimap UI", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally />);
    API.setElements([]);
  });

  it("shows minimap by default and tracks viewport after drawing", async () => {
    await withExcalidrawDimensions({ width: 800, height: 600 }, async () => {
      expect(h.state.showMinimap).toBe(true);

      UI.clickTool("rectangle");
      mouse.down(50, 50);
      mouse.up(250, 150);

      // Pan so content is outside the viewport
      API.setAppState({ scrollX: -500, scrollY: -400 });

      await waitFor(() => {
        expect(queryByTestId(document.body, "minimap")).not.toBeNull();
        expect(queryByTestId(document.body, "minimap-canvas")).not.toBeNull();
      });
    });
  });

  it("hides minimap via close and persists preference", async () => {
    await withExcalidrawDimensions({ width: 800, height: 600 }, async () => {
      UI.clickTool("rectangle");
      mouse.down(20, 20);
      mouse.up(120, 80);

      await waitFor(() => {
        expect(queryByTestId(document.body, "minimap")).not.toBeNull();
      });

      fireEvent.click(queryByTestId(document.body, "minimap-close")!);
      expect(h.state.showMinimap).toBe(false);

      await waitFor(() => {
        expect(queryByTestId(document.body, "minimap")).toBeNull();
        expect(queryByTestId(document.body, "minimap-show")).not.toBeNull();
      });

      const persisted = clearAppStateForLocalStorage(h.state);
      expect(persisted.showMinimap).toBe(false);
    });
  });

  it("toggles showMinimap via the registered action", async () => {
    expect(h.state.showMinimap).toBe(true);

    act(() => {
      h.app.actionManager.executeAction(actionToggleMinimap);
    });
    expect(h.state.showMinimap).toBe(false);

    act(() => {
      h.app.actionManager.executeAction(actionToggleMinimap);
    });
    expect(h.state.showMinimap).toBe(true);
  });

  it("clicking the minimap pans the canvas", async () => {
    await withExcalidrawDimensions({ width: 800, height: 600 }, async () => {
      UI.clickTool("rectangle");
      mouse.down(0, 0);
      mouse.up(100, 100);

      // Place a second shape far away so scene is large
      API.setElements([
        ...h.elements,
        API.createElement({
          type: "rectangle",
          x: 800,
          y: 600,
          width: 100,
          height: 100,
        }),
      ]);

      const scrollBefore = { x: h.state.scrollX, y: h.state.scrollY };

      await waitFor(() => {
        expect(queryByTestId(document.body, "minimap-canvas")).not.toBeNull();
      });

      const canvas = queryByTestId(
        document.body,
        "minimap-canvas",
      ) as HTMLCanvasElement;

      // Mock geometry so click coordinates map into the canvas
      const rect = {
        left: 100,
        top: 100,
        width: 160,
        height: 120,
        right: 260,
        bottom: 220,
        x: 100,
        y: 100,
        toJSON() {
          return this;
        },
      } as DOMRect;
      vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect);

      fireEvent.pointerDown(canvas, { clientX: 240, clientY: 200 });
      fireEvent.pointerUp(canvas, { clientX: 240, clientY: 200 });

      await waitFor(() => {
        expect(h.state.scrollX).not.toBe(scrollBefore.x);
        expect(h.state.scrollY).not.toBe(scrollBefore.y);
      });
    });
  });

  it("does not show minimap in zen mode", async () => {
    await withExcalidrawDimensions({ width: 800, height: 600 }, async () => {
      UI.clickTool("rectangle");
      mouse.down(10, 10);
      mouse.up(60, 40);

      API.setAppState({ zenModeEnabled: true });

      await waitFor(() => {
        expect(queryByTestId(document.body, "minimap")).toBeNull();
        expect(queryByTestId(document.body, "minimap-show")).toBeNull();
      });
    });
  });
});
