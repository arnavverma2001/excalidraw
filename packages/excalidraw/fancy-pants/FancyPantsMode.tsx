import { CaptureUpdateAction } from "@excalidraw/element";
import { useEffect, useState } from "react";

import { FancyPantsCharacter } from "./FancyPantsCharacter";
import {
  controlToken,
  inputFromTokens,
  isGameControl,
  isJumpToken,
  queueJump,
} from "./controls";
import {
  CHARACTER_RENDER_SCALE,
  interpolatePosition,
  lookFromBody,
  PHYSICS_DT,
  stepLook,
} from "./motion";
import {
  cameraScrollFor,
  shapesToSolids,
  spawnBody,
  stepBody,
} from "./physics";

import "./FancyPantsMode.scss";

import type { ExcalidrawImperativeAPI } from "../types";
import type { FramePose } from "./motion";
import type { Anim, Body, FancyPantsElement } from "./physics";

type Snapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
  pose: FramePose;
  anim: Anim;
  sceneX: number;
  sceneY: number;
  held: string;
};

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
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!active) {
      setSnapshot(null);
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
    let jumpWasHeld = false;
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
    let previous: Body = current;
    let accumulator = 0;
    const look = lookFromBody(current);

    const swallow = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onKeyDown = (event: KeyboardEvent) => {
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
      const dt = Math.min(0.05, (now - last) / 1000) || 1 / 60;
      last = now;
      const solids = solidsNow();
      const jumpHeld =
        keys.has("arrowup") || keys.has("w") || keys.has(" ");
      jumpPressed = queueJump(jumpPressed, jumpWasHeld, jumpHeld);
      jumpWasHeld = jumpHeld;
      const input = inputFromTokens(keys, jumpPressed);
      accumulator += dt;
      let jump = input.jumpPressed;
      while (accumulator >= PHYSICS_DT) {
        previous = current;
        current = stepBody(
          current,
          solids,
          { ...input, jumpPressed: jump },
          PHYSICS_DT,
        );
        if (jump) {
          jumpPressed = false;
        }
        jump = false;
        accumulator -= PHYSICS_DT;
      }
      const visual = interpolatePosition(
        previous,
        current,
        accumulator / PHYSICS_DT,
      );

      const state = excalidrawAPI.getAppState();
      const zoom = state.zoom.value || 1;
      const pose = stepLook(
        look,
        {
          x: visual.x,
          y: visual.y,
          vx: current.vx,
          vy: current.vy,
          facing: current.facing,
          onGround: current.onGround,
          climbing: current.climbing,
        },
        dt,
      );
      const target = cameraScrollFor(
        { ...current, x: visual.x, y: visual.y },
        {
          width: state.width,
          height: state.height,
          zoom,
        },
      );

      if (!snapped) {
        cameraX = target.scrollX;
        cameraY = target.scrollY;
        snapped = true;
      } else {
        const follow = 1 - Math.exp(-dt * 7);
        cameraX += (target.scrollX - cameraX) * follow;
        if (current.onGround) {
          cameraY += (target.scrollY - cameraY) * follow;
        } else if (current.climbing) {
          const climbFollow = 1 - Math.exp(-dt * 2.5);
          cameraY += (target.scrollY - cameraY) * climbFollow;
        }
      }

      excalidrawAPI.updateScene({
        appState: {
          scrollX: cameraX,
          scrollY: cameraY,
          viewModeEnabled: true,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      const held = ["arrowleft", "arrowright", "arrowup"]
        .filter((token) => keys.has(token))
        .join(" ");
      const drawWidth = current.w * CHARACTER_RENDER_SCALE;
      const drawHeight = current.h * CHARACTER_RENDER_SCALE;
      setSnapshot({
        left:
          (visual.x +
            current.w / 2 -
            drawWidth / 2 +
            cameraX) *
            zoom +
          state.offsetLeft,
        top:
          (visual.y + current.h - drawHeight + pose.drop + cameraY) * zoom +
          state.offsetTop,
        width: drawWidth * zoom,
        height: drawHeight * zoom,
        pose,
        anim: current.anim,
        sceneX: visual.x,
        sceneY: visual.y,
        held,
      });
      raf = requestAnimationFrame(frame);
    };

    // Window capture runs before the editor's document listener, including
    // when the canvas itself is focused.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      excalidrawAPI.updateScene({
        appState: { viewModeEnabled: previousViewMode },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    };
  }, [active, excalidrawAPI, onExit]);

  if (!active || !snapshot) {
    return null;
  }

  return (
    <>
      <div className="fancy-pants-hud" data-testid="fancy-pants-hud">
        Arrow keys: left and right run, up jumps. Hold into a wall to climb.
        <span data-testid="fancy-pants-keys">
          {snapshot.held ? ` ${snapshot.held}` : ""}
        </span>
      </div>
      <div
        className="fancy-pants-character"
        data-testid="fancy-pants-character"
        data-anim={snapshot.anim}
        data-scene-x={Math.round(snapshot.sceneX)}
        data-scene-y={Math.round(snapshot.sceneY)}
        style={{
          left: snapshot.left,
          top: snapshot.top,
          width: snapshot.width,
          height: snapshot.height,
        }}
      >
        <FancyPantsCharacter pose={snapshot.pose} />
      </div>
    </>
  );
};
