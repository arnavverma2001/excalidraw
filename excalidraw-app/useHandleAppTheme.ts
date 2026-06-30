import { THEME } from "@excalidraw/excalidraw";

import type { Theme } from "@excalidraw/element/types";

// Dark mode has been removed from the app: the editor is always light.
export const useHandleAppTheme = () => {
  const editorTheme: Theme = THEME.LIGHT;
  const appTheme: Theme = THEME.LIGHT;
  const setAppTheme = (_theme: Theme | "system") => {};

  return { editorTheme, appTheme, setAppTheme };
};
