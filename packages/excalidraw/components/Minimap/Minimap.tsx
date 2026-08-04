import { useCallback, useEffect, useRef } from "react";
import throttle from "lodash.throttle";

import {
  getCommonBounds,
  getElementBounds,
  getVisibleElements,
  getVisibleSceneBounds,
} from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { t } from "../../i18n";
import { centerScrollOn } from "../../scene/scroll";
import {
  useExcalidrawAppState,
  useExcalidrawSetAppState,
  useEditorInterface,
} from "../App";
import { Island } from "../Island";
import { CloseIcon } from "../icons";

import {
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  getMinimapSceneBounds,
  getMinimapTransform,
  getViewportRectOnMinimap,
  hasElementsOutsideViewport,
  minimapCoordsToScene,
  type MinimapTransform,
} from "./utils";

import "./Minimap.scss";

import type { AppClassProperties, AppState } from "../../types";

const RENDER_THROTTLE_MS = 32;

interface MinimapProps {
  app: AppClassProperties;
  onClose: () => void;
}

const drawMinimap = (
  canvas: HTMLCanvasElement,
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  appState: AppState,
  transform: MinimapTransform,
) => {
  const dpr = window.devicePixelRatio || 1;
  const width = MINIMAP_WIDTH;
  const height = MINIMAP_HEIGHT;

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const styles = getComputedStyle(canvas);
  const elementFill =
    styles.getPropertyValue("--color-surface-high").trim() || "#d3d3d2";
  const elementStroke =
    styles.getPropertyValue("--color-border-outline").trim() ||
    styles.getPropertyValue("--default-border-color").trim() ||
    "#b8b8b4";
  const viewportStroke =
    styles.getPropertyValue("--color-primary").trim() || "#6965db";
  const viewportFill =
    styles.getPropertyValue("--color-primary-light").trim() ||
    "rgba(105, 101, 219, 0.25)";

  ctx.save();
  for (const element of elements) {
    const [x1, y1, x2, y2] = getElementBounds(element, elementsMap, true);
    const left =
      transform.offsetX + (x1 - transform.sceneMinX) * transform.scale;
    const top =
      transform.offsetY + (y1 - transform.sceneMinY) * transform.scale;
    const rectWidth = Math.max((x2 - x1) * transform.scale, 1);
    const rectHeight = Math.max((y2 - y1) * transform.scale, 1);

    ctx.globalAlpha = Math.min(Math.max(element.opacity / 100, 0.15), 0.85);
    ctx.fillStyle = elementFill;
    ctx.strokeStyle = elementStroke;
    ctx.lineWidth = 1;
    ctx.fillRect(left, top, rectWidth, rectHeight);
    ctx.strokeRect(left, top, rectWidth, rectHeight);
  }
  ctx.restore();

  const viewportBounds = getVisibleSceneBounds(appState);
  const viewportRect = getViewportRectOnMinimap(viewportBounds, transform);

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = viewportFill;
  ctx.strokeStyle = viewportStroke;
  ctx.lineWidth = 1.5;
  ctx.fillRect(
    viewportRect.x,
    viewportRect.y,
    viewportRect.width,
    viewportRect.height,
  );
  ctx.strokeRect(
    viewportRect.x,
    viewportRect.y,
    viewportRect.width,
    viewportRect.height,
  );
  ctx.restore();
};

export const Minimap = ({ app, onClose }: MinimapProps) => {
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const editorInterface = useEditorInterface();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<MinimapTransform | null>(null);
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  const sceneNonce = app.scene.getSceneNonce() || 1;
  const elements = getVisibleElements(app.scene.getNonDeletedElements());
  const elementsMap = app.scene.getNonDeletedElementsMap();

  const elementsBounds = getCommonBounds(elements, elementsMap);
  const viewportBounds = getVisibleSceneBounds(appState);
  const shouldRender =
    appState.showMinimap &&
    !appState.zenModeEnabled &&
    editorInterface.formFactor !== "phone" &&
    elements.length > 0 &&
    hasElementsOutsideViewport(elementsBounds, viewportBounds);

  const panToClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const transform = transformRef.current;
      if (!canvas || !transform) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const scenePoint = minimapCoordsToScene(localX, localY, transform);
      const state = appStateRef.current;

      setAppState(
        centerScrollOn({
          scenePoint,
          viewportDimensions: {
            width: state.width,
            height: state.height,
          },
          zoom: state.zoom,
        }),
      );
    },
    [setAppState],
  );

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const sceneBounds = getMinimapSceneBounds(elementsBounds, viewportBounds);
    const transform = getMinimapTransform(sceneBounds);
    transformRef.current = transform;

    const render = () => {
      drawMinimap(canvas, elements, elementsMap, appState, transform);
    };

    const throttledRender = throttle(render, RENDER_THROTTLE_MS);
    throttledRender();

    return () => {
      throttledRender.cancel();
    };
  }, [
    shouldRender,
    sceneNonce,
    elements,
    elementsMap,
    elementsBounds,
    viewportBounds,
    appState,
  ]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="ExcMinimap" data-testid="minimap">
      <Island padding={0} className="ExcMinimap__island">
        <div className="ExcMinimap__header">
          <span>{t("labels.minimap")}</span>
          <button
            type="button"
            className="ExcMinimap__close"
            aria-label={t("buttons.close")}
            title={t("buttons.close")}
            onClick={onClose}
          >
            {CloseIcon}
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="ExcMinimap__canvas"
          data-testid="minimap-canvas"
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            event.preventDefault();
            panToClientPoint(event.clientX, event.clientY);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
              return;
            }
            panToClientPoint(event.clientX, event.clientY);
          }}
        />
      </Island>
    </div>
  );
};
