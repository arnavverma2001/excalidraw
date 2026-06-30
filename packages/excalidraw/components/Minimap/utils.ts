import {
  getCommonBounds,
  getElementBounds,
  getVisibleElements,
  getVisibleSceneBounds,
  isFrameLikeElement,
} from "@excalidraw/element";

import type { Bounds } from "@excalidraw/common";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import type { AppState } from "../../types";

export const MINIMAP_WIDTH = 200;
export const MINIMAP_HEIGHT = 150;
export const MINIMAP_PADDING = 4;

export type MinimapTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type MinimapViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MinimapAppState = Pick<
  AppState,
  "scrollX" | "scrollY" | "width" | "height" | "zoom"
>;

export const getMinimapSceneBounds = (
  elements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
  appState: MinimapAppState,
): Bounds => {
  const elementBounds = getCommonBounds(elements, elementsMap);
  const [vx1, vy1, vx2, vy2] = getVisibleSceneBounds(appState as AppState);

  return [
    Math.min(elementBounds[0], vx1),
    Math.min(elementBounds[1], vy1),
    Math.max(elementBounds[2], vx2),
    Math.max(elementBounds[3], vy2),
  ];
};

export const getMinimapTransform = (
  bounds: Bounds,
  canvasWidth: number,
  canvasHeight: number,
  padding = MINIMAP_PADDING,
): MinimapTransform => {
  const [minX, minY, maxX, maxY] = bounds;
  const sceneWidth = maxX - minX || 1;
  const sceneHeight = maxY - minY || 1;
  const availableWidth = canvasWidth - padding * 2;
  const availableHeight = canvasHeight - padding * 2;
  const scale = Math.min(
    availableWidth / sceneWidth,
    availableHeight / sceneHeight,
  );
  const offsetX =
    padding + (availableWidth - sceneWidth * scale) / 2 - minX * scale;
  const offsetY =
    padding + (availableHeight - sceneHeight * scale) / 2 - minY * scale;

  return { scale, offsetX, offsetY };
};

export const sceneToMinimapCoords = (
  x: number,
  y: number,
  transform: MinimapTransform,
) => ({
  x: x * transform.scale + transform.offsetX,
  y: y * transform.scale + transform.offsetY,
});

export const minimapToSceneCoords = (
  x: number,
  y: number,
  transform: MinimapTransform,
) => ({
  x: (x - transform.offsetX) / transform.scale,
  y: (y - transform.offsetY) / transform.scale,
});

export const getMinimapViewportRect = (
  appState: MinimapAppState,
  transform: MinimapTransform,
): MinimapViewportRect => {
  const [vx1, vy1, vx2, vy2] = getVisibleSceneBounds(appState as AppState);
  const topLeft = sceneToMinimapCoords(vx1, vy1, transform);
  const bottomRight = sceneToMinimapCoords(vx2, vy2, transform);

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
};

export const hasContentOutsideViewport = (
  elements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
  appState: MinimapAppState,
): boolean => {
  const visibleElements = getVisibleElements(elements);
  if (!visibleElements.length) {
    return false;
  }

  const [minX, minY, maxX, maxY] = getCommonBounds(
    visibleElements,
    elementsMap,
  );
  const [vx1, vy1, vx2, vy2] = getVisibleSceneBounds(appState as AppState);

  return minX < vx1 || minY < vy1 || maxX > vx2 || maxY > vy2;
};

export const drawMinimap = ({
  canvas,
  elements,
  elementsMap,
  appState,
  colors,
}: {
  canvas: HTMLCanvasElement;
  elements: readonly ExcalidrawElement[];
  elementsMap: ElementsMap;
  appState: MinimapAppState;
  colors: {
    elementFill: string;
    frameFill: string;
    viewportStroke: string;
    background: string;
  };
}) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = MINIMAP_WIDTH;
  const height = MINIMAP_HEIGHT;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  const visibleElements = getVisibleElements(elements);
  if (!visibleElements.length) {
    return;
  }

  const bounds = getMinimapSceneBounds(visibleElements, elementsMap, appState);
  const transform = getMinimapTransform(bounds, width, height);

  for (const element of visibleElements) {
    const [minX, minY, maxX, maxY] = getElementBounds(element, elementsMap);
    const topLeft = sceneToMinimapCoords(minX, minY, transform);
    const bottomRight = sceneToMinimapCoords(maxX, maxY, transform);

    ctx.fillStyle = isFrameLikeElement(element)
      ? colors.frameFill
      : colors.elementFill;
    ctx.fillRect(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y,
    );
  }

  const viewportRect = getMinimapViewportRect(appState, transform);
  ctx.strokeStyle = colors.viewportStroke;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    viewportRect.x,
    viewportRect.y,
    viewportRect.width,
    viewportRect.height,
  );
};

export const getMinimapColors = (container: HTMLElement) => {
  const styles = getComputedStyle(container);

  return {
    elementFill:
      styles.getPropertyValue("--color-on-surface").trim() || "#1b1b1f",
    frameFill: styles.getPropertyValue("--color-primary").trim() || "#6965db",
    viewportStroke:
      styles.getPropertyValue("--color-accent").trim() ||
      styles.getPropertyValue("--color-primary").trim() ||
      "#6965db",
    background:
      styles.getPropertyValue("--island-bg-color").trim() || "#ffffff",
  };
};

export const getMinimapTransformForScene = (
  elements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
  appState: MinimapAppState,
) => {
  const visibleElements = getVisibleElements(elements);
  const bounds = getMinimapSceneBounds(visibleElements, elementsMap, appState);

  return getMinimapTransform(bounds, MINIMAP_WIDTH, MINIMAP_HEIGHT);
};
