import { getCommonBounds } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { AppState, NormalizedZoomValue, Zoom } from "../../types";

export const MINIMAP_WIDTH = 160;
export const MINIMAP_HEIGHT = 120;
export const MINIMAP_PADDING = 16;
export const EMPTY_SCENE_HALF_SIZE = 200;

export type MinimapTransform = {
  scrollX: number;
  scrollY: number;
  zoom: Zoom;
  width: number;
  height: number;
  sceneBounds: SceneBounds;
};

export type SceneBounds = [number, number, number, number];

export type MinimapRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const getMinimapSceneBounds = (
  elements: readonly NonDeletedExcalidrawElement[],
  padding: number = MINIMAP_PADDING,
): SceneBounds => {
  if (!elements.length) {
    return [
      -EMPTY_SCENE_HALF_SIZE - padding,
      -EMPTY_SCENE_HALF_SIZE - padding,
      EMPTY_SCENE_HALF_SIZE + padding,
      EMPTY_SCENE_HALF_SIZE + padding,
    ];
  }

  const [minX, minY, maxX, maxY] = getCommonBounds(elements);

  return [minX - padding, minY - padding, maxX + padding, maxY + padding];
};

export const computeMinimapTransform = (
  sceneBounds: SceneBounds,
  width: number = MINIMAP_WIDTH,
  height: number = MINIMAP_HEIGHT,
): MinimapTransform => {
  const [minX, minY, maxX, maxY] = sceneBounds;
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  const zoomValue = Math.min(width / contentWidth, height / contentHeight);
  const visibleSceneWidth = width / zoomValue;
  const visibleSceneHeight = height / zoomValue;

  const scrollX = -(minX - (visibleSceneWidth - contentWidth) / 2);
  const scrollY = -(minY - (visibleSceneHeight - contentHeight) / 2);

  return {
    scrollX,
    scrollY,
    zoom: { value: zoomValue as Zoom["value"] },
    width,
    height,
    sceneBounds,
  };
};

export const sceneToMinimapCoords = (
  sceneX: number,
  sceneY: number,
  transform: MinimapTransform,
): { x: number; y: number } => ({
  x: (sceneX + transform.scrollX) * transform.zoom.value,
  y: (sceneY + transform.scrollY) * transform.zoom.value,
});

export const minimapToSceneCoords = (
  minimapX: number,
  minimapY: number,
  transform: MinimapTransform,
): { x: number; y: number } => ({
  x: minimapX / transform.zoom.value - transform.scrollX,
  y: minimapY / transform.zoom.value - transform.scrollY,
});

export const getViewportRectInMinimap = (
  transform: MinimapTransform,
  viewportBounds: SceneBounds,
): MinimapRect => {
  const [vx1, vy1, vx2, vy2] = viewportBounds;
  const topLeft = sceneToMinimapCoords(vx1, vy1, transform);
  const bottomRight = sceneToMinimapCoords(vx2, vy2, transform);

  return {
    left: topLeft.x,
    top: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
};

export const getMainViewportBounds = ({
  scrollX,
  scrollY,
  width,
  height,
  zoom,
}: Pick<AppState, "scrollX" | "scrollY" | "width" | "height" | "zoom">): SceneBounds => [
  -scrollX,
  -scrollY,
  -scrollX + width / zoom.value,
  -scrollY + height / zoom.value,
];
