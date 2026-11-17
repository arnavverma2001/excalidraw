import {
  FRAME_STYLE,
  ROUNDNESS,
  THEME,
  getFontString,
  isTransparent,
} from "@excalidraw/common";

import { getCommonBounds } from "@excalidraw/element";

import {
  isArrowElement,
  isFrameLikeElement,
  isFreeDrawElement,
  isImageElement,
  isInitializedImageElement,
  isLinearElement,
  isLineElement,
  isMagicFrameElement,
  isTextElement,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  Theme,
} from "@excalidraw/element/types";

export const MINIMAP_WIDTH = 208;
export const MINIMAP_HEIGHT = 140;
export const MINIMAP_WIDTH_MOBILE = 144;
export const MINIMAP_HEIGHT_MOBILE = 96;
export const MINIMAP_PADDING = 12;

const MIN_STROKE = 0.75;
const MAX_LINEAR_POINTS = 800;

export type MinimapTransform = {
  sceneMinX: number;
  sceneMinY: number;
  sceneWidth: number;
  sceneHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type SceneRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const createMinimapTransform = (
  bounds: readonly [number, number, number, number],
  width: number,
  height: number,
  padding = MINIMAP_PADDING,
): MinimapTransform | null => {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const [minX, minY, maxX, maxY] = bounds;
  const sceneWidth = Math.max(maxX - minX, 1);
  const sceneHeight = Math.max(maxY - minY, 1);
  const inset = Math.min(padding, width / 4, height / 4);
  const availableWidth = Math.max(width - inset * 2, 1);
  const availableHeight = Math.max(height - inset * 2, 1);
  const scale = Math.min(
    availableWidth / sceneWidth,
    availableHeight / sceneHeight,
  );
  const drawnWidth = sceneWidth * scale;
  const drawnHeight = sceneHeight * scale;

  return {
    sceneMinX: minX,
    sceneMinY: minY,
    sceneWidth,
    sceneHeight,
    scale,
    offsetX: inset + (availableWidth - drawnWidth) / 2,
    offsetY: inset + (availableHeight - drawnHeight) / 2,
    width,
    height,
  };
};

export const scenePointToMinimap = (
  sceneX: number,
  sceneY: number,
  transform: MinimapTransform,
): { x: number; y: number } => {
  return {
    x: transform.offsetX + (sceneX - transform.sceneMinX) * transform.scale,
    y: transform.offsetY + (sceneY - transform.sceneMinY) * transform.scale,
  };
};

export const minimapPointToScene = (
  minimapX: number,
  minimapY: number,
  transform: MinimapTransform,
): { x: number; y: number } => {
  return {
    x: transform.sceneMinX + (minimapX - transform.offsetX) / transform.scale,
    y: transform.sceneMinY + (minimapY - transform.offsetY) / transform.scale,
  };
};

export const scrollForSceneCenter = (
  sceneX: number,
  sceneY: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
): { scrollX: number; scrollY: number } => {
  const safeZoom = zoom || 1;
  return {
    scrollX: viewportWidth / 2 / safeZoom - sceneX,
    scrollY: viewportHeight / 2 / safeZoom - sceneY,
  };
};

export const getViewportSceneRect = ({
  scrollX,
  scrollY,
  width,
  height,
  zoom,
}: {
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
  zoom: number;
}): SceneRect => {
  const safeZoom = zoom || 1;
  return {
    x: -scrollX,
    y: -scrollY,
    width: width / safeZoom,
    height: height / safeZoom,
  };
};

const samplePoints = <T>(
  points: readonly T[],
  maxPoints: number,
): readonly T[] => {
  if (points.length <= maxPoints) {
    return points;
  }
  const step = Math.ceil(points.length / maxPoints);
  const sampled: T[] = [];
  for (let index = 0; index < points.length; index += step) {
    sampled.push(points[index]);
  }
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }
  return sampled;
};

const traceRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const corner = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  if (corner > 0 && typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, corner);
    return;
  }
  context.rect(x, y, width, height);
};

