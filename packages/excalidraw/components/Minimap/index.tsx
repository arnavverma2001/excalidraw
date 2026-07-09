import clsx from "clsx";
import throttle from "lodash.throttle";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { arrayToMap } from "@excalidraw/common";
import { getVisibleElements } from "@excalidraw/element";

import { t } from "../../i18n";
import { centerScrollOn } from "../../scene/scroll";
import {
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  drawMinimapElements,
  drawMinimapViewport,
  getMinimapData,
  getMinimapViewportRect,
  hasElementsOutsideViewport,
  minimapToSceneCoords,
} from "../../scene/minimap";
import { useExcalidrawAppState } from "../App";
import { Island } from "../Island";
import { CloseIcon, minimapIcon } from "../icons";

import "./Minimap.scss";

import type { AppClassProperties } from "../../types";

const MINIMAP_RENDER_THROTTLE_MS = 32;

interface MinimapProps {
  app: AppClassProperties;
  elements: readonly import("@excalidraw/element/types").NonDeletedExcalidrawElement[];
  onClose: () => void;
}

const MinimapInner = ({
  app,
  elements,
  onClose,
  sceneNonce,
}: MinimapProps & { sceneNonce: number }) => {
  const appState = useExcalidrawAppState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const visibleElements = useMemo(
    () => getVisibleElements(elements),
    [elements],
  );
  const elementsMap = useMemo(() => arrayToMap(elements), [elements]);

  const minimapData = useMemo(
    () => getMinimapData(visibleElements, appState),
    [
      visibleElements,
      appState.scrollX,
      appState.scrollY,
      appState.width,
      appState.height,
      appState.zoom.value,
    ],
  );

  const panToMinimapPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!minimapData || !wrapperRef.current) {
        return;
      }

      const rect = wrapperRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const scenePoint = minimapToSceneCoords(x, y, minimapData);
      const { scrollX, scrollY } = centerScrollOn({
        scenePoint,
        viewportDimensions: {
          width: appState.width,
          height: appState.height,
        },
        zoom: appState.zoom,
        offsets: app.getEditorUIOffsets(),
      });

      app.setAppState({ scrollX, scrollY });
    },
    [app, appState.height, appState.width, appState.zoom, minimapData],
  );

  const renderMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !minimapData) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    canvas.style.width = `${MINIMAP_WIDTH}px`;
    canvas.style.height = `${MINIMAP_HEIGHT}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    drawMinimapElements(
      ctx,
      visibleElements,
      elementsMap,
      minimapData,
      appState.theme,
    );

    const viewportRect = getMinimapViewportRect(appState, minimapData);
    drawMinimapViewport(ctx, viewportRect, appState.theme);
  }, [
    appState,
    elementsMap,
    minimapData,
    visibleElements,
  ]);

  const throttledRender = useMemo(
    () => throttle(renderMinimap, MINIMAP_RENDER_THROTTLE_MS),
    [renderMinimap],
  );

  useEffect(() => {
    throttledRender();
    return () => {
      throttledRender.cancel();
    };
  }, [throttledRender, sceneNonce, appState.theme]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    panToMinimapPoint(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) {
      return;
    }
    panToMinimapPoint(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  };

  if (!minimapData || !hasElementsOutsideViewport(visibleElements, appState)) {
    return null;
  }

  return (
    <div
      className={clsx("exc-minimap", {
        "exc-minimap--collapsed": collapsed,
        "exc-minimap--dragging": isDragging,
      })}
      data-testid="minimap"
    >
      <Island padding={0.5} className="exc-minimap__container">
        <div className="exc-minimap__header">
          <span className="exc-minimap__title">{t("minimap.title")}</span>
          <div className="exc-minimap__actions">
            <button
              type="button"
              className="exc-minimap__button"
              title={
                collapsed ? t("minimap.expand") : t("minimap.collapse")
              }
              aria-label={
                collapsed ? t("minimap.expand") : t("minimap.collapse")
              }
              onClick={() => setCollapsed((value) => !value)}
            >
              {minimapIcon}
            </button>
            <button
              type="button"
              className="exc-minimap__button"
              title={t("minimap.hide")}
              aria-label={t("minimap.hide")}
              onClick={onClose}
            >
              {CloseIcon}
            </button>
          </div>
        </div>
        <div
          ref={wrapperRef}
          className="exc-minimap__canvas-wrapper"
          data-testid="minimap-canvas-wrapper"
        >
          <canvas
            ref={canvasRef}
            className="exc-minimap__canvas"
            data-testid="minimap-canvas"
            width={MINIMAP_WIDTH}
            height={MINIMAP_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>
      </Island>
    </div>
  );
};

export const Minimap = memo((props: MinimapProps) => {
  const sceneNonce = props.app.scene.getSceneNonce() || 1;

  return <MinimapInner {...props} sceneNonce={sceneNonce} />;
});

Minimap.displayName = "Minimap";
