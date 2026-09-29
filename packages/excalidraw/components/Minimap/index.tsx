import { useEditorInterface, useExcalidrawAppState } from "../App";
import { minimapIcon } from "../icons";
import { Island } from "../Island";
import { t } from "../../i18n";

import { Minimap } from "./Minimap";

import "./Minimap.scss";

import type { AppClassProperties } from "../../types";

export { Minimap };

export const MinimapToggleButton = ({ onShow }: { onShow: () => void }) => {
  return (
    <div className="excalidraw-minimap-show" data-testid="minimap-show">
      <Island padding={1}>
        <button
          type="button"
          onClick={onShow}
          aria-label={t("minimap.show")}
          title={t("minimap.show")}
        >
          {minimapIcon}
          <span>{t("minimap.title")}</span>
        </button>
      </Island>
    </div>
  );
};

export const MinimapContainer = ({
  app,
  onToggle,
}: {
  app: AppClassProperties;
  onToggle: () => void;
}) => {
  const appState = useExcalidrawAppState();
  const editorInterface = useEditorInterface();

  if (
    editorInterface.formFactor === "phone" ||
    appState.zenModeEnabled ||
    appState.viewModeEnabled
  ) {
    return null;
  }

  if (!appState.showMinimap) {
    return <MinimapToggleButton onShow={onToggle} />;
  }

  return <Minimap app={app} onClose={onToggle} />;
};
