import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { useEffect, useState } from "react";

import { FancyPantsCharacter } from "./FancyPantsCharacter";
import {
  controlToken,
  inputFromTokens,
  isGameControl,
  isJumpToken,
} from "./controls";
import {
  cameraScrollFor,
  shapesToSolids,
  spawnBody,
  stepBody,
} from "./physics";

import "./FancyPantsMode.scss";

import type { ExcalidrawImperativeAPI } from "../types";
import type { Body, FancyPantsElement } from "./physics";

const toCollidable = (
  element: ReturnType<ExcalidrawImperativeAPI["getSceneElements"]>[number],
): FancyPantsElement => {
  const points =
    "points" in element
      ? (element.points as ReadonlyArray<readonly [number, number]>)
      : undefined;

  return {
    type: element.type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    angle: element.angle,
    strokeWidth: element.strokeWidth,
    isDeleted: element.isDeleted,
    points,
  };
};

export const FancyPantsMode = ({
  active,
  excalidrawAPI,
  onExit,
}: {
  active: boolean;
  excalidrawAPI: ExcalidrawImperativeAPI;
  onExit: () => void;
}) => {
  const [body, setBody] = useState<Body | null>(null);
  const [heldKeys, setHeldKeys] = useState("");

  useEffect(() => {
    if (!active) {
      setBody(null);
      return;
    }

    const appState = excalidrawAPI.getAppState();
    const previousViewMode = appState.viewModeEnabled;
    // Drop the selection so a leaked arrow cannot nudge an element.
    excalidrawAPI.updateScene({
      appState: { viewModeEnabled: true, selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    const keys = new Set<string>();
    let jumpPressed = false;
    let raf = 0;
    let last = performance.now();
    let cameraX = appState.scrollX;
    let cameraY = appState.scrollY;
    let snapped = false;

    const solidsNow = () =>
      shapesToSolids(excalidrawAPI.getSceneElements().map(toCollidable));

    const viewportScene = () => {
      const state = excalidrawAPI.getAppState();
      const zoom = state.zoom.value || 1;
      return {
        x: -state.scrollX,
        y: -state.scrollY,
        w: state.width / zoom,
        h: state.height / zoom,
      };
    };

    let current = spawnBody(solidsNow(), viewportScene());

    const swallow = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const inField =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (inField) {
        return;
      }

      if (event.key === "Escape" && !event.metaKey && !event.ctrlKey) {
        swallow(event);
        onExit();
        return;
      }

      if (!isGameControl(event)) {
        return;
      }

      swallow(event);
      const token = controlToken(event);
      if (!event.repeat && isJumpToken(token)) {
        jumpPressed = true;
      }
      keys.add(token);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!isGameControl(event) && event.key !== "Escape") {
        return;
      }
      swallow(event);
      keys.delete(controlToken(event));
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const solids = solidsNow();
      current = stepBody(
        current,
        solids,
        inputFromTokens(keys, jumpPressed),
        dt || 1 / 60,
      );
      jumpPressed = false;

      const state = excalidrawAPI.getAppState();
      const target = cameraScrollFor(current, {
        width: state.width,
        height: state.height,
        zoom: state.zoom.value || 1,
      });

      if (!snapped) {
        cameraX = target.scrollX;
        cameraY = target.scrollY;
        snapped = true;
      } else {
        const follow = 1 - Math.exp(-dt * 7);
        cameraX += (target.scrollX - cameraX) * follow;
        cameraY += (target.scrollY - cameraY) * follow;
      }

      excalidrawAPI.updateScene({
        appState: {
          scrollX: cameraX,
          scrollY: cameraY,
          viewModeEnabled: true,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      setBody(current);
      const held = ["arrowleft", "arrowright", "arrowup"]
        .filter((token) => keys.has(token))
        .join(" ");
      setHeldKeys(held);
      raf = requestAnimationFrame(frame);
    };

    // Window capture runs before the editor's document listener, including
    // when the canvas itself is focused.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    raf = requestAnimationFrame(frame);
    setBody(current);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      setHeldKeys("");
      excalidrawAPI.updateScene({
        appState: { viewModeEnabled: previousViewMode },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    };
  }, [active, excalidrawAPI, onExit]);

  if (!active || !body) {
    return null;
  }

  const state = excalidrawAPI.getAppState();
  const origin = sceneCoordsToViewportCoords(
    { sceneX: body.x, sceneY: body.y },
    state,
  );
  const zoom = state.zoom.value || 1;

  return (
    <>
      <div className="fancy-pants-hud" data-testid="fancy-pants-hud">
        Arrow keys: left and right run, up jumps. Hold into a wall to climb.
        <span data-testid="fancy-pants-keys">
          {heldKeys ? ` ${heldKeys}` : ""}
        </span>
      </div>
      <div
        className="fancy-pants-character"
        data-testid="fancy-pants-character"
        data-anim={body.anim}
        data-scene-x={Math.round(body.x)}
        data-scene-y={Math.round(body.y)}
        style={{
          left: origin.x,
          top: origin.y,
          width: body.w * zoom,
          height: body.h * zoom,
        }}
      >
        <FancyPantsCharacter
          anim={body.anim}
          time={body.time}
          facing={body.facing}
          climbingUp={body.vy < 0}
          speed={body.vx}
        />
      </div>
    </>
  );
};
