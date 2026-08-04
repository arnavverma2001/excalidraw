import {
  getCommonBounds,
  getElementBounds,
  getVisibleElements,
  getVisibleSceneBounds,
} from "@excalidraw/element";
import clsx from "clsx";
import { useCallback, useEffect, useRef } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../../i18n";
import { centerScrollOn } from "../../scene/scroll";
import {
  useEditorInterface,
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "../App";
import { CloseIcon } from "../icons";
import { Island } from "../Island";

import {
  getMinimapSceneBounds,
  getMinimapTransform,
  getViewportRectInMinimap,
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  minimapToScene,
} from "./utils";

import type { AppClassProperties, AppState } from "../../types";

interface MinimapProps {
  app: AppClassProperties;
  onClose: () => void;
}

const drawMinimap = (
  canvas: HTMLCanvasElement,
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ReturnType<
    AppClassProperties["scene"]["getNonDeletedElementsMap"]
  >,
  appState: AppState,
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

  const viewportBounds = getVisibleSceneBounds(appState);
  const elementsBounds = elements.length > 0 ? getCommonBounds(elements) : null;
  const scene = getMinimapSceneBounds(elementsBounds, viewportBounds);
  const transform = getMinimapTransform(scene, width, height);

  // Background
  ctx.fillStyle =
    getComputedStyle(canvas).getPropertyValue("--minimap-bg-color") ||
    "rgba(255,255,255,0.9)";
  ctx.fillRect(0, 0, width, height);

  // Simplified element overview
  for (const element of elements) {
    const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
    const left = transform.offsetX + (x1 - scene.minX) * transform.scale;
    const top = transform.offsetY + (y1 - scene.minY) * transform.scale;
    const w = Math.max(1, (x2 - x1) * transform.scale);
    const h = Math.max(1, (y2 - y1) * transform.scale);

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = element.strokeColor || "#868e96";
    ctx.fillRect(left, top, w, h);
  }
  ctx.globalAlpha = 1;

  // Viewport rectangle
  const viewportRect = getViewportRectInMinimap(
    viewportBounds,
    scene,
    transform,
  );
  ctx.strokeStyle =
    getComputedStyle(canvas).getPropertyValue("--minimap-viewport-color") ||
    "#6965db";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    viewportRect.x,
    viewportRect.y,
    viewportRect.width,
    viewportRect.height,
  );
  ctx.fillStyle =
    getComputedStyle(canvas).getPropertyValue("--minimap-viewport-fill") ||
    "rgba(105, 101, 219, 0.12)";
  ctx.fillRect(
    viewportRect.x,
    viewportRect.y,
    viewportRect.width,
    viewportRect.height,
  );
};

export const Minimap = ({ app, onClose }: MinimapProps) => {
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const editorInterface = useEditorInterface();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const elements = getVisibleElements(app.scene.getNonDeletedElements());
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const sceneNonce = app.scene.getSceneNonce() || 1;

  const viewportBounds = getVisibleSceneBounds(appState);
  const elementsBounds = elements.length > 0 ? getCommonBounds(elements) : null;

  const panToClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const minimapX = clientX - rect.left;
      const minimapY = clientY - rect.top;

      const scene = getMinimapSceneBounds(elementsBounds, viewportBounds);
      const transform = getMinimapTransform(scene);
      const scenePoint = minimapToScene(minimapX, minimapY, scene, transform);

      setAppState({
        ...centerScrollOn({
          scenePoint,
          viewportDimensions: {
            width: appState.width,
            height: appState.height,
          },
          zoom: appState.zoom,
        }),
      });
    },
    [
      appState.height,
      appState.width,
      appState.zoom,
      elementsBounds,
      setAppState,
      viewportBounds,
    ],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      drawMinimap(canvas, elements, elementsMap, appState);
      rafRef.current = null;
    });

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    appState,
    appState.scrollX,
    appState.scrollY,
    appState.zoom,
    appState.width,
    appState.height,
    appState.theme,
    elements,
    elementsMap,
    sceneNonce,
  ]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current) {
        return;
      }
      panToClientPoint(event.clientX, event.clientY);
    };
    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [panToClientPoint]);

  if (editorInterface.formFactor === "phone") {
    return null;
  }

  return (
    <div className={clsx("excalidraw-minimap")} data-testid="minimap">
      <Island padding={2}>
        <div className="excalidraw-minimap__header">
          <span className="excalidraw-minimap__title">
            {t("minimap.title")}
          </span>
          <button
            type="button"
            className="excalidraw-minimap__close"
            onClick={onClose}
            aria-label={t("minimap.hide")}
            data-testid="minimap-close"
          >
            {CloseIcon}
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="excalidraw-minimap__canvas"
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          data-testid="minimap-canvas"
          aria-label={t("minimap.title")}
          onPointerDown={(event) => {
            event.preventDefault();
            isDraggingRef.current = true;
            panToClientPoint(event.clientX, event.clientY);
          }}
        />
      </Island>
    </div>
  );
};
