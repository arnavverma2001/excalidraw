import { pointFrom } from "@excalidraw/math";

import { THEME } from "@excalidraw/common";

import {
  newElement,
  newFrameElement,
  newFreeDrawElement,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";

import {
  createMinimapTransform,
  getViewportSceneRect,
  minimapPointToScene,
  renderMinimapContent,
  scenePointToMinimap,
  scrollForSceneCenter,
} from "./minimap";

describe("minimap", () => {
  it("fits the scene inside the padding and round-trips coordinates", () => {
    const transform = createMinimapTransform([0, 0, 100, 50], 200, 100, 10);

    expect(transform).not.toBeNull();
    expect(transform!.scale).toBeCloseTo(1.6);
    expect(transform!.offsetX).toBeCloseTo(20);
    expect(transform!.offsetY).toBeCloseTo(10);

    const mapped = scenePointToMinimap(100, 50, transform!);
    expect(mapped.x).toBeCloseTo(180);
    expect(mapped.y).toBeCloseTo(90);

    const scene = minimapPointToScene(mapped.x, mapped.y, transform!);
    expect(scene.x).toBeCloseTo(100);
    expect(scene.y).toBeCloseTo(50);
  });

  it("centers a wide scene vertically", () => {
    const transform = createMinimapTransform([0, 0, 200, 20], 120, 80, 10);

    expect(transform).not.toBeNull();
    expect(transform!.scale).toBeCloseTo(0.5);
    expect(transform!.offsetX).toBeCloseTo(10);
    expect(transform!.offsetY).toBeGreaterThan(10);
  });

  it("scrolls so a scene point lands in the middle of the viewport", () => {
    expect(scrollForSceneCenter(100, 50, 800, 600, 2)).toEqual({
      scrollX: 100,
      scrollY: 100,
    });
    expect(
      getViewportSceneRect({
        scrollX: 100,
        scrollY: 100,
        width: 800,
        height: 600,
        zoom: 2,
      }),
    ).toEqual({
      x: -100,
      y: -100,
      width: 400,
      height: 300,
    });
  });

  it("draws every element type into the thumbnail", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 208;
    canvas.height = 140;
    const context = canvas.getContext("2d");
    expect(context).not.toBeNull();
    const fill = vi.spyOn(context!, "fill");
    const stroke = vi.spyOn(context!, "stroke");
    const fillText = vi.spyOn(context!, "fillText");

    const elements = [
      newFrameElement({
        x: -20,
        y: -20,
        width: 280,
        height: 180,
        name: "Board",
      }),
      newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        backgroundColor: "#ff0000",
        strokeColor: "#111111",
      }),
      newElement({
        type: "ellipse",
        x: 140,
        y: 10,
        width: 70,
        height: 50,
        backgroundColor: "#2f9e44",
        strokeColor: "#1b4332",
      }),
      newElement({
        type: "diamond",
        x: 40,
        y: 100,
        width: 60,
        height: 40,
        backgroundColor: "#fab005",
        strokeColor: "#e67700",
      }),
      newLinearElement({
        type: "arrow",
        x: 120,
        y: 40,
        width: 80,
        height: 30,
        points: [pointFrom(0, 0), pointFrom(80, 30)],
        strokeColor: "#1971c2",
      }),
      newFreeDrawElement({
        type: "freedraw",
        x: 10,
        y: 90,
        width: 30,
        height: 20,
        points: [pointFrom(0, 0), pointFrom(10, 16), pointFrom(30, 4)],
        simulatePressure: false,
        strokeColor: "#9c36b5",
      }),
      newTextElement({
        x: 150,
        y: 90,
        text: "Hello",
        strokeColor: "#212529",
      }),
    ];

    const transform = renderMinimapContent({
      context: context!,
      elements,
      width: 208,
      height: 140,
      backgroundColor: "#ffffff",
      theme: THEME.LIGHT,
      getImage: () => null,
    });

    expect(transform).not.toBeNull();
    expect(fill.mock.calls.length).toBeGreaterThan(3);
    expect(stroke).toHaveBeenCalled();
    expect(fillText).toHaveBeenCalled();
    const center = scenePointToMinimap(60, 40, transform!);
    expect(center.x).toBeGreaterThan(0);
    expect(center.x).toBeLessThan(208);
    expect(center.y).toBeGreaterThan(0);
    expect(center.y).toBeLessThan(140);
  });
});
