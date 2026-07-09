import { THEME } from "@excalidraw/common";

import {
  getCommonBounds,
  getElementBounds,
  getVisibleElements,
  isFrameLikeElement,
  isLinearElement,
} from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { AppState } from "../types";

export const MINIMAP_WIDTH = 160;
export const MINIMAP_HEIGHT = 120;
export const MINIMAP_PADDING = 4;

export type MinimapViewportState = Pick<
  AppState,
  "scrollX" | "scrollY" | "width" | "height" | "zoom"
>;

export type MinimapData = {
  sceneMinX: number;
  sceneMinY: number;
  sceneMaxX: number;
  sceneMaxY: number;
  scale: number;
  width: number;
  height: number;
  padding: number;
};

const getViewportSceneBounds = ({
  scrollX,
  scrollY,
  width,
  height,
  zoom,
}: MinimapViewportState): [number, number, number, number] => [
  -scrollX,
  -scrollY,
  -scrollX + width / zoom.value,
  -scrollY + height / zoom.value,
];

export const sceneToMinimapCoords = (
  sceneX: number,
  sceneY: number,
  data: MinimapData,
): { x: number; y: number } => ({
  x: data.padding + (sceneX - data.sceneMinX) * data.scale,
  y: data.padding + (sceneY - data.sceneMinY) * data.scale,
});

export const minimapToSceneCoords = (
  minimapX: number,
  minimapY: number,
  data: MinimapData,
): { x: number; y: number } => ({
  x: data.sceneMinX + (minimapX - data.padding) / data.scale,
  y: data.sceneMinY + (minimapY - data.padding) / data.scale,
});

export const getMinimapData = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: MinimapViewportState,
  minimapWidth: number = MINIMAP_WIDTH,
  minimapHeight: number = MINIMAP_HEIGHT,
): MinimapData | null => {
  const visibleElements = getVisibleElements(elements);
  if (!visibleElements.length) {
    return null;
  }

  const [elementsMinX, elementsMinY, elementsMaxX, elementsMaxY] =
    getCommonBounds(visibleElements);

  const [viewportMinX, viewportMinY, viewportMaxX, viewportMaxY] =
    getViewportSceneBounds(appState);

  const sceneMinX = Math.min(elementsMinX, viewportMinX);
  const sceneMinY = Math.min(elementsMinY, viewportMinY);
  const sceneMaxX = Math.max(elementsMaxX, viewportMaxX);
  const sceneMaxY = Math.max(elementsMaxY, viewportMaxY);

  const sceneWidth = sceneMaxX - sceneMinX || 1;
  const sceneHeight = sceneMaxY - sceneMinY || 1;

  const padding = MINIMAP_PADDING;
  const scale = Math.min(
    (minimapWidth - padding * 2) / sceneWidth,
    (minimapHeight - padding * 2) / sceneHeight,
  );

  return {
    sceneMinX,
    sceneMinY,
    sceneMaxX,
    sceneMaxY,
    scale,
    width: minimapWidth,
    height: minimapHeight,
    padding,
  };
};

export const hasElementsOutsideViewport = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: MinimapViewportState,
): boolean => {
  const visibleElements = getVisibleElements(elements);
  if (!visibleElements.length) {
    return false;
  }

  const [elementsMinX, elementsMinY, elementsMaxX, elementsMaxY] =
    getCommonBounds(visibleElements);
  const [viewportMinX, viewportMinY, viewportMaxX, viewportMaxY] =
    getViewportSceneBounds(appState);

  return (
    elementsMinX < viewportMinX ||
    elementsMinY < viewportMinY ||
    elementsMaxX > viewportMaxX ||
    elementsMaxY > viewportMaxY
  );
};

export const getMinimapViewportRect = (
  appState: MinimapViewportState,
  data: MinimapData,
): { x: number; y: number; width: number; height: number } => {
  const [viewportMinX, viewportMinY, viewportMaxX, viewportMaxY] =
    getViewportSceneBounds(appState);

  const topLeft = sceneToMinimapCoords(viewportMinX, viewportMinY, data);
  const bottomRight = sceneToMinimapCoords(viewportMaxX, viewportMaxY, data);

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
};

export const drawMinimapElements = (
  ctx: CanvasRenderingContext2D,
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  data: MinimapData,
  theme: AppState["theme"],
) => {
  const fillColor =
    theme === THEME.DARK ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.2)";
  const strokeColor =
    theme === THEME.DARK ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)";

  for (const element of elements) {
    if (element.isDeleted || element.opacity === 0) {
      continue;
    }

    const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
    const topLeft = sceneToMinimapCoords(x1, y1, data);
    const bottomRight = sceneToMinimapCoords(x2, y2, data);

    const w = bottomRight.x - topLeft.x;
    const h = bottomRight.y - topLeft.y;
    if (Math.abs(w) < 0.5 && Math.abs(h) < 0.5) {
      continue;
    }

    ctx.globalAlpha = Math.max((element.opacity ?? 100) / 100, 0.15);

    if (isLinearElement(element)) {
      const points = element.points;
      if (points.length >= 2) {
        ctx.beginPath();
        const first = sceneToMinimapCoords(
          element.x + points[0][0],
          element.y + points[0][1],
          data,
        );
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < points.length; i++) {
          const pt = sceneToMinimapCoords(
            element.x + points[i][0],
            element.y + points[i][1],
            data,
          );
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else if (element.type === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(
        topLeft.x + w / 2,
        topLeft.y + h / 2,
        Math.abs(w / 2),
        Math.abs(h / 2),
        0,
        0,
        2 * Math.PI,
      );
      ctx.fillStyle = fillColor;
      ctx.fill();
    } else if (element.type === "diamond") {
      ctx.beginPath();
      ctx.moveTo(topLeft.x + w / 2, topLeft.y);
      ctx.lineTo(topLeft.x + w, topLeft.y + h / 2);
      ctx.lineTo(topLeft.x + w / 2, topLeft.y + h);
      ctx.lineTo(topLeft.x, topLeft.y + h / 2);
      ctx.closePath();
      ctx.fillStyle = isFrameLikeElement(element) ? "transparent" : fillColor;
      ctx.fill();
      if (isFrameLikeElement(element)) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = isFrameLikeElement(element) ? "transparent" : fillColor;
      ctx.fillRect(topLeft.x, topLeft.y, w, h);
      if (isFrameLikeElement(element)) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(topLeft.x, topLeft.y, w, h);
      }
    }
  }

  ctx.globalAlpha = 1;
};

export const drawMinimapViewport = (
  ctx: CanvasRenderingContext2D,
  viewportRect: { x: number; y: number; width: number; height: number },
  theme: AppState["theme"],
) => {
  const strokeColor =
    theme === THEME.DARK ? "rgba(245, 78, 0, 0.9)" : "rgba(245, 78, 0, 0.85)";
  const fillColor =
    theme === THEME.DARK ? "rgba(245, 78, 0, 0.12)" : "rgba(245, 78, 0, 0.08)";

  ctx.fillStyle = fillColor;
  ctx.fillRect(
    viewportRect.x,
    viewportRect.y,
    viewportRect.width,
    viewportRect.height,
  );
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    viewportRect.x,
    viewportRect.y,
    viewportRect.width,
    viewportRect.height,
  );
};
