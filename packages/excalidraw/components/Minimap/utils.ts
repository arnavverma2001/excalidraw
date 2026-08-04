import type { Bounds } from "@excalidraw/common";

export const MINIMAP_WIDTH = 168;
export const MINIMAP_HEIGHT = 120;
export const MINIMAP_PADDING = 8;

export type MinimapTransform = {
  sceneMinX: number;
  sceneMinY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type MinimapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Union of element bounds and the current viewport in scene coordinates. */
export const getMinimapSceneBounds = (
  elementsBounds: Bounds,
  viewportBounds: Bounds,
): Bounds => {
  const hasElements =
    elementsBounds[0] !== elementsBounds[2] ||
    elementsBounds[1] !== elementsBounds[3];

  if (!hasElements) {
    return viewportBounds;
  }

  return [
    Math.min(elementsBounds[0], viewportBounds[0]),
    Math.min(elementsBounds[1], viewportBounds[1]),
    Math.max(elementsBounds[2], viewportBounds[2]),
    Math.max(elementsBounds[3], viewportBounds[3]),
  ];
};

export const getMinimapTransform = (
  sceneBounds: Bounds,
  minimapWidth: number = MINIMAP_WIDTH,
  minimapHeight: number = MINIMAP_HEIGHT,
  padding: number = MINIMAP_PADDING,
): MinimapTransform => {
  const sceneWidth = Math.max(sceneBounds[2] - sceneBounds[0], 1);
  const sceneHeight = Math.max(sceneBounds[3] - sceneBounds[1], 1);
  const availableWidth = Math.max(minimapWidth - padding * 2, 1);
  const availableHeight = Math.max(minimapHeight - padding * 2, 1);
  const scale = Math.min(
    availableWidth / sceneWidth,
    availableHeight / sceneHeight,
  );
  const drawnWidth = sceneWidth * scale;
  const drawnHeight = sceneHeight * scale;

  return {
    sceneMinX: sceneBounds[0],
    sceneMinY: sceneBounds[1],
    scale,
    offsetX: padding + (availableWidth - drawnWidth) / 2,
    offsetY: padding + (availableHeight - drawnHeight) / 2,
    width: minimapWidth,
    height: minimapHeight,
  };
};

export const sceneCoordsToMinimap = (
  sceneX: number,
  sceneY: number,
  transform: MinimapTransform,
): { x: number; y: number } => ({
  x: transform.offsetX + (sceneX - transform.sceneMinX) * transform.scale,
  y: transform.offsetY + (sceneY - transform.sceneMinY) * transform.scale,
});

export const minimapCoordsToScene = (
  minimapX: number,
  minimapY: number,
  transform: MinimapTransform,
): { x: number; y: number } => ({
  x: transform.sceneMinX + (minimapX - transform.offsetX) / transform.scale,
  y: transform.sceneMinY + (minimapY - transform.offsetY) / transform.scale,
});

export const getViewportRectOnMinimap = (
  viewportBounds: Bounds,
  transform: MinimapTransform,
): MinimapRect => {
  const topLeft = sceneCoordsToMinimap(
    viewportBounds[0],
    viewportBounds[1],
    transform,
  );
  const bottomRight = sceneCoordsToMinimap(
    viewportBounds[2],
    viewportBounds[3],
    transform,
  );

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(bottomRight.x - topLeft.x, 2),
    height: Math.max(bottomRight.y - topLeft.y, 2),
  };
};

/** True when any element bounds fall outside the current viewport. */
export const hasElementsOutsideViewport = (
  elementsBounds: Bounds,
  viewportBounds: Bounds,
): boolean => {
  const hasElements =
    elementsBounds[0] !== elementsBounds[2] ||
    elementsBounds[1] !== elementsBounds[3];

  if (!hasElements) {
    return false;
  }

  return (
    elementsBounds[0] < viewportBounds[0] ||
    elementsBounds[1] < viewportBounds[1] ||
    elementsBounds[2] > viewportBounds[2] ||
    elementsBounds[3] > viewportBounds[3]
  );
};
