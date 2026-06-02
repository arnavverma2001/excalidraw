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

import { clearAppStateForLocalStorage, getDefaultAppState } from "../appState";
import Minimap, { type MinimapProps } from "../components/Minimap";
import {
  computeElementMinimapRects,
  computeMinimapWorldBounds,
  isMinimapNeeded,
  minimapClientPointToScenePoint,
  paddedWorldBounds,
  scenePointToCenteredScroll,
  unionBounds,
} from "../components/MinimapGeometry";
import { restoreAppState } from "../data/restore";
import { Excalidraw } from "../index";

import {
  act,
  cleanup,
  fireEvent,
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
      | "scrollX"
      | "scrollY"
      | "width"
      | "height"
      | "zoom"
      | "selectedElementIds"
      | "minimap"
    >
  > = {},
): Pick<
  AppState,
  | "scrollX"
  | "scrollY"
  | "width"
  | "height"
  | "zoom"
  | "selectedElementIds"
  | "minimap"
> => {
  const base = getDefaultAppState();
  return {
    scrollX: overrides.scrollX ?? base.scrollX,
    scrollY: overrides.scrollY ?? base.scrollY,
    width: overrides.width ?? 600,
    height: overrides.height ?? 400,
    zoom: overrides.zoom ?? base.zoom,
    selectedElementIds: overrides.selectedElementIds ?? {},
    minimap: overrides.minimap ?? base.minimap,
  };
};

