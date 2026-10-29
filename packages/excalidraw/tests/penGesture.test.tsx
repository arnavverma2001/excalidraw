import React from "react";
import { it } from "vitest";

import { Excalidraw } from "../index";

import { Pointer, UI } from "./helpers/ui";
import { fireEvent, GlobalTestState, render } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const PEN_POINTER_ID = 2;

const firePen = (
  type: "pointerDown" | "pointerMove" | "pointerLeave" | "pointerOut",
  init: { clientX: number; clientY: number; button?: number; buttons: number },
) => {
  fireEvent[type](GlobalTestState.interactiveCanvas, {
    pointerId: PEN_POINTER_ID,
    pointerType: "pen",
    button: -1,
    ...init,
  });
};

/**
 * Pen stroke during which the barrel (side) button is pressed, after which the
 * pen is lifted and the button released. Chrome + Wacom deliver a second
 * pointerdown (button 1) for the same pointer and never send a pointerup.
 */
const replayPenSideButtonWithoutPointerUp = () => {
  let x = 100;
  const y = 100;

  firePen("pointerDown", { clientX: x, clientY: y, button: 0, buttons: 1 });
  for (let i = 0; i < 5; i++) {
    x += 10;
    firePen("pointerMove", { clientX: x, clientY: y, buttons: 1 });
  }

  firePen("pointerDown", { clientX: x, clientY: y, button: 1, buttons: 5 });
  for (let i = 0; i < 4; i++) {
    x += 10;
    firePen("pointerMove", { clientX: x, clientY: y, buttons: 5 });
  }

  firePen("pointerLeave", { clientX: x, clientY: y, buttons: 4 });
  firePen("pointerOut", { clientX: x, clientY: y, buttons: 4 });

  for (let i = 0; i < 6; i++) {
    x += 10;
    firePen("pointerMove", { clientX: x, clientY: y, buttons: 0 });
  }
};

const dragRectangle = () => {
  UI.clickTool("rectangle");
  mouse.reset();
  mouse.downAt(300, 300);
  mouse.moveTo(400, 380);
  mouse.upAt(400, 380);
};

describe("pen side button (#8476)", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    UI.clickTool("freedraw");
  });

  afterEach(() => {
    // gesture tracking is module-level state in App.tsx, so release the pen
    // pointer to avoid leaking a stale pointer into other tests
    fireEvent.pointerUp(document, {
      pointerId: PEN_POINTER_ID,
      pointerType: "pen",
    });
  });

  it("draws normally after the pen sequence when a pointerup is delivered", () => {
    replayPenSideButtonWithoutPointerUp();
    fireEvent.pointerUp(window, {
      pointerId: PEN_POINTER_ID,
      pointerType: "pen",
      button: 1,
      buttons: 0,
    });
    fireEvent.pointerUp(document, {
      pointerId: PEN_POINTER_ID,
      pointerType: "pen",
      button: 1,
      buttons: 0,
    });

    const zoomBefore = h.state.zoom.value;
    const countBefore = h.elements.length;

    dragRectangle();

    expect(h.state.zoom.value).toBe(zoomBefore);
    expect(h.elements.length).toBe(countBefore + 1);
    expect(h.elements[h.elements.length - 1].type).toBe("rectangle");
  });

  // https://github.com/excalidraw/excalidraw/issues/8476
  // Still reproduces: the pen pointer is never removed from the gesture
  // pointer map (only pointerup/pointercancel remove it), so the next
  // single-pointer drag is treated as a two-pointer pinch and pans/zooms the
  // canvas instead of drawing. Correct behavior: a rectangle is created and
  // zoom is unchanged. Flip to `it` once fixed.
  it.fails(
    "draws a rectangle (no pan/zoom) after pen side button press without pointerup",
    () => {
      replayPenSideButtonWithoutPointerUp();

      const zoomBefore = h.state.zoom.value;
      const countBefore = h.elements.length;

      dragRectangle();

      expect(h.state.zoom.value).toBe(zoomBefore);
      expect(h.elements.length).toBe(countBefore + 1);
      expect(h.elements[h.elements.length - 1].type).toBe("rectangle");
    },
  );
});
