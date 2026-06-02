import {
  getCommonBounds,
  getElementBounds,
  getVisibleElements,
  getVisibleSceneBounds,
} from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import type { AppState } from "../types";

/** [minX, minY, maxX, maxY] in scene coordinates */
export type Bounds = readonly [number, number, number, number];

const EPSILON = 1e-12;

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

  const visibleElements = getVisibleElements(elements);

  if (visibleElements.length === 0) {
    return viewport;
  }

  const scene = getCommonBounds(visibleElements, elementsMap) as Bounds;
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
  const w = Math.max(x2 - x1, EPSILON);
  const h = Math.max(y2 - y1, EPSILON);
  const pad = padRatio * Math.max(w, h);
  return [x1 - pad, y1 - pad, x2 + pad, y2 + pad] as const;
}

export function computeElementMinimapRects(
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
): Array<{ id: string; bounds: Bounds }> {
  const rects: Array<{ id: string; bounds: Bounds }> = [];
  for (const element of elements) {
    const b = getElementBounds(element, elementsMap) as Bounds;
    rects.push({ id: element.id, bounds: b });
  }
  return rects;
}

export function isMinimapNeeded(
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  appState: Pick<AppState, "scrollX" | "scrollY" | "width" | "height" | "zoom">,
) {
  const visibleElements = getVisibleElements(elements);

  if (visibleElements.length === 0) {
    return false;
  }

  const [viewportMinX, viewportMinY, viewportMaxX, viewportMaxY] =
    getVisibleSceneBounds(appState as AppState);
  const [sceneMinX, sceneMinY, sceneMaxX, sceneMaxY] = getCommonBounds(
    visibleElements,
    elementsMap,
  );

  return (
    sceneMinX < viewportMinX - EPSILON ||
    sceneMinY < viewportMinY - EPSILON ||
    sceneMaxX > viewportMaxX + EPSILON ||
    sceneMaxY > viewportMaxY + EPSILON
  );
}

export function scenePointToCenteredScroll(
  scenePoint: { x: number; y: number },
  appState: Pick<AppState, "width" | "height" | "zoom">,
): Pick<AppState, "scrollX" | "scrollY"> {
  return {
    scrollX: appState.width / 2 / appState.zoom.value - scenePoint.x,
    scrollY: appState.height / 2 / appState.zoom.value - scenePoint.y,
  };
}

export function minimapClientPointToScenePoint(
  clientPoint: { x: number; y: number },
  minimapRect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  viewBox: Bounds,
) {
  const [viewBoxMinX, viewBoxMinY, viewBoxMaxX, viewBoxMaxY] = viewBox;
  const viewBoxWidth = Math.max(viewBoxMaxX - viewBoxMinX, EPSILON);
  const viewBoxHeight = Math.max(viewBoxMaxY - viewBoxMinY, EPSILON);
  const rectWidth = Math.max(minimapRect.width, EPSILON);
  const rectHeight = Math.max(minimapRect.height, EPSILON);
  const scale = Math.min(rectWidth / viewBoxWidth, rectHeight / viewBoxHeight);
  const renderedWidth = viewBoxWidth * scale;
  const renderedHeight = viewBoxHeight * scale;
  const renderedLeft = minimapRect.left + (rectWidth - renderedWidth) / 2;
  const renderedTop = minimapRect.top + (rectHeight - renderedHeight) / 2;
  const clampedX = Math.min(
    Math.max(clientPoint.x - renderedLeft, 0),
    renderedWidth,
  );
  const clampedY = Math.min(
    Math.max(clientPoint.y - renderedTop, 0),
    renderedHeight,
  );

  return {
    x: viewBoxMinX + clampedX / scale,
    y: viewBoxMinY + clampedY / scale,
  };
}
