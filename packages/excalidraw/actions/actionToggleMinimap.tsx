import { CaptureUpdateAction } from "@excalidraw/element";

import { minimapIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleMinimap = register({
  name: "minimap",
  label: "minimap.title",
  icon: minimapIcon,
  viewMode: false,
  trackEvent: { category: "menu" },
  keywords: ["minimap", "overview", "navigate", "map"],
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
