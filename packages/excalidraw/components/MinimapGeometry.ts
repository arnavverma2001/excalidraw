import {
  getCommonBounds,
  getElementBounds,
  getVisibleSceneBounds,
} from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import type { AppState } from "../types";

/** [minX, minY, maxX, maxY] in scene coordinates */
export type Bounds = readonly [number, number, number, number];

export const unionBounds = (a: Bounds, b: Bounds): Bounds => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
];

/**
 * World bounds used for the minimap: union of viewport (in scene space) and
 * elements' common bounds. Missing or flat elements fall back to viewport.
 */
export function computeMinimapWorldBounds(
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  appState: Pick<AppState, "scrollX" | "scrollY" | "width" | "height" | "zoom">,
): Bounds {
  const viewport = getVisibleSceneBounds(
    appState as AppState,
  ) as unknown as Bounds;

  if (elements.length === 0) {
    return viewport;
  }

  const scene = getCommonBounds(elements, elementsMap) as Bounds;
  const hasExtent = scene[2] > scene[0] || scene[3] > scene[1];

  if (!hasExtent) {
    return viewport;
  }

  return unionBounds(viewport, scene);
}

export function paddedWorldBounds(
  bounds: Bounds,
  padRatio: number = 0.04,
): Bounds {
  const [x1, y1, x2, y2] = bounds;
  const w = Math.max(x2 - x1, 1e-12);
  const h = Math.max(y2 - y1, 1e-12);
  const pad = padRatio * Math.max(w, h);
  return [x1 - pad, y1 - pad, x2 + pad, y2 + pad] as const;
}

export function computeElementMinimapRects(
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
): Array<{ id: string; bounds: Bounds; strokeColor: string }> {
  const rects: Array<{ id: string; bounds: Bounds; strokeColor: string }> = [];
  for (const element of elements) {
    const bounds = getElementBounds(element, elementsMap) as Bounds;
    rects.push({
      id: element.id,
      bounds,
      strokeColor: element.strokeColor,
    });
  }
  return rects;
}

/** True when any part of the scene extends beyond the visible viewport. */
export function isSceneLargerThanViewport(
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  appState: Pick<AppState, "scrollX" | "scrollY" | "width" | "height" | "zoom">,
): boolean {
  if (elements.length === 0) {
    return false;
  }

  const [vx1, vy1, vx2, vy2] = getVisibleSceneBounds(appState as AppState);
  const [sx1, sy1, sx2, sy2] = getCommonBounds(elements, elementsMap);

  return sx1 < vx1 - 1 || sy1 < vy1 - 1 || sx2 > vx2 + 1 || sy2 > vy2 + 1;
}

export function scenePointFromMinimapClient(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
): { x: number; y: number } | null {
  if (typeof svg.getScreenCTM !== "function") {
    return null;
  }
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return null;
  }
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const scenePt = pt.matrixTransform(ctm.inverse());
  return { x: scenePt.x, y: scenePt.y };
}