const applyStroke = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawElement,
  scale: number,
) => {
  const lineWidth = Math.max(MIN_STROKE, element.strokeWidth * scale);
  context.lineWidth = lineWidth;
  context.strokeStyle = element.strokeColor;
  context.lineJoin = "round";
  context.lineCap = "round";
  if (element.strokeStyle === "dashed") {
    context.setLineDash([
      Math.max(lineWidth * 2, 2),
      Math.max(lineWidth * 1.4, 1.5),
    ]);
  } else if (element.strokeStyle === "dotted") {
    context.setLineDash([lineWidth, Math.max(lineWidth * 1.6, 2)]);
  } else {
    context.setLineDash([]);
  }
};

const paintClosedShape = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawElement,
  scale: number,
) => {
  if (!isTransparent(element.backgroundColor)) {
    context.fillStyle = element.backgroundColor;
    context.fill();
  }
  if (!isTransparent(element.strokeColor) && element.strokeWidth > 0) {
    applyStroke(context, element, scale);
    context.stroke();
  }
};

const withElementSpace = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawElement,
  transform: MinimapTransform,
  draw: (width: number, height: number) => void,
) => {
  const width = Math.max(element.width * transform.scale, 0);
  const height = Math.max(element.height * transform.scale, 0);
  const center = scenePointToMinimap(
    element.x + element.width / 2,
    element.y + element.height / 2,
    transform,
  );
  context.save();
  context.translate(center.x, center.y);
  context.rotate(element.angle);
  context.globalAlpha = element.opacity / 100;
  draw(width, height);
  context.restore();
};

const drawFrame = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawElement,
  width: number,
  height: number,
  scale: number,
  theme: Theme,
) => {
  const radius = Math.min(FRAME_STYLE.radius * scale, width / 2, height / 2);
  traceRoundedRect(context, -width / 2, -height / 2, width, height, radius);
  context.fillStyle =
    theme === THEME.DARK ? "rgba(255,255,255,0.04)" : "rgba(0,0,200,0.04)";
  context.fill();
  context.lineWidth = Math.max(MIN_STROKE, FRAME_STYLE.strokeWidth * scale);
  context.strokeStyle = isMagicFrameElement(element)
    ? theme === THEME.DARK
      ? "#1d8264"
      : "#7affd7"
    : theme === THEME.DARK
    ? "#5c5c5c"
    : FRAME_STYLE.strokeColor;
  context.setLineDash([]);
  context.stroke();

  if (isFrameLikeElement(element) && element.name && height > 8 && width > 12) {
    const fontSize = Math.max(7, Math.min(12, 14 * scale));
    context.fillStyle =
      theme === THEME.DARK
        ? FRAME_STYLE.nameColorDarkTheme
        : FRAME_STYLE.nameColorLightTheme;
    context.font = `${fontSize}px sans-serif`;
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillText(
      element.name,
      -width / 2 + 2,
      -height / 2 + 2,
      Math.max(width - 4, 0),
    );
  }
};

const drawText = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawTextElement,
  width: number,
  height: number,
  scale: number,
) => {
  if (!element.text || isTransparent(element.strokeColor)) {
    return;
  }
  const fontSize = element.fontSize * scale;
  if (width < 0.5 || height < 0.5) {
    return;
  }
  if (fontSize < 2.4) {
    context.fillStyle = element.strokeColor;
    context.fillRect(-width / 2, -height / 2, width, Math.max(height, 1));
    return;
  }

  context.beginPath();
  context.rect(-width / 2, -height / 2, width, height);
  context.clip();
  context.fillStyle = element.strokeColor;
  context.font = getFontString({
    fontSize,
    fontFamily: element.fontFamily,
  });
  context.textBaseline = "top";
  const lines = element.text.split("\n");
  const lineHeight = fontSize * element.lineHeight;
  const blockHeight = lines.length * lineHeight;
  let top = -height / 2;
  if (element.verticalAlign === "middle") {
    top = -blockHeight / 2;
  } else if (element.verticalAlign === "bottom") {
    top = height / 2 - blockHeight;
  }
  let alignX = -width / 2;
  context.textAlign = "left";
  if (element.textAlign === "center") {
    alignX = 0;
    context.textAlign = "center";
  } else if (element.textAlign === "right") {
    alignX = width / 2;
    context.textAlign = "right";
  }
  lines.forEach((line, index) => {
    context.fillText(line, alignX, top + index * lineHeight);
  });
};

