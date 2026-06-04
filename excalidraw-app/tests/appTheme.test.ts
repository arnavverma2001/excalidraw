/**
 * @vitest-environment jsdom
 */
import { THEME } from "@excalidraw/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyDocumentTheme,
  getStoredAppThemePreference,
  resolveEditorTheme,
} from "../appTheme";

describe("appTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to system preference when nothing is stored", () => {
    expect(getStoredAppThemePreference()).toBe("system");
  });

  it("resolves system preference from prefers-color-scheme", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("dark"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(resolveEditorTheme("system")).toBe(THEME.DARK);
  });

  it("applies document-level dark mode classes and meta theme color", () => {
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }

    applyDocumentTheme(THEME.DARK);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(meta.content).toBe("#121212");

    applyDocumentTheme(THEME.LIGHT);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(meta.content).toBe("#ffffff");
  });

  it("reads stored theme preference from localStorage", () => {
    localStorage.setItem("excalidraw-theme", THEME.DARK);
    expect(getStoredAppThemePreference()).toBe(THEME.DARK);
  });
});
