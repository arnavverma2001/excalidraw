import { THEME } from "@excalidraw/excalidraw";
import { EVENT, CODES, KEYS } from "@excalidraw/common";
import { useEffect, useLayoutEffect, useState } from "react";

import type { Theme } from "@excalidraw/element/types";

import { STORAGE_KEYS } from "./app_constants";
import {
  applyDocumentTheme,
  getStoredAppThemePreference,
  resolveEditorTheme,
  type AppThemePreference,
} from "./appTheme";

const getDarkThemeMediaQuery = (): MediaQueryList | undefined =>
  window.matchMedia?.("(prefers-color-scheme: dark)");

export const useHandleAppTheme = () => {
  const [appTheme, setAppTheme] = useState<AppThemePreference>(
    getStoredAppThemePreference,
  );
  const [editorTheme, setEditorTheme] = useState<Theme>(() =>
    resolveEditorTheme(getStoredAppThemePreference()),
  );

  useEffect(() => {
    const mediaQuery = getDarkThemeMediaQuery();

    const handleChange = () => {
      if (appTheme === "system") {
        setEditorTheme(resolveEditorTheme("system"));
      }
    };

    mediaQuery?.addEventListener("change", handleChange);

    const handleKeydown = (event: KeyboardEvent) => {
      if (
        !event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.shiftKey &&
        event.code === CODES.D
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setAppTheme(editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK);
      }
    };

    document.addEventListener(EVENT.KEYDOWN, handleKeydown, { capture: true });

    return () => {
      mediaQuery?.removeEventListener("change", handleChange);
      document.removeEventListener(EVENT.KEYDOWN, handleKeydown, {
        capture: true,
      });
    };
  }, [appTheme, editorTheme]);

  useLayoutEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, appTheme);

    const resolvedTheme = resolveEditorTheme(appTheme);
    setEditorTheme(resolvedTheme);
    applyDocumentTheme(resolvedTheme);
  }, [appTheme]);

  return { editorTheme, appTheme, setAppTheme };
};
