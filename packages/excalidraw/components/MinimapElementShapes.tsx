import React from "react";

import clsx from "clsx";

import { FRAME_STYLE, isTransparent } from "@excalidraw/common";

import {
  elementCenterPoint,
  getDiamondPoints,
  getElementBounds,
  hasBackground,
  isFrameLikeElement,
  isFreeDrawElement,
  isIframeLikeElement,
  isImageElement,
  isLinearElement,
  isTextElement,
} from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

export type MinimapElementShapesProps = {
  element: NonDeletedExcalidrawElement;
  elementsMap: NonDeletedSceneElementsMap;
  selected: boolean;
  /** Minimal stroke width (scene coords) ~1 px on the minimap; keeps thin lines visible */
  minStrokeScene: number;
};

const clampStrokeScene = (
  strokeWidth: number | undefined | null,
  minStrokeScene: number,
) =>
  Math.max(
    strokeWidth ?? 2,
    minStrokeScene > 1e-18 ? minStrokeScene * 1.4 : minStrokeScene,
  );

const scenePointsPathD = (element: {
  x: number;
  y: number;
  points: readonly (readonly [number, number])[];
}): string | null => {
  if (!element.points.length) {
    return null;
  }
  let d = `M ${element.x + element.points[0][0]} ${
    element.y + element.points[0][1]
  }`;
  for (let i = 1; i < element.points.length; i++) {
    d += ` L ${element.x + element.points[i][0]} ${
      element.y + element.points[i][1]
    }`;
  }
  return d;
};

const dashArrayFromStrokeStyle = (
  strokeStyle: NonDeletedExcalidrawElement["strokeStyle"],
  strokeWidthScene: number,
): string | undefined => {
  const sw = Math.max(strokeWidthScene, 1e-6);
  switch (strokeStyle) {
    case "solid":
      return undefined;
    case "dashed":
      return `${sw * 4},${sw * 2}`;
    case "dotted":
      return `${sw * 0.15},${sw * 2.5}`;
    default:
      return undefined;
  }
};

function rectCornersRadiusPx(element: NonDeletedExcalidrawElement) {
  if (!element.roundness) {
    return 0;
  }
  const m = Math.min(element.width, element.height);
  return Math.min(Math.max(element.width, element.height) * 0.08, m * 0.35);
}

