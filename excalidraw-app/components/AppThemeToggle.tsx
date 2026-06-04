import { DarkModeToggle } from "@excalidraw/excalidraw/components/DarkModeToggle";
import React from "react";

import type { Theme } from "@excalidraw/element/types";

export const AppThemeToggle: React.FC<{
  theme: Theme;
  onChange: (theme: Theme) => void;
}> = React.memo(({ theme, onChange }) => {
  return <DarkModeToggle value={theme} onChange={onChange} />;
});

AppThemeToggle.displayName = "AppThemeToggle";
