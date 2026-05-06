import React from "react";
import { arrayToMap, reseed } from "@excalidraw/common";

import {
  getVisibleSceneBounds,
  newElement,
  newElementWith,
} from "@excalidraw/element";

import "@excalidraw/utils/test-utils";

import { render as rtlRender } from "@testing-library/react";

import type { Radians } from "@excalidraw/math";

import type { NonDeletedSceneElementsMap } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import Minimap from "../components/Minimap";
import {
  computeElementMinimapRects,
  computeMinimapWorldBounds,
  paddedWorldBounds,
  unionBounds,
} from "../components/MinimapGeometry";
import { Excalidraw } from "../index";

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

const { h } = window;

/** Element package maps omit scene branding types; casts are confined to tests. */
const sceneMapFrom = (
  elements: Parameters<typeof arrayToMap>[0],
): NonDeletedSceneElementsMap =>
  arrayToMap(elements) as unknown as NonDeletedSceneElementsMap;

const minimapAppState = (
  overrides: Partial<
    Pick<
      AppState,
      "scrollX" | "scrollY" | "width" | "height" | "zoom" | "selectedElementIds"
    >
  > = {},
): Pick<
  AppState,
  "scrollX" | "scrollY" | "width" | "height" | "zoom" | "selectedElementIds"
> => {
  const base = getDefaultAppState();
  return {
    scrollX: overrides.scrollX ?? base.scrollX,
    scrollY: overrides.scrollY ?? base.scrollY,
    width: overrides.width ?? 600,
    height: overrides.height ?? 400,
    zoom: overrides.zoom ?? base.zoom,
    selectedElementIds: overrides.selectedElementIds ?? {},
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

    rtlRender(
      <div className="excalidraw">
        <Minimap
          elements={[rect]}
          elementsMap={sceneMapFrom([rect])}
          appState={minimapAppState({ width: 0, height: 100 })}
        />
      </div>,
    );

    expect(screen.queryByTestId("excalidraw-minimap")).toBeNull();
  });

  it("exposes accessibility label and a single viewport indicator", () => {
    const rect = newElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });

    rtlRender(
      <div className="excalidraw">
        <Minimap
          elements={[rect]}
          elementsMap={sceneMapFrom([rect])}
          appState={minimapAppState({
            width: 640,
            height: 480,
            selectedElementIds: { [rect.id]: true },
          })}
        />
      </div>,
    );

    expect(screen.getByRole("img", { name: "Scene minimap" })).toBeTruthy();

    expect(screen.queryAllByTestId("minimap-viewport-indicator")).toHaveLength(
      1,
    );

    const selected = document.querySelectorAll(".minimap__element--selected");
    expect(selected.length).toBe(1);
  });

  it("has no passive click targets inside the minimap", () => {
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });

    rtlRender(
      <div className="excalidraw">
        <Minimap
          elements={[rect]}
          elementsMap={sceneMapFrom([rect])}
          appState={minimapAppState({ width: 400, height: 300 })}
        />
      </div>,
    );

    const root = screen.getByTestId("excalidraw-minimap");
    expect(
      root.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      ),
    ).toHaveLength(0);
  });
});

describe("minimap integration", () => {
  beforeEach(() => {
    if (typeof localStorage?.clear === "function") {
      localStorage.clear();
    }
    reseed(7);
  });

  it("renders minimap and updates viewport when scroll changes", async () => {
    mockBoundingClientRect();

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    await waitFor(() => {
      expect(screen.queryByTestId("excalidraw-minimap")).not.toBeNull();
    });

    const indicator = (): SVGRectElement =>
      document.querySelector(
        `[data-testid="minimap-viewport-indicator"]`,
      ) as SVGRectElement;

    await waitFor(() => {
      expect(h.state.width).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(indicator()?.getAttribute("x")).not.toBeNull();
    });

    const beforePan = indicator().getAttribute("x");

    actScrollChange();

    await waitFor(() => {
      expect(indicator().getAttribute("x")).not.toBe(beforePan);
    });

    restoreOriginalGetBoundingClientRect();
  });

  it("keeps minimap visible in view mode", async () => {
    mockBoundingClientRect();
    await render(<Excalidraw />);
    await waitFor(() => {
      expect(screen.queryByTestId("excalidraw-minimap")).not.toBeNull();
    });

    API.setAppState({ viewModeEnabled: true });

    await waitFor(() => {
      expect(screen.queryByTestId("excalidraw-minimap")).not.toBeNull();
    });

    restoreOriginalGetBoundingClientRect();
  });
});

function actScrollChange() {
  API.setAppState({
    scrollX: h.state.scrollX - 400,
  });
}
