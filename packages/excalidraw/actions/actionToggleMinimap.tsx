import { CaptureUpdateAction } from "@excalidraw/element";

import { minimapIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleMinimap = register({
  name: "minimap",
  label: "minimap.fullTitle",
  icon: minimapIcon,
  viewMode: true,
  trackEvent: { category: "menu" },
  keywords: ["navigation", "overview", "map"],
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        minimap: { open: !this.checked!(appState) },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.minimap.open,
});
