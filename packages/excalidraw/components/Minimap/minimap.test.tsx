import { fireEvent, waitFor } from "@testing-library/react";
import React from "react";

import {
  getDefaultAppState,
  clearAppStateForLocalStorage,
} from "../../appState";
import { Excalidraw } from "../..";
import { actionToggleMinimap } from "../../actions";
import { API } from "../../tests/helpers/api";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "../../tests/test-utils";

import {
  getMinimapViewportRect,
  getMinimapTransform,
  hasContentOutsideViewport,
  minimapToSceneCoords,
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
} from "./utils";

const { h } = window;

describe("minimap utils", () => {
  it("should compute minimap transform with aspect ratio preserved", () => {
    const transform = getMinimapTransform(
      [0, 0, 200, 100],
      MINIMAP_WIDTH,
      MINIMAP_HEIGHT,
    );

    expect(transform.scale).toBeGreaterThan(0);
    expect(transform.offsetX).toBeDefined();
    expect(transform.offsetY).toBeDefined();
  });

  it("should convert minimap coords back to scene coords", () => {
    const transform = getMinimapTransform(
      [0, 0, 100, 100],
      MINIMAP_WIDTH,
      MINIMAP_HEIGHT,
    );
    const scenePoint = minimapToSceneCoords(50, 50, transform);

    expect(scenePoint.x).toBeGreaterThan(0);
    expect(scenePoint.y).toBeGreaterThan(0);
  });

  it("should compute viewport rectangle from app state", () => {
    const transform = getMinimapTransform(
      [0, 0, 1000, 1000],
      MINIMAP_WIDTH,
      MINIMAP_HEIGHT,
    );
    const viewportRect = getMinimapViewportRect(
      {
        scrollX: 0,
        scrollY: 0,
        width: 500,
        height: 400,
        zoom: { value: 1 as any },
      },
      transform,
    );

    expect(viewportRect.width).toBeGreaterThan(0);
    expect(viewportRect.height).toBeGreaterThan(0);
  });

  it("should detect content outside viewport", () => {
    const elements = [
      API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      }),
      API.createElement({
        type: "rectangle",
        x: 2000,
        y: 2000,
        width: 100,
        height: 100,
      }),
    ];
    const elementsMap = new Map(
      elements.map((element) => [element.id, element]),
    );

    expect(
      hasContentOutsideViewport(elements, elementsMap, {
        scrollX: 0,
        scrollY: 0,
        width: 500,
        height: 400,
        zoom: { value: 1 as any },
      }),
    ).toBe(true);

    expect(
      hasContentOutsideViewport([elements[0]], elementsMap, {
        scrollX: 0,
        scrollY: 0,
        width: 2000,
        height: 2000,
        zoom: { value: 1 as any },
      }),
    ).toBe(false);
  });
});

describe("minimap component", () => {
  beforeEach(async () => {
    localStorage.clear();
    mockBoundingClientRect();
    await render(<Excalidraw />);
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should hide when all elements fit in the viewport", async () => {
    API.updateScene({
      elements: [
        API.createElement({
          type: "rectangle",
          x: 10,
          y: 10,
          width: 50,
          height: 50,
        }),
      ],
    });

    await waitFor(() => {
      expect(document.querySelector('[data-testid="minimap"]')).toBeNull();
    });
  });

  it("should show when content is outside the viewport", async () => {
    API.updateScene({
      elements: [
        API.createElement({
          type: "rectangle",
          x: 10,
          y: 10,
          width: 50,
          height: 50,
        }),
        API.createElement({
          type: "rectangle",
          x: 3000,
          y: 3000,
          width: 50,
          height: 50,
        }),
      ],
    });

    await waitFor(() => {
      expect(document.querySelector('[data-testid="minimap"]')).not.toBeNull();
    });
  });

  it("should persist collapsed preference in local storage app state", () => {
    const defaultAppState = getDefaultAppState();
    const persisted = clearAppStateForLocalStorage({
      ...defaultAppState,
      minimap: { collapsed: true },
    });

    expect(persisted.minimap).toEqual({ collapsed: true });
  });

  it("should restore collapsed preference from initial data", async () => {
    restoreOriginalGetBoundingClientRect();
    mockBoundingClientRect();

    await render(
      <Excalidraw
        initialData={{
          appState: {
            minimap: { collapsed: true },
          },
          elements: [
            API.createElement({
              type: "rectangle",
              x: 0,
              y: 0,
              width: 50,
              height: 50,
            }),
            API.createElement({
              type: "rectangle",
              x: 3000,
              y: 3000,
              width: 50,
              height: 50,
            }),
          ],
        }}
      />,
    );

    await waitFor(() => {
      expect(h.state.minimap.collapsed).toBe(true);
      expect(document.querySelector('[data-testid="minimap"]')).toBeNull();
      expect(document.querySelector(".minimap--collapsed")).not.toBeNull();
    });
  });

  it("should pan the canvas when clicking the minimap", async () => {
    API.updateScene({
      elements: [
        API.createElement({
          type: "rectangle",
          x: 0,
          y: 0,
          width: 50,
          height: 50,
        }),
        API.createElement({
          type: "rectangle",
          x: 3000,
          y: 3000,
          width: 50,
          height: 50,
        }),
      ],
    });

    let minimapCanvas: HTMLCanvasElement | null = null;

    await waitFor(() => {
      minimapCanvas = document.querySelector(
        ".minimap__canvas",
      ) as HTMLCanvasElement | null;
      expect(minimapCanvas).not.toBeNull();
    });

    const initialScrollX = h.state.scrollX;
    const initialScrollY = h.state.scrollY;

    fireEvent.pointerDown(minimapCanvas!, {
      clientX: 180,
      clientY: 130,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      buttons: 1,
    });

    await waitFor(() => {
      expect(h.state.scrollX).not.toBe(initialScrollX);
      expect(h.state.scrollY).not.toBe(initialScrollY);
    });
  });

  it("should toggle collapsed state via action", async () => {
    API.updateScene({
      elements: [
        API.createElement({
          type: "rectangle",
          x: 0,
          y: 0,
          width: 50,
          height: 50,
        }),
        API.createElement({
          type: "rectangle",
          x: 3000,
          y: 3000,
          width: 50,
          height: 50,
        }),
      ],
    });

    await waitFor(() => {
      expect(document.querySelector('[data-testid="minimap"]')).not.toBeNull();
    });

    h.app.actionManager.executeAction(actionToggleMinimap);

    await waitFor(() => {
      expect(h.state.minimap.collapsed).toBe(true);
      expect(document.querySelector('[data-testid="minimap"]')).toBeNull();
    });
  });
});
