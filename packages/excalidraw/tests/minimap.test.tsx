import React from "react";

import { arrayToMap } from "@excalidraw/common";

import {
  getVisibleSceneBounds,
  newElement,
  newElementWith,
} from "@excalidraw/element";

import "@excalidraw/utils/test-utils";

import { fireEvent, render as rtlRender } from "@testing-library/react";

import type { Radians } from "@excalidraw/math";

import type { NonDeletedSceneElementsMap } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import Minimap from "../components/Minimap";
import {
  computeElementMinimapRects,
  computeMinimapWorldBounds,
  isSceneLargerThanViewport,
  paddedWorldBounds,
  scenePointFromMinimapClient,
  unionBounds,
} from "../components/MinimapGeometry";
import { Excalidraw } from "../index";
import { centerScrollOn } from "../scene/scroll";

import { API } from "./helpers/api";
import {
  cleanup,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  screen,
  waitFor,
} from "./test-utils";

import type { AppState } from "../types";

const sceneMapFrom = (
  elements: Parameters<typeof arrayToMap>[0],
): NonDeletedSceneElementsMap =>
  arrayToMap(elements) as unknown as NonDeletedSceneElementsMap;

const minimapAppState = (
  overrides: Partial<
    Pick<
      AppState,
      | "scrollX"
      | "scrollY"
      | "width"
      | "height"
      | "zoom"
      | "minimapEnabled"
      | "viewModeEnabled"
      | "zenModeEnabled"
    >
  > = {},
): Pick<
  AppState,
  | "scrollX"
  | "scrollY"
  | "width"
  | "height"
  | "zoom"
  | "minimapEnabled"
  | "viewModeEnabled"
  | "zenModeEnabled"
> => {
  const base = getDefaultAppState();
  return {
    scrollX: overrides.scrollX ?? base.scrollX,
    scrollY: overrides.scrollY ?? base.scrollY,
    width: overrides.width ?? 600,
    height: overrides.height ?? 400,
    zoom: overrides.zoom ?? base.zoom,
    minimapEnabled: overrides.minimapEnabled ?? true,
    viewModeEnabled: overrides.viewModeEnabled ?? false,
    zenModeEnabled: overrides.zenModeEnabled ?? false,
  };
};

describe("minimap geometry", () => {
  it("computeMinimapWorldBounds uses viewport when there are no elements", () => {
    const map = sceneMapFrom([]);

    const app = minimapAppState({
      width: 800,
      height: 600,
      scrollX: -100,
      scrollY: -50,
      zoom: { value: 1 as AppState["zoom"]["value"] },
    });

    expect(computeMinimapWorldBounds([], map, app)).toEqual(
      getVisibleSceneBounds(app as unknown as AppState),
    );
  });

  it("computeMinimapWorldBounds unions viewport and scene", () => {
    const rect = newElement({
      type: "rectangle",
      x: 500,
      y: 500,
      width: 100,
      height: 40,
    });
    const elements = [rect];

    const app = minimapAppState({
      width: 400,
      height: 300,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 as AppState["zoom"]["value"] },
    });

    const viewport = getVisibleSceneBounds(app as unknown as AppState);
    const expected = unionBounds(
      viewport as [number, number, number, number],
      [500, 500, 600, 540],
    );

    expect(
      computeMinimapWorldBounds(elements, sceneMapFrom(elements), app),
    ).toEqual(expected);
  });

  it("paddedWorldBounds never produces NaN for extreme aspect ratios", () => {
    const b = [0, 0, 1, 1_000_000] as const;
    const p = paddedWorldBounds(b, 0.04);
    expect(p.every(Number.isFinite)).toBe(true);
    expect(p[2] - p[0]).toBeGreaterThan(0);
    expect(p[3] - p[1]).toBeGreaterThan(0);
  });

  it("computeElementMinimapRects uses element bounds (rotation)", () => {
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const rotated = newElementWith(rect, {
      angle: (Math.PI / 4) as Radians,
    });
    const map = sceneMapFrom([rotated]);
    const rects = computeElementMinimapRects([rotated], map);
    expect(rects).toHaveLength(1);
    const [x1, y1, x2, y2] = rects[0].bounds;
    expect(x2 - x1).toBeGreaterThan(10);
    expect(y2 - y1).toBeGreaterThan(10);
  });

  it("isSceneLargerThanViewport is false when scene fits in viewport", () => {
    const rect = newElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });
    const elements = [rect];
    const app = minimapAppState({
      width: 800,
      height: 600,
      scrollX: 0,
      scrollY: 0,
    });

    expect(
      isSceneLargerThanViewport(elements, sceneMapFrom(elements), app),
    ).toBe(false);
  });

  it("isSceneLargerThanViewport is true when scene extends outside viewport", () => {
    const rect = newElement({
      type: "rectangle",
      x: 900,
      y: 900,
      width: 100,
      height: 100,
    });
    const elements = [rect];
    const app = minimapAppState({
      width: 400,
      height: 300,
      scrollX: 0,
      scrollY: 0,
    });

    expect(
      isSceneLargerThanViewport(elements, sceneMapFrom(elements), app),
    ).toBe(true);
  });
});

