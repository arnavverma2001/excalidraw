import React from "react";

import { Excalidraw } from "../../index";
import { API } from "../../tests/helpers/api";
import { fireEvent, render } from "../../tests/test-utils";

describe("<Minimap/>", () => {
  it("stays hidden until something is drawn", async () => {
    const { container } = await render(<Excalidraw />);

    expect(container.querySelector("[data-testid='minimap']")).toBeNull();
  });

  it("shows the scene and pans when dragged", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{
          elements: [
            API.createElement({
              type: "rectangle",
              x: 0,
              y: 0,
              width: 100,
              height: 80,
              backgroundColor: "#ff0000",
            }),
            API.createElement({
              type: "ellipse",
              x: 1800,
              y: 40,
              width: 120,
              height: 80,
              backgroundColor: "#2f9e44",
            }),
          ],
        }}
      />,
    );

    const minimap = container.querySelector(
      "[data-testid='minimap']",
    ) as HTMLDivElement;
    expect(minimap).not.toBeNull();

    vi.spyOn(minimap, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 208,
      bottom: 140,
      width: 208,
      height: 140,
      toJSON() {
        return {};
      },
    });

    const scrollXBefore = window.h.state.scrollX;
    fireEvent.pointerDown(minimap, {
      button: 0,
      clientX: 200,
      clientY: 70,
      pointerId: 1,
    });
    fireEvent.pointerUp(minimap, {
      button: 0,
      clientX: 200,
      clientY: 70,
      pointerId: 1,
    });

    expect(window.h.state.scrollX).not.toBe(scrollXBefore);
    expect(window.h.state.scrollX).toBeLessThan(scrollXBefore);
  });
});
