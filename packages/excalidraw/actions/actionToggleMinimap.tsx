import { CaptureUpdateAction } from "@excalidraw/element";

import { minimapIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleMinimap = register({
  name: "minimap",
  label: "buttons.minimap",
  icon: minimapIcon,
  viewMode: true,
  trackEvent: { category: "menu" },
  keywords: ["minimap", "overview", "navigation", "map"],
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        showMinimap: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.showMinimap,
  predicate: (elements, appState, appProps, app) => {
    return app.editorInterface.formFactor !== "phone";
  },
});
