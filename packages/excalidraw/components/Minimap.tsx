import { useRef, type Component } from "react";

import { getVisibleElements, getVisibleSceneBounds } from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import { Island } from "./Island";
import MinimapElementShapes from "./MinimapElementShapes";

import {
  computeMinimapWorldBounds,
  isMinimapNeeded,
  minimapClientPointToScenePoint,
  paddedWorldBounds,
  scenePointToCenteredScroll,
} from "./MinimapGeometry";

import "./Minimap.scss";

import type { AppState } from "../types";

export const MINIMAP_FIXED_WIDTH_PX = 180;
export const MINIMAP_FIXED_HEIGHT_PX = 120;

type MinimapAppStateSubset = Pick<
  AppState,
  | "scrollX"
  | "scrollY"
  | "width"
  | "height"
  | "zoom"
  | "selectedElementIds"
  | "minimap"
>;

export type MinimapProps = {
  elements: readonly NonDeletedExcalidrawElement[];
  elementsMap: NonDeletedSceneElementsMap;
  appState: MinimapAppStateSubset;
  setAppState: Component<any, AppState>["setState"];
};

const Minimap = ({
  elements,
  elementsMap,
  appState,
  setAppState,
}: MinimapProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activePointerId = useRef<number | null>(null);

  if (appState.width <= 1 || appState.height <= 1) {
    return null;
  }

  const visibleElements = getVisibleElements(elements);

  if (!isMinimapNeeded(visibleElements, elementsMap, appState)) {
    return null;
  }

  const worldBounds = computeMinimapWorldBounds(
    visibleElements,
    elementsMap,
    appState,
  );
  const padded = paddedWorldBounds(worldBounds);
  const [bx1, by1, bx2, by2] = padded;
  const vbW = Math.max(bx2 - bx1, 1e-12);
  const vbH = Math.max(by2 - by1, 1e-12);

  const minStrokeScene =
    Math.max(vbW / MINIMAP_FIXED_WIDTH_PX, vbH / MINIMAP_FIXED_HEIGHT_PX) * 1.2;

  const [vx1, vy1, vx2, vy2] = getVisibleSceneBounds(appState as AppState);
  const vw = vx2 - vx1;
  const vh = vy2 - vy1;

  const label = t("labels.sceneMinimap");
  const hideLabel = t("labels.hideSceneMinimap");
  const showLabel = t("labels.showSceneMinimap");

  const panToClientPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    const scenePoint = minimapClientPointToScenePoint(
      { x: clientX, y: clientY },
      svg.getBoundingClientRect(),
      padded,
    );

    setAppState(scenePointToCenteredScroll(scenePoint, appState));
  };

  if (!appState.minimap.open) {
    return (
      <button
        type="button"
        className="minimap-toggle minimap-toggle--collapsed"
        data-testid="minimap-show"
        aria-label={showLabel}
        title={showLabel}
        onClick={() => {
          setAppState((state) => ({
            minimap: { ...state.minimap, open: true },
          }));
        }}
      >
        {t("labels.sceneMinimap")}
      </button>
    );
  }

  return (
    <div
      className="minimap-container"
      data-testid="excalidraw-minimap"
      aria-label={label}
    >
      <button
        type="button"
        className="minimap-toggle minimap-toggle--expanded"
        data-testid="minimap-hide"
        aria-label={hideLabel}
        title={hideLabel}
        onClick={() => {
          setAppState((state) => ({
            minimap: { ...state.minimap, open: false },
          }));
        }}
      >
        {hideLabel}
      </button>
      <Island padding={0} className="minimap">
        <svg
          ref={svgRef}
          role="img"
          aria-label={label}
          className="minimap__svg"
          width={MINIMAP_FIXED_WIDTH_PX}
          height={MINIMAP_FIXED_HEIGHT_PX}
          viewBox={`${bx1} ${by1} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={(event) => {
            activePointerId.current = event.pointerId;
            panToClientPoint(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (activePointerId.current !== event.pointerId) {
              return;
            }

            panToClientPoint(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            if (activePointerId.current !== event.pointerId) {
              return;
            }

            activePointerId.current = null;
          }}
          onPointerCancel={(event) => {
            if (activePointerId.current !== event.pointerId) {
              return;
            }

            activePointerId.current = null;
          }}
        >
          <title>{label}</title>
          {visibleElements.map((element) => (
            <MinimapElementShapes
              key={element.id}
              element={element}
              elementsMap={elementsMap}
              minStrokeScene={minStrokeScene}
              selected={appState.selectedElementIds[element.id] === true}
            />
          ))}
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
  );
};

export default Minimap;
Minimap.displayName = "Minimap";