const localPoint = (
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
  point: readonly [number, number],
  scale: number,
) => {
  return {
    x: (element.x + point[0] - (element.x + element.width / 2)) * scale,
    y: (element.y + point[1] - (element.y + element.height / 2)) * scale,
  };
};

const drawArrowhead = (
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number,
) => {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  context.beginPath();
  context.moveTo(toX, toY);
  context.lineTo(
    toX - size * Math.cos(angle - Math.PI / 7),
    toY - size * Math.sin(angle - Math.PI / 7),
  );
  context.lineTo(
    toX - size * Math.cos(angle + Math.PI / 7),
    toY - size * Math.sin(angle + Math.PI / 7),
  );
  context.closePath();
  context.fill();
};

const drawLinearElement = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
  scale: number,
) => {
  const points = samplePoints(element.points, MAX_LINEAR_POINTS);
  if (!points.length) {
    return;
  }
  const coords = points.map((point) => localPoint(element, point, scale));
  context.beginPath();
  context.moveTo(coords[0].x, coords[0].y);
  for (let index = 1; index < coords.length; index++) {
    context.lineTo(coords[index].x, coords[index].y);
  }
  if (coords.length === 1) {
    context.arc(
      coords[0].x,
      coords[0].y,
      Math.max(MIN_STROKE, scale),
      0,
      Math.PI * 2,
    );
  }

  const closed = isLineElement(element) && element.polygon;
  if (closed) {
    context.closePath();
    paintClosedShape(context, element, scale);
    return;
  }

  if (!isTransparent(element.strokeColor) && element.strokeWidth > 0) {
    applyStroke(context, element, scale);
    context.stroke();
  }

  if (!isArrowElement(element)) {
    return;
  }
  const head = Math.max(3.5, element.strokeWidth * scale * 2.4);
  context.fillStyle = element.strokeColor;
  if (element.endArrowhead && coords.length > 1) {
    const previous = coords[coords.length - 2];
    const end = coords[coords.length - 1];
    drawArrowhead(context, previous.x, previous.y, end.x, end.y, head);
  }
  if (element.startArrowhead && coords.length > 1) {
    const next = coords[1];
    const start = coords[0];
    drawArrowhead(context, next.x, next.y, start.x, start.y, head);
  }
};

const drawImage = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawImageElement,
  width: number,
  height: number,
  image: HTMLImageElement | null,
) => {
  const flipX = element.scale[0] < 0 ? -1 : 1;
  const flipY = element.scale[1] < 0 ? -1 : 1;
  context.save();
  context.scale(flipX, flipY);
  if (image) {
    const crop = element.crop;
    if (crop && crop.width > 0 && crop.height > 0 && image.naturalWidth > 0) {
      context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        -width / 2,
        -height / 2,
        width,
        height,
      );
    } else {
      context.drawImage(image, -width / 2, -height / 2, width, height);
    }
  } else {
    context.fillStyle = "#d0d5dd";
    context.fillRect(-width / 2, -height / 2, width, height);
    context.strokeStyle = "#98a2b3";
    context.lineWidth = 1;
    context.strokeRect(-width / 2, -height / 2, width, height);
  }
  context.restore();
};

const drawElement = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawElement,
  transform: MinimapTransform,
  theme: Theme,
  getImage: (element: ExcalidrawImageElement) => HTMLImageElement | null,
) => {
  if (
    element.isDeleted ||
    element.opacity <= 0 ||
    element.type === "selection"
  ) {
    return;
  }

  try {
    withElementSpace(context, element, transform, (width, height) => {
      if (isFrameLikeElement(element)) {
        drawFrame(context, element, width, height, transform.scale, theme);
        return;
      }
      if (isTextElement(element)) {
        drawText(context, element, width, height, transform.scale);
        return;
      }
      if (isImageElement(element)) {
        drawImage(
          context,
          element,
          width,
          height,
          isInitializedImageElement(element) ? getImage(element) : null,
        );
        return;
      }
      if (isLinearElement(element) || isFreeDrawElement(element)) {
        drawLinearElement(context, element, transform.scale);
        return;
      }
      if (element.type === "diamond") {
        context.beginPath();
        context.moveTo(0, -height / 2);
        context.lineTo(width / 2, 0);
        context.lineTo(0, height / 2);
        context.lineTo(-width / 2, 0);
        context.closePath();
        paintClosedShape(context, element, transform.scale);
        return;
      }
      if (element.type === "ellipse") {
        context.beginPath();
        context.ellipse(
          0,
          0,
          Math.max(width / 2, 0.5),
          Math.max(height / 2, 0.5),
          0,
          0,
          Math.PI * 2,
        );
        paintClosedShape(context, element, transform.scale);
        return;
      }

      const radius = element.roundness
        ? Math.min(width, height) *
          (element.roundness.type === ROUNDNESS.ADAPTIVE_RADIUS ? 0.12 : 0.2)
        : 0;
      traceRoundedRect(
        context,
        -width / 2,
        -height / 2,
        Math.max(width, 0.5),
        Math.max(height, 0.5),
        radius,
      );
      paintClosedShape(context, element, transform.scale);
    });
  } catch (error) {
    console.error(error);
  }
};

