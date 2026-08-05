import { toBrandedType } from "@excalidraw/common";
import rough from "roughjs/bin/rough";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { getDefaultAppState } from "../../appState";
import { useAppStateValue } from "../../hooks/useAppStateValue";
import { renderStaticScene } from "../../renderer/staticScene";
import { centerScrollOn } from "../../scene/scroll";
import { useApp, useExcalidrawSetAppState } from "../App";
import { Island } from "../Island";

import {
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  computeMinimapTransform,
  getMainViewportBounds,
  getMinimapSceneBounds,
  getViewportRectInMinimap,
  minimapToSceneCoords,
} from "./minimapUtils";

import "./Minimap.scss";

import type { NonDeletedSceneElementsMap } from "@excalidraw/element/types";
import type { RenderableElementsMap } from "../../scene/types";
import type { RoughCanvas } from "roughjs/bin/canvas";

export const Minimap = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rcRef = useRef<RoughCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const scrollState = useAppStateValue((appState) => ({
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
    width: appState.width,
    height: appState.height,
    theme: appState.theme,
    viewBackgroundColor: appState.viewBackgroundColor,
  }));

  const sceneNonce = app.scene.getSceneNonce();

  const transform = useMemo(() => {
    const elements = app.scene.getNonDeletedElements();
    return computeMinimapTransform(getMinimapSceneBounds(elements));
  }, [app, sceneNonce]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (!rcRef.current) {
      rcRef.current = rough.canvas(canvas);
    }

    const scale = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * scale;
    canvas.height = MINIMAP_HEIGHT * scale;
    canvas.style.width = `${MINIMAP_WIDTH}px`;
    canvas.style.height = `${MINIMAP_HEIGHT}px`;

    const elements = app.scene.getNonDeletedElements();
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const defaultAppState = getDefaultAppState();

    renderStaticScene({
      canvas,
      rc: rcRef.current,
      scale,
      elementsMap: toBrandedType<RenderableElementsMap>(elementsMap),
      allElementsMap: toBrandedType<NonDeletedSceneElementsMap>(elementsMap),
      visibleElements: elements,
      appState: {
        ...defaultAppState,
        scrollX: transform.scrollX,
        scrollY: transform.scrollY,
        zoom: transform.zoom,
        width: transform.width,
        height: transform.height,
        viewBackgroundColor: scrollState.viewBackgroundColor,
        theme: scrollState.theme,
        selectedElementIds: {},
        viewModeEnabled: false,
        offsetLeft: 0,
        offsetTop: 0,
      },
      renderConfig: {
        canvasBackgroundColor: scrollState.viewBackgroundColor,
        imageCache: app.imageCache,
        renderGrid: false,
        isExporting: false,
        embedsValidationStatus: new Map(),
        elementsPendingErasure: new Set(),
        pendingFlowchartNodes: null,
        theme: scrollState.theme,
      },
    });
  }, [
    app,
    sceneNonce,
    scrollState.theme,
    scrollState.viewBackgroundColor,
    transform,
  ]);

  const viewportRect = useMemo(
    () =>
      getViewportRectInMinimap(
        transform,
        getMainViewportBounds(scrollState),
      ),
    [scrollState, transform],
  );

  const panToMinimapPoint = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const minimapX = clientX - rect.left;
      const minimapY = clientY - rect.top;
      const scenePoint = minimapToSceneCoords(minimapX, minimapY, transform);

      const { scrollX, scrollY } = centerScrollOn({
        scenePoint,
        viewportDimensions: {
          width: scrollState.width,
          height: scrollState.height,
        },
        zoom: scrollState.zoom,
      });

      setAppState({ scrollX, scrollY });
    },
    [scrollState, setAppState, transform],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    isDraggingRef.current = true;
    containerRef.current?.setPointerCapture(event.pointerId);
    panToMinimapPoint(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    panToMinimapPoint(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    if (containerRef.current?.hasPointerCapture(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <Island className="Minimap" padding={0.25}>
      <div
        ref={containerRef}
        className="Minimap__container"
        aria-label="Scene minimap"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="Minimap__canvas" />
        <div
          className="Minimap__viewport"
          style={{
            left: viewportRect.left,
            top: viewportRect.top,
            width: viewportRect.width,
            height: viewportRect.height,
          }}
        />
      </div>
    </Island>
  );
};

Minimap.displayName = "Minimap";
