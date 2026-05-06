import { getVisibleSceneBounds } from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import { Island } from "./Island";
import MinimapElementShapes from "./MinimapElementShapes";

import {
  computeMinimapWorldBounds,
  paddedWorldBounds,
} from "./MinimapGeometry";

import "./Minimap.scss";

import type { AppState } from "../types";

export const MINIMAP_FIXED_WIDTH_PX = 180;
export const MINIMAP_FIXED_HEIGHT_PX = 120;

type MinimapAppStateSubset = Pick<
  AppState,
  "scrollX" | "scrollY" | "width" | "height" | "zoom" | "selectedElementIds"
>;

export type MinimapProps = {
  elements: readonly NonDeletedExcalidrawElement[];
  elementsMap: NonDeletedSceneElementsMap;
  appState: MinimapAppStateSubset;
};

const Minimap = ({ elements, elementsMap, appState }: MinimapProps) => {
  if (appState.width <= 1 || appState.height <= 1) {
    return null;
  }

  const worldBounds = computeMinimapWorldBounds(
    elements,
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

  return (
    <div data-testid="excalidraw-minimap" role="img" aria-label={label}>
      <Island padding={0} className="minimap">
        <svg
          className="minimap__svg"
          width={MINIMAP_FIXED_WIDTH_PX}
          height={MINIMAP_FIXED_HEIGHT_PX}
          viewBox={`${bx1} ${by1} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <title>{label}</title>
          {elements.map((element) => (
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
