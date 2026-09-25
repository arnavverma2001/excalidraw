import {
  controlToken,
  inputFromTokens,
  isGameControl,
  isJumpToken,
  jumpOnPress,
} from "./controls";

describe("fancy pants arrow controls", () => {
  it("maps arrow key codes to movement and jump", () => {
    expect(controlToken({ key: "ArrowLeft", code: "ArrowLeft" })).toBe(
      "arrowleft",
    );
    expect(controlToken({ key: "ArrowRight", code: "ArrowRight" })).toBe(
      "arrowright",
    );
    expect(controlToken({ key: "ArrowUp", code: "ArrowUp" })).toBe("arrowup");

    const input = inputFromTokens(new Set(["arrowright"]), false);
    expect(input.right).toBe(true);
    expect(input.left).toBe(false);

    expect(inputFromTokens(new Set(["arrowleft"]), false).left).toBe(true);
    expect(controlToken({ key: "Right", code: "", keyCode: 39 })).toBe(
      "arrowright",
    );
    expect(controlToken({ key: "Up", code: "", keyCode: 38 })).toBe("arrowup");
    expect(isJumpToken("arrowup")).toBe(true);
    expect(inputFromTokens(new Set(["arrowup"]), true).jumpPressed).toBe(true);
  });

  it("requests one jump on a held-token rising edge", () => {
    expect(jumpOnPress(false, true, false)).toBe(true);
    expect(jumpOnPress(true, true, false)).toBe(false);
    expect(jumpOnPress(true, false, false)).toBe(false);
    expect(jumpOnPress(false, false, true)).toBe(true);
  });

  it("treats arrow keys as game controls even when the canvas is focused", () => {
    expect(isGameControl({ key: "ArrowRight", code: "ArrowRight" })).toBe(true);
    expect(isGameControl({ key: "ArrowUp", code: "ArrowUp" })).toBe(true);
    expect(
      isGameControl({ key: "ArrowLeft", code: "ArrowLeft", ctrlKey: true }),
    ).toBe(false);
  });
});
