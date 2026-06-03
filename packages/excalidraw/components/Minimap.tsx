import React, { useCallback, useMemo, useRef } from "react";

import clsx from "clsx";

import { getVisibleSceneBounds } from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { t } from "../i18n";
import { centerScrollOn } from "../scene/scroll";

import { Island } from "./Island";
import {
  computeElementMinimapRects,
  computeMinimapWorldBounds,
  isSceneLargerThanViewport,
  paddedWorldBounds,
  scenePointFromMinimapClient,
} from "./MinimapGeometry";

import "./Minimap.scss";

import type { AppState } from "../types";

export const MINIMAP_FIXED_WIDTH_PX = 160;
export const MINIMAP_FIXED_HEIGHT_PX = 100;

type MinimapAppStateSubset = Pick<
  AppState,
  | "scrollX"
  | "scrollY"
  | "width"
  | "height"
  | "zoom"
  | "minimapEnabled"
  | "viewModeEnabled"
  | "zenModeEnabled"
>;

export type MinimapProps = {
  elements: readonly NonDeletedExcalidrawElement[];
  elementsMap: NonDeletedSceneElementsMap;
  appState: MinimapAppStateSubset;
  setAppState: React.Component<any, AppState>["setState"];
};

const Minimap = ({
  elements,
  elementsMap,
  appState,
  setAppState,
}: MinimapProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingScenePointRef = useRef<{ x: number; y: number } | null>(null);

  const worldBounds = useMemo(
    () => computeMinimapWorldBounds(elements, elementsMap, appState),
    [elements, elementsMap, appState],
  );

  const elementRects = useMemo(
    () => computeElementMinimapRects(elements, elementsMap),
    [elements, elementsMap],
  );

  const padded = useMemo(() => paddedWorldBounds(worldBounds), [worldBounds]);
  const [bx1, by1, bx2, by2] = padded;
  const vbW = Math.max(bx2 - bx1, 1e-12);
  const vbH = Math.max(by2 - by1, 1e-12);

  const [vx1, vy1, vx2, vy2] = getVisibleSceneBounds(appState as AppState);
  const vw = vx2 - vx1;
  const vh = vy2 - vy1;

  const flushPan = useCallback(() => {
    rafRef.current = null;
    const scenePoint = pendingScenePointRef.current;
    if (!scenePoint) {
      return;
    }
    const { scrollX, scrollY } = centerScrollOn({
      scenePoint,
      viewportDimensions: { width: appState.width, height: appState.height },
      zoom: appState.zoom,
    });
    setAppState({ scrollX, scrollY });
  }, [appState.height, appState.width, appState.zoom, setAppState]);

  const schedulePan = useCallback(
    (scenePoint: { x: number; y: number }) => {
      pendingScenePointRef.current = scenePoint;
      if (rafRef.current != null) {
        return;
      }
      rafRef.current = requestAnimationFrame(flushPan);
    },
    [flushPan],
  );

  const panToClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) {
        return;
      }
      const scenePoint = scenePointFromMinimapClient(clientX, clientY, svg);
      if (!scenePoint) {
        return;
      }
      schedulePan(scenePoint);
    },
    [schedulePan],
  );

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    panToClientPoint(event.clientX, event.clientY);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) {
      return;
    }
    panToClientPoint(event.clientX, event.clientY);
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) {
      return;
    }
    isDraggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const label = t("labels.sceneMinimap");
  const hideLabel = t("labels.hideMinimap");
  const showLabel = t("labels.showMinimap");

  const toggleMinimap = () => {
    setAppState({ minimapEnabled: !appState.minimapEnabled });
  };

  if (
    appState.width <= 1 ||
    appState.height <= 1 ||
    appState.viewModeEnabled ||
    appState.zenModeEnabled ||
    elements.length === 0 ||
    !isSceneLargerThanViewport(elements, elementsMap, appState)
  ) {
    return null;
  }

  return (
    <div
      className={clsx("minimap-container", {
        "minimap-container--collapsed": !appState.minimapEnabled,
      })}
      data-testid="excalidraw-minimap-container"
    >
      <button
        type="button"
        className="minimap__toggle"
        data-testid="minimap-toggle"
        onClick={toggleMinimap}
        aria-expanded={appState.minimapEnabled}
        aria-label={appState.minimapEnabled ? hideLabel : showLabel}
      >
        {appState.minimapEnabled ? hideLabel : showLabel}
      </button>
      {appState.minimapEnabled && (
        <div data-testid="excalidraw-minimap" role="img" aria-label={label}>
          <Island padding={0} className="minimap">
            <svg
              ref={svgRef}
              className="minimap__svg"
              width={MINIMAP_FIXED_WIDTH_PX}
              height={MINIMAP_FIXED_HEIGHT_PX}
              viewBox={`${bx1} ${by1} ${vbW} ${vbH}`}
              preserveAspectRatio="xMidYMid meet"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <title>{label}</title>
              {elementRects.map(({ id, bounds, strokeColor }) => {
                const [x1, y1, x2, y2] = bounds;
                return (
                  <rect
                    key={id}
                    className="minimap__element"
                    x={x1}
                    y={y1}
                    width={Math.max(x2 - x1, 1e-6)}
                    height={Math.max(y2 - y1, 1e-6)}
                    fill={strokeColor}
                    fillOpacity={0.35}
                    stroke={strokeColor}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              <rect
                role="presentation"
                className="minimap__viewport"
                data-testid="minimap-viewport-indicator"
                x={vx1}
                y={vy1}
                width={Math.max(vw, 1e-6)}
                height={Math.max(vh, 1e-6)}
              />
            </svg>
          </Island>
        </div>
      )}
    </div>
  );
};

export default Minimap;
Minimap.displayName = "Minimap";
