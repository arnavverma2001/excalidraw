import React, { useCallback, useEffect, useRef } from "react";

import { centerScrollOn } from "../../scene/scroll";
import { actionToggleMinimap } from "../../actions";
import { t } from "../../i18n";
import {
  useApp,
  useExcalidrawActionManager,
  useExcalidrawAppState,
  useExcalidrawElements,
  useExcalidrawSetAppState,
} from "../App";
import { collapseDownIcon, collapseUpIcon } from "../icons";
import { Island } from "../Island";

import {
  drawMinimap,
  getMinimapColors,
  getMinimapTransformForScene,
  hasContentOutsideViewport,
  minimapToSceneCoords,
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
} from "./utils";

import "./Minimap.scss";

const applyElementOpacity = (color: string, opacity: number) => {
  const trimmed = color.trim();
  if (trimmed.startsWith("#") && trimmed.length === 7) {
    const r = parseInt(trimmed.slice(1, 3), 16);
    const g = parseInt(trimmed.slice(3, 5), 16);
    const b = parseInt(trimmed.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  return trimmed;
};

export const Minimap = () => {
  const app = useApp();
  const elements = useExcalidrawElements();
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const actionManager = useExcalidrawActionManager();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef(
    getMinimapTransformForScene(
      elements,
      app.scene.getNonDeletedElementsMap(),
      appState,
    ),
  );
  const isDraggingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const elementsMap = app.scene.getNonDeletedElementsMap();
  const shouldShow = hasContentOutsideViewport(elements, elementsMap, appState);
  const isCollapsed = appState.minimap.collapsed;

  const panToMinimapPoint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const scenePoint = minimapToSceneCoords(x, y, transformRef.current);

      setAppState((state) =>
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

  const scheduleDraw = useCallback(() => {
    if (rafIdRef.current !== null) {
      return;
    }

    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || isCollapsed) {
        return;
      }

      transformRef.current = getMinimapTransformForScene(
        elements,
        elementsMap,
        appState,
      );

      const colors = getMinimapColors(container);
      drawMinimap({
        canvas,
        elements,
        elementsMap,
        appState,
        colors: {
          elementFill: applyElementOpacity(colors.elementFill, 0.35),
          frameFill: applyElementOpacity(colors.frameFill, 0.45),
          viewportStroke: colors.viewportStroke,
          background: colors.background,
        },
      });
    });
  }, [appState, elements, elementsMap, isCollapsed]);

  useEffect(() => {
    scheduleDraw();

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [scheduleDraw]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    panToMinimapPoint(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) {
      return;
    }

    panToMinimapPoint(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleToggle = () => {
    actionManager.executeAction(actionToggleMinimap);
  };

  if (!shouldShow) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className="minimap minimap--collapsed" ref={containerRef}>
        <Island padding={0.25}>
          <button
            type="button"
            className="minimap__toggle-button"
            onClick={handleToggle}
            title={t("minimap.expand")}
            aria-label={t("minimap.expand")}
          >
            {collapseUpIcon}
          </button>
        </Island>
      </div>
    );
  }

  return (
    <div className="minimap" ref={containerRef} data-testid="minimap">
      <Island padding={0.5}>
        <div className="minimap__header">
          <span className="minimap__title">{t("minimap.title")}</span>
          <button
            type="button"
            className="minimap__toggle-button"
            onClick={handleToggle}
            title={t("minimap.collapse")}
            aria-label={t("minimap.collapse")}
          >
            {collapseDownIcon}
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="minimap__canvas"
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </Island>
    </div>
  );
};