const noopSetAppState = (() => {}) as MinimapProps["setAppState"];

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

  it("isMinimapNeeded tracks whether content extends outside the viewport", () => {
    const inside = newElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 30,
      height: 30,
    });
    const outside = newElement({
      type: "rectangle",
      x: 900,
      y: 10,
      width: 30,
      height: 30,
    });
    const app = minimapAppState({ width: 400, height: 300 });

    expect(isMinimapNeeded([inside], sceneMapFrom([inside]), app)).toBe(false);
    expect(isMinimapNeeded([outside], sceneMapFrom([outside]), app)).toBe(true);
  });

  it("maps minimap pointer coordinates to scene coordinates", () => {
    expect(
      minimapClientPointToScenePoint(
        { x: 90, y: 60 },
        {
          left: 0,
          top: 0,
          width: 180,
          height: 120,
        },
        [0, 0, 360, 120],
      ),
    ).toEqual({ x: 180, y: 60 });
  });

  it("computes scroll offsets that center a scene point", () => {
    expect(
      scenePointToCenteredScroll(
        { x: 1000, y: 800 },
        minimapAppState({ width: 400, height: 300 }),
      ),
    ).toEqual({ scrollX: -800, scrollY: -650 });
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
          setAppState={noopSetAppState}
        />
      </div>,
    );

    expect(screen.queryByTestId("excalidraw-minimap")).toBeNull();
  });

  it("does not render when all elements are inside the viewport", () => {
    const rect = newElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 30,
      height: 30,
    });

    rtlRender(
      <div className="excalidraw">
        <Minimap
          elements={[rect]}
          elementsMap={sceneMapFrom([rect])}
          appState={minimapAppState({ width: 640, height: 480 })}
          setAppState={noopSetAppState}
        />
      </div>,
    );

    expect(screen.queryByTestId("excalidraw-minimap")).toBeNull();
  });

  it("exposes accessibility label, hide control, and viewport indicator", () => {
    const rect = newElement({
      type: "rectangle",
      x: 1000,
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
          setAppState={noopSetAppState}
        />
      </div>,
    );

    expect(screen.getByRole("img", { name: "Scene minimap" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Hide scene minimap" }),
    ).toBeTruthy();

    expect(screen.queryAllByTestId("minimap-viewport-indicator")).toHaveLength(
      1,
    );

    const selected = document.querySelectorAll(".minimap__element--selected");
    expect(selected.length).toBe(1);
  });

  it("renders a show button when collapsed", () => {
    const rect = newElement({
      type: "rectangle",
      x: 1000,
      y: 0,
      width: 10,
      height: 10,
    });
    const setAppState = vi.fn();

    rtlRender(
      <div className="excalidraw">
        <Minimap
          elements={[rect]}
          elementsMap={sceneMapFrom([rect])}
          appState={minimapAppState({
            width: 400,
            height: 300,
            minimap: { open: false },
          })}
          setAppState={setAppState as MinimapProps["setAppState"]}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show scene minimap" }));

    const updater = setAppState.mock.calls[0][0];
    expect(updater({ minimap: { open: false } } as AppState)).toEqual({
      minimap: { open: true },
    });
  });
});

describe("minimap integration", () => {
  const originalSvgGetBoundingClientRect =
    global.window.SVGElement.prototype.getBoundingClientRect;

  const mockSvgBoundingClientRect = () => {
    global.window.SVGElement.prototype.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        bottom: 120,
        right: 180,
        width: 180,
        height: 120,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect);
  };

  const restoreOriginalSvgBoundingClientRect = () => {
    global.window.SVGElement.prototype.getBoundingClientRect =
      originalSvgGetBoundingClientRect;
  };

  beforeEach(() => {
    if (typeof localStorage?.clear === "function") {
      localStorage.clear();
    }
    reseed(7);
  });

  afterEach(() => {
    cleanup();
    restoreOriginalGetBoundingClientRect();
    restoreOriginalSvgBoundingClientRect();
  });

  it("persists and restores the collapsed preference", async () => {
    expect(
      clearAppStateForLocalStorage({ minimap: { open: false } }).minimap,
    ).toEqual({ open: false });

    expect(
      restoreAppState(null, {
        ...getDefaultAppState(),
        minimap: { open: false },
      }).minimap,
    ).toEqual({ open: false });

    mockBoundingClientRect();
    const rect = newElement({
      type: "rectangle",
      x: 1200,
      y: 900,
      width: 100,
      height: 80,
    });

    await render(
      <Excalidraw
        initialData={{
          elements: [rect],
          appState: { minimap: { open: false } },
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("excalidraw-minimap")).toBeNull();
      expect(screen.getByTestId("minimap-show")).toBeTruthy();
    });
  });

  it("renders only when the scene extends outside the current viewport", async () => {
    mockBoundingClientRect();
    const inside = newElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 100,
      height: 80,
    });

    await render(<Excalidraw initialData={{ elements: [inside] }} />);
    await waitFor(() => {
      expect(h.state.width).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId("excalidraw-minimap")).toBeNull();

    cleanup();
    const outside = newElement({
      type: "rectangle",
      x: 1200,
      y: 900,
      width: 100,
      height: 80,
    });
    await render(<Excalidraw initialData={{ elements: [outside] }} />);

    await waitFor(() => {
      expect(screen.queryByTestId("excalidraw-minimap")).not.toBeNull();
    });
  });

  it("clicking and dragging the minimap pans the canvas", async () => {
    mockBoundingClientRect();
    mockSvgBoundingClientRect();
    const rect = newElement({
      type: "rectangle",
      x: 1200,
      y: 900,
      width: 100,
      height: 80,
    });

    await render(<Excalidraw initialData={{ elements: [rect] }} />);
    await waitFor(() => {
      expect(screen.queryByTestId("excalidraw-minimap")).not.toBeNull();
    });

    const minimap = screen.getByRole("img", { name: "Scene minimap" });
    const scrollBeforeClick = h.state.scrollX;

    fireEvent.pointerDown(minimap, {
      pointerId: 1,
      clientX: 170,
      clientY: 100,
    });
    await waitFor(() => {
      expect(h.state.scrollX).not.toBe(scrollBeforeClick);
    });

    const scrollAfterClick = h.state.scrollX;

    fireEvent.pointerMove(minimap, {
      pointerId: 1,
      clientX: 20,
      clientY: 20,
    });
    await waitFor(() => {
      expect(h.state.scrollX).not.toBe(scrollAfterClick);
    });

    act(() => {
      fireEvent.pointerUp(minimap, {
        pointerId: 1,
      });
    });
  });
});