const MinimapElementShapes = ({
  element,
  elementsMap,
  selected,
  minStrokeScene,
}: MinimapElementShapesProps) => {
  const bounds = getElementBounds(element, elementsMap);
  const [bx1, by1, bx2, by2] = bounds;

  const [cx, cy] = elementCenterPoint(element, elementsMap);
  const angleDeg =
    typeof element.angle === "number" ? (element.angle * 180) / Math.PI : 0;
  const hasAngle =
    typeof element.angle === "number" && Math.abs(element.angle) > 1e-6;

  const opacity =
    typeof element.opacity === "number" ? element.opacity / 100 : 1;

  let inner: React.ReactNode = null;
  let useRotation = false;

  const stroke = element.strokeColor;
  const swBase = clampStrokeScene(element.strokeWidth, minStrokeScene);

  const fillFromBackground = (): string | undefined => {
    if (!hasBackground(element.type)) {
      return undefined;
    }
    if (isTransparent(element.backgroundColor)) {
      return undefined;
    }
    return element.backgroundColor;
  };

  const commonStrokeDash = dashArrayFromStrokeStyle(
    element.strokeStyle,
    swBase,
  );

  if (isLinearElement(element)) {
    const d = scenePointsPathD(element);
    inner =
      d == null ? null : (
        <path
          d={d}
          fill="none"
          opacity={opacity}
          stroke={stroke}
          strokeDasharray={commonStrokeDash}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={
            element.type === "arrow"
              ? Math.max(swBase, minStrokeScene * 2)
              : swBase
          }
        />
      );
    useRotation = hasAngle;
  } else if (isFreeDrawElement(element)) {
    const d = scenePointsPathD(element);
    inner =
      d == null ? null : (
        <path
          d={d}
          fill="none"
          opacity={opacity}
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={Math.max(swBase, minStrokeScene * 2)}
        />
      );
    useRotation = hasAngle;
  } else if (isImageElement(element)) {
    inner = (
      <rect
        fill="rgba(170,170,170,0.55)"
        height={Math.max(element.height, 1e-6)}
        opacity={opacity}
        stroke={stroke}
        strokeWidth={swBase}
        width={Math.max(element.width, 1e-6)}
        x={element.x}
        y={element.y}
      />
    );
    useRotation = hasAngle;
  } else if (isTextElement(element)) {
    const lineStrokeWidth = Math.max(swBase * 0.75, minStrokeScene * 1.4);
    const lineStartX = element.x + Math.max(element.width * 0.12, 1);
    const lineEndX = element.x + Math.max(element.width * 0.88, 1);
    const firstLineY = element.y + Math.max(element.height * 0.35, 1);
    const secondLineY = element.y + Math.max(element.height * 0.65, 1);
    inner = (
      <g opacity={opacity}>
        <rect
          fill={stroke}
          fillOpacity={0.07}
          height={Math.max(element.height, 1e-6)}
          rx={Math.min(rectCornersRadiusPx(element), 6)}
          stroke={stroke}
          strokeWidth={swBase * 0.85}
          width={Math.max(element.width, 1e-6)}
          x={element.x}
          y={element.y}
        />
        <line
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth={lineStrokeWidth}
          x1={lineStartX}
          x2={lineEndX}
          y1={firstLineY}
          y2={firstLineY}
        />
        <line
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth={lineStrokeWidth}
          x1={lineStartX}
          x2={element.x + Math.max(element.width * 0.62, 1)}
          y1={secondLineY}
          y2={secondLineY}
        />
      </g>
    );
    useRotation = hasAngle;
  } else if (isIframeLikeElement(element)) {
    inner = (
      <rect
        fill="rgba(148,148,148,0.14)"
        height={Math.max(element.height, 1e-6)}
        opacity={opacity}
        stroke={stroke}
        strokeDasharray={dashArrayFromStrokeStyle("dashed", swBase)}
        strokeWidth={swBase}
        width={Math.max(element.width, 1e-6)}
        x={element.x}
        y={element.y}
      />
    );
    useRotation = hasAngle;
  } else if (element.type === "rectangle" || element.type === "selection") {
    const rx = rectCornersRadiusPx(element);
    const fill = fillFromBackground();
    inner = (
      <rect
        fill={fill ?? "none"}
        height={Math.max(element.height, 1e-6)}
        opacity={opacity}
        rx={rx}
        stroke={stroke}
        strokeDasharray={commonStrokeDash}
        strokeWidth={swBase}
        width={Math.max(element.width, 1e-6)}
        x={element.x}
        y={element.y}
      />
    );
    useRotation = hasAngle;
  } else if (element.type === "ellipse") {
    const cxE = element.x + element.width / 2;
    const cyE = element.y + element.height / 2;
    const rx = Math.max(element.width / 2, 1e-6);
    const ry = Math.max(element.height / 2, 1e-6);
    const fill = fillFromBackground();
    inner = (
      <ellipse
        cx={cxE}
        cy={cyE}
        fill={fill ?? "none"}
        opacity={opacity}
        rx={rx}
        ry={ry}
        stroke={stroke}
        strokeDasharray={commonStrokeDash}
        strokeWidth={swBase}
      />
    );
    useRotation = hasAngle;
  } else if (element.type === "diamond") {
    const [topX, topY, rx, ry, bx, by, lx, ly] = getDiamondPoints(element);
    const pts = `${element.x + topX},${element.y + topY} ${element.x + rx},${
      element.y + ry
    } ${element.x + bx},${element.y + by} ${element.x + lx},${element.y + ly}`;
    const fill = fillFromBackground();
    inner = (
      <polygon
        fill={fill ?? "none"}
        opacity={opacity}
        points={pts}
        stroke={stroke}
        strokeDasharray={commonStrokeDash}
        strokeLinejoin="round"
        strokeWidth={swBase}
      />
    );
    useRotation = hasAngle;
  } else if (isFrameLikeElement(element)) {
    const r = FRAME_STYLE.radius;
    inner = (
      <rect
        fill="none"
        height={Math.max(element.height - 2, 1e-6)}
        opacity={opacity}
        rx={r}
        stroke={stroke}
        strokeWidth={Math.max(swBase, FRAME_STYLE.strokeWidth)}
        width={Math.max(element.width - 2, 1e-6)}
        x={element.x}
        y={element.y}
      />
    );
    useRotation = hasAngle;
  } else {
    const fill = fillFromBackground();
    const bw = bx2 - bx1;
    const bh = by2 - by1;
    inner = (
      <rect
        fill={fill ?? "none"}
        height={Math.max(bh, 1e-6)}
        opacity={opacity}
        rx={Math.min(rectCornersRadiusPx(element), bw / 4, bh / 4)}
        stroke={stroke}
        strokeWidth={swBase}
        width={Math.max(bw, 1e-6)}
        x={bx1}
        y={by1}
      />
    );
    useRotation = false;
  }

  if (!inner) {
    return null;
  }

  const rotate = useRotation
    ? `translate(${cx},${cy}) rotate(${angleDeg}) translate(${-cx},${-cy})`
    : undefined;

  const bw = Math.max(bx2 - bx1, 1e-6);
  const bh = Math.max(by2 - by1, 1e-6);

  return (
    <g className="minimap__element-root">
      {rotate ? <g transform={rotate}>{inner}</g> : inner}
      {selected && (
        <rect
          className={clsx("minimap__element", "minimap__element--selected")}
          fill="none"
          height={bh}
          vectorEffect="non-scaling-stroke"
          width={bw}
          x={bx1}
          y={by1}
        />
      )}
    </g>
  );
};

export default React.memo(MinimapElementShapes);
MinimapElementShapes.displayName = "MinimapElementShapes";
