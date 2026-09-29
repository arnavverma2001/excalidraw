import type { Bounds } from "@excalidraw/common";
import type { SceneBounds } from "@excalidraw/element";

export const MINIMAP_WIDTH = 160;
export const MINIMAP_HEIGHT = 120;
export const MINIMAP_PADDING = 0.08;

export type MinimapSceneBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

/** Union of element bounds and viewport, with a small padding. */
export const getMinimapSceneBounds = (
  elementsBounds: Bounds | null,
  viewportBounds: SceneBounds,
): MinimapSceneBounds => {
  const [vpMinX, vpMinY, vpMaxX, vpMaxY] = viewportBounds;

  let minX = vpMinX;
  let minY = vpMinY;
  let maxX = vpMaxX;
  let maxY = vpMaxY;

  if (elementsBounds) {
    minX = Math.min(minX, elementsBounds[0]);
    minY = Math.min(minY, elementsBounds[1]);
    maxX = Math.max(maxX, elementsBounds[2]);
    maxY = Math.max(maxY, elementsBounds[3]);
  }

  let width = maxX - minX;
  let height = maxY - minY;

  // Avoid zero-size scenes (empty canvas).
  if (width <= 0) {
    width = 1;
    minX -= 0.5;
    maxX = minX + width;
  }
  if (height <= 0) {
    height = 1;
    minY -= 0.5;
    maxY = minY + height;
  }

  const padX = width * MINIMAP_PADDING;
  const padY = height * MINIMAP_PADDING;

  return {
    minX: minX - padX,
    minY: minY - padY,
    maxX: maxX + padX,
    maxY: maxY + padY,
    width: width + padX * 2,
    height: height + padY * 2,
  };
};

/** Fit scene into minimap while preserving aspect ratio (letterboxed). */
export const getMinimapTransform = (
  scene: MinimapSceneBounds,
  minimapWidth = MINIMAP_WIDTH,
  minimapHeight = MINIMAP_HEIGHT,
) => {
  const scale = Math.min(
    minimapWidth / scene.width,
    minimapHeight / scene.height,
  );
  const offsetX = (minimapWidth - scene.width * scale) / 2;
  const offsetY = (minimapHeight - scene.height * scale) / 2;

  return { scale, offsetX, offsetY, minimapWidth, minimapHeight };
};

export const sceneToMinimap = (
  sceneX: number,
  sceneY: number,
  scene: MinimapSceneBounds,
  transform: ReturnType<typeof getMinimapTransform>,
) => ({
  x: transform.offsetX + (sceneX - scene.minX) * transform.scale,
  y: transform.offsetY + (sceneY - scene.minY) * transform.scale,
});

export const minimapToScene = (
  minimapX: number,
  minimapY: number,
  scene: MinimapSceneBounds,
  transform: ReturnType<typeof getMinimapTransform>,
) => ({
  x: scene.minX + (minimapX - transform.offsetX) / transform.scale,
  y: scene.minY + (minimapY - transform.offsetY) / transform.scale,
});

export const getViewportRectInMinimap = (
  viewportBounds: SceneBounds,
  scene: MinimapSceneBounds,
  transform: ReturnType<typeof getMinimapTransform>,
) => {
  const [vpMinX, vpMinY, vpMaxX, vpMaxY] = viewportBounds;
  const topLeft = sceneToMinimap(vpMinX, vpMinY, scene, transform);
  const bottomRight = sceneToMinimap(vpMaxX, vpMaxY, scene, transform);

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(2, bottomRight.x - topLeft.x),
    height: Math.max(2, bottomRight.y - topLeft.y),
  };
};

/** True when element bounds extend outside the current viewport. */
export const hasContentOutsideViewport = (
  elementsBounds: Bounds | null,
  viewportBounds: SceneBounds,
): boolean => {
  if (!elementsBounds) {
    return false;
  }
  const [eMinX, eMinY, eMaxX, eMaxY] = elementsBounds;
  const [vpMinX, vpMinY, vpMaxX, vpMaxY] = viewportBounds;
  return eMinX < vpMinX || eMinY < vpMinY || eMaxX > vpMaxX || eMaxY > vpMaxY;
};
