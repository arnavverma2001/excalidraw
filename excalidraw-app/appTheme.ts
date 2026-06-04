import { THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { STORAGE_KEYS } from "./app_constants";

export type AppThemePreference = Theme | "system";

const META_THEME_COLOR_LIGHT = "#ffffff";
const META_THEME_COLOR_DARK = "#121212";

export const getStoredAppThemePreference = (): AppThemePreference => {
  const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_THEME);

  if (stored === THEME.DARK || stored === THEME.LIGHT || stored === "system") {
    return stored;
  }

  return "system";
};

export const resolveEditorTheme = (preference: AppThemePreference): Theme => {
  if (preference === "system") {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
      ? THEME.DARK
      : THEME.LIGHT;
  }

  return preference;
};

/** Keep `html.dark` and browser chrome colors in sync with the editor theme. */
export const applyDocumentTheme = (theme: Theme) => {
  const isDark = theme === THEME.DARK;

  document.documentElement.classList.toggle("dark", isDark);

  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }

  meta.content = isDark ? META_THEME_COLOR_DARK : META_THEME_COLOR_LIGHT;
};
