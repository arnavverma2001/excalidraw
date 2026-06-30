import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleMinimap = register({
  name: "minimap",
  label: "minimap.title",
  viewMode: true,
  trackEvent: { category: "menu" },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        minimap: {
          ...appState.minimap,
          collapsed: this.checked!(appState),
        },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => !appState.minimap.collapsed,
});