describe("<Minimap />", () => {
  afterEach(() => {
    cleanup();
  });

  it("returns null when canvas dimensions are unusable", () => {
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const elements = [rect];
    const { container } = rtlRender(
      <Minimap
        elements={elements}
        elementsMap={sceneMapFrom(elements)}
        appState={minimapAppState({ width: 0, height: 0 })}
        setAppState={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when scene fits entirely in the viewport", () => {
    const rect = newElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    });
    const elements = [rect];
    const { container } = rtlRender(
      <Minimap
        elements={elements}
        elementsMap={sceneMapFrom(elements)}
        appState={minimapAppState()}
        setAppState={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders viewport indicator when scene extends outside viewport", () => {
    const rect = newElement({
      type: "rectangle",
      x: 800,
      y: 800,
      width: 100,
      height: 100,
    });
    const elements = [rect];
    rtlRender(
      <Minimap
        elements={elements}
        elementsMap={sceneMapFrom(elements)}
        appState={minimapAppState({ width: 400, height: 300 })}
        setAppState={() => {}}
      />,
    );
    expect(screen.getByTestId("minimap-viewport-indicator")).toBeTruthy();
  });

  it("hides minimap panel when minimapEnabled is false but keeps toggle", () => {
    const rect = newElement({
      type: "rectangle",
      x: 800,
      y: 800,
      width: 100,
      height: 100,
    });
    const elements = [rect];
    rtlRender(
      <Minimap
        elements={elements}
        elementsMap={sceneMapFrom(elements)}
        appState={minimapAppState({
          width: 400,
          height: 300,
          minimapEnabled: false,
        })}
        setAppState={() => {}}
      />,
    );
    expect(screen.queryByTestId("excalidraw-minimap")).toBeNull();
    expect(screen.getByTestId("minimap-toggle")).toBeTruthy();
  });

  it("centerScrollOn recenters viewport on a scene point", () => {
    const app = minimapAppState({ width: 400, height: 300 });
    const { scrollX, scrollY } = centerScrollOn({
      scenePoint: { x: 200, y: 150 },
      viewportDimensions: { width: app.width, height: app.height },
      zoom: app.zoom,
    });
    expect(scrollX).toBe(0);
    expect(scrollY).toBe(0);
  });
});

describe("minimap integration", () => {
  beforeEach(() => {
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
    cleanup();
  });

  it("clicking hide toggle collapses the minimap panel", async () => {
    const { container } = await render(<Excalidraw />);
    const rect = newElement({
      type: "rectangle",
      x: 2000,
      y: 2000,
      width: 100,
      height: 100,
    });
    API.setElements([rect]);
    API.setAppState({ scrollX: 0, scrollY: 0 });

    await waitFor(() => {
      expect(screen.queryByTestId("excalidraw-minimap")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("minimap-toggle"));

    await waitFor(() => {
      expect(screen.queryByTestId("excalidraw-minimap")).toBeNull();
      expect(h.app.state.minimapEnabled).toBe(false);
    });

    container.remove();
  });
});

describe("scenePointFromMinimapClient", () => {
  it("returns null when SVG has no screen CTM", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    expect(scenePointFromMinimapClient(0, 0, svg)).toBeNull();
  });
});
