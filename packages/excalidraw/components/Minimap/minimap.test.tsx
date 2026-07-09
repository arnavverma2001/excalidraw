import React from "react";
import { act, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Excalidraw } from "../..";
import { actionToggleMinimap } from "../../actions";
import { getDefaultAppState } from "../../appState";
import { API } from "../../tests/helpers/api";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "../../tests/test-utils";

const { h } = window;

const mockDesktopViewport = () =>
  mockBoundingClientRect({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 1920,
    height: 1080,
    x: 0,
    y: 0,
  });

describe("Minimap", () => {
  it("shows minimap when elements are outside the viewport", async () => {
    mockDesktopViewport();
    await render(<Excalidraw />);

    act(() => {
      h.app.refreshEditorInterface();
      h.app.refresh();
    });

    API.updateScene({
      elements: [
        API.createElement({
          type: "rectangle",
          x: 2000,
          y: 2000,
          width: 100,
          height: 100,
        }),
      ],
    });

    await waitFor(() => {
      expect(document.querySelector('[data-testid="minimap"]')).not.toBeNull();
    });

    restoreOriginalGetBoundingClientRect();
  });

  it("hides minimap when preference is disabled", async () => {
    mockDesktopViewport();
    await render(
      <Excalidraw
        initialData={{
          appState: {
            ...getDefaultAppState(),
            minimap: { open: false },
          },
        }}
      />,
    );

    act(() => {
      h.app.refreshEditorInterface();
      h.app.refresh();
    });

    API.updateScene({
      elements: [
        API.createElement({
          type: "rectangle",
          x: 2000,
          y: 2000,
          width: 100,
          height: 100,
        }),
      ],
    });

    await waitFor(() => {
      expect(document.querySelector('[data-testid="minimap"]')).toBeNull();
    });

    restoreOriginalGetBoundingClientRect();
  });

  it("persists minimap preference when toggled", async () => {
    mockDesktopViewport();
    await render(<Excalidraw />);

    act(() => {
      h.app.refreshEditorInterface();
      h.app.refresh();
    });

    expect(h.state.minimap.open).toBe(true);

    API.executeAction(actionToggleMinimap);

    expect(h.state.minimap.open).toBe(false);

    API.executeAction(actionToggleMinimap);

    expect(h.state.minimap.open).toBe(true);

    restoreOriginalGetBoundingClientRect();
  });

  it("pans the canvas when clicking the minimap", async () => {
    mockDesktopViewport();
    await render(<Excalidraw />);

    act(() => {
      h.app.refreshEditorInterface();
      h.app.refresh();
    });

    API.updateScene({
      elements: [
        API.createElement({
          type: "rectangle",
          x: 2000,
          y: 2000,
          width: 100,
          height: 100,
        }),
      ],
    });

    await waitFor(() => {
      expect(document.querySelector('[data-testid="minimap-canvas"]')).not.toBeNull();
    });

    const initialScrollX = h.state.scrollX;
    const initialScrollY = h.state.scrollY;
    const canvas = document.querySelector(
      '[data-testid="minimap-canvas"]',
    ) as HTMLCanvasElement;

    act(() => {
      fireEvent.pointerDown(canvas, {
        clientX: 80,
        clientY: 60,
        pointerId: 1,
        buttons: 1,
      });
      fireEvent.pointerUp(canvas, {
        clientX: 80,
        clientY: 60,
        pointerId: 1,
      });
    });

    expect(h.state.scrollX).not.toBe(initialScrollX);
    expect(h.state.scrollY).not.toBe(initialScrollY);

    restoreOriginalGetBoundingClientRect();
  });
});