export const renderMinimapContent = ({
  context,
  elements,
  width,
  height,
  backgroundColor,
  theme,
  getImage,
}: {
  context: CanvasRenderingContext2D;
  elements: readonly ExcalidrawElement[];
  width: number;
  height: number;
  backgroundColor: string;
  theme: Theme;
  getImage: (element: ExcalidrawImageElement) => HTMLImageElement | null;
}): MinimapTransform | null => {
  context.clearRect(0, 0, width, height);
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, width, height);

  if (!elements.length) {
    return null;
  }

  const transform = createMinimapTransform(
    getCommonBounds(elements),
    width,
    height,
  );
  if (!transform) {
    return null;
  }

  for (const element of elements) {
    drawElement(context, element, transform, theme, getImage);
  }
  return transform;
};

const viewportContainsScene = (
  viewport: SceneRect,
  transform: MinimapTransform,
) => {
  return (
    viewport.x <= transform.sceneMinX &&
    viewport.y <= transform.sceneMinY &&
    viewport.x + viewport.width >= transform.sceneMinX + transform.sceneWidth &&
    viewport.y + viewport.height >= transform.sceneMinY + transform.sceneHeight
  );
};

export const renderMinimapViewport = (
  context: CanvasRenderingContext2D,
  transform: MinimapTransform,
  viewport: SceneRect,
) => {
  context.save();
  context.fillStyle = "rgba(105, 101, 219, 0.16)";
  context.lineJoin = "round";

  if (viewportContainsScene(viewport, transform)) {
    context.fillRect(0, 0, transform.width, transform.height);
    context.lineWidth = 3;
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.strokeRect(1.5, 1.5, transform.width - 3, transform.height - 3);
    context.lineWidth = 1.5;
    context.strokeStyle = "#6965db";
    context.strokeRect(1.5, 1.5, transform.width - 3, transform.height - 3);
    context.restore();
    return;
  }

  const origin = scenePointToMinimap(viewport.x, viewport.y, transform);
  let x = origin.x;
  let y = origin.y;
  let width = Math.max(viewport.width * transform.scale, 0);
  let height = Math.max(viewport.height * transform.scale, 0);
  const minimum = 8;
  if (width < minimum) {
    x -= (minimum - width) / 2;
    width = minimum;
  }
  if (height < minimum) {
    y -= (minimum - height) / 2;
    height = minimum;
  }

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const inside =
    centerX >= 0 &&
    centerY >= 0 &&
    centerX <= transform.width &&
    centerY <= transform.height;

  context.beginPath();
  context.rect(0, 0, transform.width, transform.height);
  context.clip();
  context.fillRect(x, y, width, height);
  context.lineWidth = 3;
  context.strokeStyle = "rgba(255,255,255,0.95)";
  context.strokeRect(x, y, width, height);
  context.lineWidth = 1.5;
  context.strokeStyle = "#6965db";
  context.strokeRect(x, y, width, height);

  if (!inside) {
    const markerX = Math.min(Math.max(centerX, 8), transform.width - 8);
    const markerY = Math.min(Math.max(centerY, 8), transform.height - 8);
    context.beginPath();
    context.arc(markerX, markerY, 4, 0, Math.PI * 2);
    context.fillStyle = "#6965db";
    context.fill();
  }
  context.restore();
};
