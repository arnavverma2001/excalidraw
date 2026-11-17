import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { THEME, isTransparent } from "@excalidraw/common";

import {
  getVisibleElements,
  hashElementsVersion,
  isInitializedImageElement,
} from "@excalidraw/element";

import type { ExcalidrawImageElement, FileId } from "@excalidraw/element/types";

import { t } from "../../i18n";
import {
  useApp,
  useEditorInterface,
  useExcalidrawAppState,
  useExcalidrawElements,
  useExcalidrawSetAppState,
} from "../App";
import { Island } from "../Island";

import {
  MINIMAP_HEIGHT,
  MINIMAP_HEIGHT_MOBILE,
  MINIMAP_WIDTH,
  MINIMAP_WIDTH_MOBILE,
  getViewportSceneRect,
  minimapPointToScene,
  renderMinimapContent,
  renderMinimapViewport,
  scrollForSceneCenter,
} from "./minimapScene";

import "./Minimap.scss";

import type { MinimapTransform } from "./minimapScene";

const localImages = new Map<string, HTMLImageElement>();

const prepareCanvas = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number,
) => {
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
};

const resolveImage = (
  element: ExcalidrawImageElement,
  imageCache: Map<
    FileId,
    { image: HTMLImageElement | Promise<HTMLImageElement> }
  >,
  files: {
    [id: string]: { dataURL: string; version?: number; created: number };
  },
  onLoad: () => void,
) => {
  if (!isInitializedImageElement(element)) {
    return null;
  }
  const cached = imageCache.get(element.fileId);
  if (
    cached &&
    cached.image instanceof HTMLImageElement &&
    cached.image.complete &&
    cached.image.naturalWidth > 0
  ) {
    return cached.image;
  }

  const file = files[element.fileId];
  if (!file?.dataURL) {
    return null;
  }
  const key = `${element.fileId}:${file.version ?? file.created}:${
    file.dataURL.length
  }`;
  let image = localImages.get(key);
  if (!image) {
    image = new Image();
    image.onload = onLoad;
    image.src = file.dataURL;
    localImages.set(key, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
};

export const Minimap = () => {
  const elements = useExcalidrawElements();
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const app = useApp();
  const editorInterface = useEditorInterface();
  const isPhone = editorInterface.formFactor === "phone";
  const [imageTick, setImageTick] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const viewRef = useRef<HTMLCanvasElement>(null);
  const contentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useRef<MinimapTransform | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  const sceneElements = useMemo(() => {
    const visible = getVisibleElements(elements).filter(
      (element) => element.type !== "selection",
    );
    const pending = appState.newElement;
    if (
      pending &&
      !pending.isDeleted &&
      !visible.some((element) => element.id === pending.id)
    ) {
      return [...visible, pending];
    }
    return visible;
  }, [elements, appState.newElement]);

  const baseWidth = isPhone ? MINIMAP_WIDTH_MOBILE : MINIMAP_WIDTH;
  const baseHeight = isPhone ? MINIMAP_HEIGHT_MOBILE : MINIMAP_HEIGHT;
  const reserved = isPhone ? 150 : 120;
  const availableHeight =
    appState.height > 0 ? appState.height - reserved : baseHeight;
  const cssHeight = Math.round(
    Math.max(72, Math.min(baseHeight, availableHeight)),
  );
  const cssWidth = Math.round(cssHeight * (baseWidth / baseHeight));
  const dpr = Math.min(
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
    2,
  );

  const backgroundColor =
    !appState.viewBackgroundColor || isTransparent(appState.viewBackgroundColor)
      ? appState.theme === THEME.DARK
        ? "#121212"
        : "#ffffff"
      : appState.viewBackgroundColor;

  const elementsVersion = hashElementsVersion(sceneElements);
  const imageSignature = sceneElements
    .map((element) => {
      if (!isInitializedImageElement(element)) {
        return "";
      }
      const file = app.files[element.fileId];
      const cached = app.imageCache.get(element.fileId);
      const ready =
        cached &&
        cached.image instanceof HTMLImageElement &&
        cached.image.complete
          ? "1"
          : "0";
      return `${element.fileId}:${
        file?.version ?? file?.created ?? 0
      }:${ready}`;
    })
    .join("|");
  const contentSignature = [
    elementsVersion,
    sceneElements.length,
    imageSignature,
    appState.theme,
    backgroundColor,
    cssWidth,
    cssHeight,
    dpr,
    imageTick,
  ].join(":");

  const sceneElementsRef = useRef(sceneElements);
  sceneElementsRef.current = sceneElements;
  const backgroundRef = useRef(backgroundColor);
  backgroundRef.current = backgroundColor;

  useLayoutEffect(() => {
    if (!sceneElementsRef.current.length || cssWidth <= 0 || cssHeight <= 0) {
      transformRef.current = null;
      return;
    }
    if (!contentCanvasRef.current) {
      contentCanvasRef.current = document.createElement("canvas");
    }
    const context = prepareCanvas(
      contentCanvasRef.current,
      cssWidth,
      cssHeight,
      dpr,
    );
    if (!context) {
      return;
    }
    transformRef.current = renderMinimapContent({
      context,
      elements: sceneElementsRef.current,
      width: cssWidth,
      height: cssHeight,
      backgroundColor: backgroundRef.current,
      theme: appStateRef.current.theme,
      getImage: (element) =>
        resolveImage(element, app.imageCache, app.files, () => {
          setImageTick((tick) => tick + 1);
        }),
    });
    // The signature already covers every input the thumbnail depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentSignature]);

  useLayoutEffect(() => {
    const view = viewRef.current;
    const content = contentCanvasRef.current;
    const transform = transformRef.current;
    if (!view || !content || !transform) {
      return;
    }
    const context = prepareCanvas(view, cssWidth, cssHeight, dpr);
    if (!context) {
      return;
    }
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.drawImage(content, 0, 0, cssWidth, cssHeight);
    const state = appStateRef.current;
    renderMinimapViewport(
      context,
      transform,
      getViewportSceneRect({
        scrollX: state.scrollX,
        scrollY: state.scrollY,
        width: state.width,
        height: state.height,
        zoom: state.zoom.value,
      }),
    );
  }, [
    contentSignature,
    appState.scrollX,
    appState.scrollY,
    appState.zoom,
    appState.width,
    appState.height,
    cssWidth,
    cssHeight,
    dpr,
  ]);

  if (!sceneElements.length) {
    return null;
  }

  const label = t("buttons.minimap");

  const panTo = (clientX: number, clientY: number) => {
    const node = viewRef.current?.parentElement;
    const transform = transformRef.current;
    if (!node || !transform) {
      return;
    }
    const rect = node.getBoundingClientRect();
    const state = appStateRef.current;
    const scene = minimapPointToScene(
      ((clientX - rect.left) / Math.max(rect.width, 1)) * cssWidth,
      ((clientY - rect.top) / Math.max(rect.height, 1)) * cssHeight,
      transform,
    );
    const offset = dragOffsetRef.current ?? { x: 0, y: 0 };
    const nextScroll = scrollForSceneCenter(
      scene.x + offset.x,
      scene.y + offset.y,
      state.width,
      state.height,
      state.zoom.value,
    );
    setAppState({
      ...nextScroll,
      userToFollow: null,
    });
  };

  return (
    <Island
      className={
        isDragging
          ? "excalidraw-minimap excalidraw-minimap--dragging"
          : "excalidraw-minimap"
      }
      style={{
        width: cssWidth,
        height: cssHeight,
        background: backgroundColor,
      }}
    >
      <div
        className="excalidraw-minimap__surface"
        data-testid="minimap"
        title={label}
        aria-label={label}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }
          event.stopPropagation();
          event.preventDefault();
          const transform = transformRef.current;
          const node = event.currentTarget;
          if (!transform) {
            return;
          }
          node.setPointerCapture(event.pointerId);
          const rect = node.getBoundingClientRect();
          const state = appStateRef.current;
          const scene = minimapPointToScene(
            ((event.clientX - rect.left) / Math.max(rect.width, 1)) * cssWidth,
            ((event.clientY - rect.top) / Math.max(rect.height, 1)) * cssHeight,
            transform,
          );
          const viewport = getViewportSceneRect({
            scrollX: state.scrollX,
            scrollY: state.scrollY,
            width: state.width,
            height: state.height,
            zoom: state.zoom.value,
          });
          const inside =
            scene.x >= viewport.x &&
            scene.y >= viewport.y &&
            scene.x <= viewport.x + viewport.width &&
            scene.y <= viewport.y + viewport.height;
          dragOffsetRef.current = inside
            ? {
                x: viewport.x + viewport.width / 2 - scene.x,
                y: viewport.y + viewport.height / 2 - scene.y,
              }
            : { x: 0, y: 0 };
          setIsDragging(true);
          panTo(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (!dragOffsetRef.current) {
            return;
          }
          panTo(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          dragOffsetRef.current = null;
          setIsDragging(false);
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          dragOffsetRef.current = null;
          setIsDragging(false);
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <canvas
          ref={viewRef}
          className="excalidraw-minimap__canvas"
          aria-hidden="true"
          draggable={false}
        />
      </div>
    </Island>
  );
};
