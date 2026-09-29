import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { vi } from "vitest";

import { FancyPantsMode } from "./FancyPantsMode";

import type { ExcalidrawImperativeAPI } from "../types";

const floor = {
  type: "rectangle",
  x: 0,
  y: 200,
  width: 600,
  height: 40,
  angle: 0,
  strokeWidth: 2,
  isDeleted: false,
};

const installClock = () => {
  let now = 0;
  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 1;

  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    pending.delete(Number(id));
  });

  return {
    flush(ms: number) {
      now += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => {
        for (const callback of callbacks) {
          callback(now);
        }
      });
    },
  };
};

const mockApi = (viewModeEnabled = false) => {
  const appState = {
    viewModeEnabled,
    selectedElementIds: { shape: true } as Record<string, true>,
    scrollX: 0,
    scrollY: 0,
    width: 800,
    height: 600,
    zoom: { value: 1 },
    offsetLeft: 0,
    offsetTop: 0,
  };

  const updateScene = vi.fn(
    (payload: { appState?: Partial<typeof appState> }) => {
      if (payload.appState) {
        Object.assign(appState, payload.appState);
      }
    },
  );

  const api = {
    getAppState: () => appState,
    getSceneElements: () => [floor],
    updateScene,
  } as unknown as ExcalidrawImperativeAPI;

  return { api, appState, updateScene };
};

describe("fancy pants mode toggle", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("enters view mode, clears the selection, and draws the HUD", () => {
    const clock = installClock();
    const { api, appState, updateScene } = mockApi();

    render(<FancyPantsMode active excalidrawAPI={api} onExit={() => {}} />);
    clock.flush(16);

    expect(updateScene).toHaveBeenCalledWith(
      expect.objectContaining({
        appState: {
          viewModeEnabled: true,
          selectedElementIds: {},
        },
      }),
    );
    expect(appState.viewModeEnabled).toBe(true);
    expect(screen.getByTestId("fancy-pants-hud")).toBeTruthy();
    const character = screen.getByTestId("fancy-pants-character");
    expect(character).toHaveAttribute("data-anim", "idle");
  });

  it("restores the previous view mode and unmounts the HUD on exit", () => {
    const clock = installClock();
    const { api, appState } = mockApi(false);

    const { rerender } = render(
      <FancyPantsMode active excalidrawAPI={api} onExit={() => {}} />,
    );
    clock.flush(16);
    expect(screen.getByTestId("fancy-pants-character")).toBeTruthy();

    rerender(
      <FancyPantsMode active={false} excalidrawAPI={api} onExit={() => {}} />,
    );

    expect(screen.queryByTestId("fancy-pants-hud")).toBeNull();
    expect(screen.queryByTestId("fancy-pants-character")).toBeNull();
    expect(appState.viewModeEnabled).toBe(false);
  });

  it("keeps view mode on if it was already enabled before enter", () => {
    const clock = installClock();
    const { api, appState } = mockApi(true);

    const { rerender } = render(
      <FancyPantsMode active excalidrawAPI={api} onExit={() => {}} />,
    );
    clock.flush(16);
    rerender(
      <FancyPantsMode active={false} excalidrawAPI={api} onExit={() => {}} />,
    );

    expect(appState.viewModeEnabled).toBe(true);
  });

  it("exits on Escape", () => {
    const clock = installClock();
    const { api } = mockApi();
    const onExit = vi.fn();

    render(<FancyPantsMode active excalidrawAPI={api} onExit={onExit} />);
    clock.flush(16);

    act(() => {
      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    });

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("queues ArrowUp until a physics step can launch an idle jump", () => {
    const clock = installClock();
    const { api } = mockApi();

    render(<FancyPantsMode active excalidrawAPI={api} onExit={() => {}} />);
    clock.flush(4);

    const grounded = screen.getByTestId("fancy-pants-character");
    expect(grounded).toHaveAttribute("data-anim", "idle");
    const groundedY = Number(grounded.getAttribute("data-scene-y"));

    act(() => {
      fireEvent.keyDown(window, { key: "ArrowUp", code: "ArrowUp" });
    });
    clock.flush(4);

    const waiting = screen.getByTestId("fancy-pants-character");
    expect(waiting).toHaveAttribute("data-anim", "idle");
    expect(waiting.getAttribute("data-scene-y")).toBe(String(groundedY));
    expect(screen.getByTestId("fancy-pants-keys").textContent).toContain(
      "arrowup",
    );

    clock.flush(20);

    const airborne = screen.getByTestId("fancy-pants-character");
    expect(airborne).toHaveAttribute("data-anim", "jump");
    expect(Number(airborne.getAttribute("data-scene-y"))).toBeLessThan(
      groundedY,
    );
  });

  it("shows held run keys and launches a running jump from ArrowUp", () => {
    const clock = installClock();
    const { api } = mockApi();

    render(<FancyPantsMode active excalidrawAPI={api} onExit={() => {}} />);
    clock.flush(16);

    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });
    });
    clock.flush(400);

    const running = screen.getByTestId("fancy-pants-character");
    expect(running).toHaveAttribute("data-anim", "run");
    const runX = Number(running.getAttribute("data-scene-x"));
    const runY = Number(running.getAttribute("data-scene-y"));
    expect(screen.getByTestId("fancy-pants-keys").textContent).toContain(
      "arrowright",
    );

    act(() => {
      fireEvent.keyDown(window, { key: "ArrowUp", code: "ArrowUp" });
    });
    clock.flush(80);

    const airborne = screen.getByTestId("fancy-pants-character");
    expect(airborne).toHaveAttribute("data-anim", "jump");
    expect(Number(airborne.getAttribute("data-scene-x"))).toBeGreaterThan(runX);
    expect(Number(airborne.getAttribute("data-scene-y"))).toBeLessThan(runY);
  });
});
