import type { FancyPantsInput } from "./physics";

const CODE_TO_TOKEN: Record<string, string> = {
  ArrowLeft: "arrowleft",
  ArrowRight: "arrowright",
  ArrowUp: "arrowup",
  ArrowDown: "arrowdown",
  KeyA: "a",
  KeyD: "d",
  KeyW: "w",
  KeyS: "s",
  Space: " ",
};

export type ControlEvent = {
  key: string;
  code: string;
  keyCode?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
};

const KEY_ALIASES: Record<string, string> = {
  arrowleft: "arrowleft",
  left: "arrowleft",
  arrowright: "arrowright",
  right: "arrowright",
  arrowup: "arrowup",
  up: "arrowup",
  arrowdown: "arrowdown",
  down: "arrowdown",
};

const KEYCODE_TO_TOKEN: Record<number, string> = {
  37: "arrowleft",
  38: "arrowup",
  39: "arrowright",
  40: "arrowdown",
};

/** Stable token for a key event. Prefers `code`, then key aliases, then keyCode. */
export function controlToken(event: ControlEvent): string {
  const fromCode = CODE_TO_TOKEN[event.code];
  if (fromCode) {
    return fromCode;
  }
  const key = event.key.toLowerCase();
  if (KEY_ALIASES[key]) {
    return KEY_ALIASES[key];
  }
  if (event.keyCode && KEYCODE_TO_TOKEN[event.keyCode]) {
    return KEYCODE_TO_TOKEN[event.keyCode];
  }
  return key;
}

export function isGameControl(event: ControlEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }
  const token = controlToken(event);
  return (
    token === "arrowleft" ||
    token === "arrowright" ||
    token === "arrowup" ||
    token === "arrowdown" ||
    token === "a" ||
    token === "d" ||
    token === "w" ||
    token === "s" ||
    token === " "
  );
}

export function isJumpToken(token: string): boolean {
  return token === "arrowup" || token === "w" || token === " ";
}

export function inputFromTokens(
  tokens: ReadonlySet<string>,
  jumpPressed: boolean,
): FancyPantsInput {
  return {
    left: tokens.has("arrowleft") || tokens.has("a"),
    right: tokens.has("arrowright") || tokens.has("d"),
    jumpPressed,
  };
}
