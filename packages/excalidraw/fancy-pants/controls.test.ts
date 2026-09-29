import {
  controlToken,
  inputFromTokens,
  isGameControl,
  isJumpToken,
  jumpOnPress,
  queueJump,
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

  it("keeps a jump queued until a physics step can consume it", () => {
    const requested = queueJump(false, false, true);
    const nextRenderWithoutPhysics = queueJump(requested, true, true);
    const afterConsumption = queueJump(false, true, true);

    expect(requested).toBe(true);
    expect(nextRenderWithoutPhysics).toBe(true);
    expect(afterConsumption).toBe(false);
  });

  it("treats arrow keys as game controls even when the canvas is focused", () => {
    expect(isGameControl({ key: "ArrowRight", code: "ArrowRight" })).toBe(true);
    expect(isGameControl({ key: "ArrowUp", code: "ArrowUp" })).toBe(true);
    expect(
      isGameControl({ key: "ArrowLeft", code: "ArrowLeft", ctrlKey: true }),
    ).toBe(false);
  });

  it("maps WASD and Space onto the same movement and jump tokens", () => {
    expect(controlToken({ key: "a", code: "KeyA" })).toBe("a");
    expect(controlToken({ key: "d", code: "KeyD" })).toBe("d");
    expect(controlToken({ key: "w", code: "KeyW" })).toBe("w");
    expect(controlToken({ key: " ", code: "Space" })).toBe(" ");

    expect(isJumpToken("w")).toBe(true);
    expect(isJumpToken(" ")).toBe(true);
    expect(isJumpToken("arrowdown")).toBe(false);

    expect(inputFromTokens(new Set(["a"]), false).left).toBe(true);
    expect(inputFromTokens(new Set(["d"]), false).right).toBe(true);
    expect(inputFromTokens(new Set(["w"]), true).jumpPressed).toBe(true);
    expect(inputFromTokens(new Set([" "]), true).jumpPressed).toBe(true);

    expect(isGameControl({ key: "w", code: "KeyW" })).toBe(true);
    expect(isGameControl({ key: " ", code: "Space" })).toBe(true);
    expect(
      isGameControl({ key: "ArrowUp", code: "ArrowUp", metaKey: true }),
    ).toBe(false);
    expect(
      isGameControl({ key: "ArrowUp", code: "ArrowUp", altKey: true }),
    ).toBe(false);
    expect(isGameControl({ key: "Escape", code: "Escape" })).toBe(false);
  });

  it("keeps a keydown-edge jump queued even if the token already looked held", () => {
    expect(queueJump(false, true, true, true)).toBe(true);
    expect(queueJump(false, true, true, false)).toBe(false);
  });
});
