import clsx from "clsx";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { actionShortcuts } from "../../actions";
import { useTunnels } from "../../context/tunnels";
import { ExitZenModeButton, UndoRedoActions, ZoomActions } from "../Actions";
import { HelpButton } from "../HelpButton";
import { Section } from "../Section";
import Stack from "../Stack";

import Minimap, { type MinimapProps } from "../Minimap";

import type { ActionManager } from "../../actions/manager";

import type { AppState } from "../../types";

const Footer = ({
  appState,
  elements,
  elementsMap,
  setAppState,
  actionManager,
  showExitZenModeBtn,
  renderWelcomeScreen,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  elementsMap: NonDeletedSceneElementsMap;
  setAppState: MinimapProps["setAppState"];
  actionManager: ActionManager;
  showExitZenModeBtn: boolean;
  renderWelcomeScreen: boolean;
}) => {
  const { FooterCenterTunnel, WelcomeScreenHelpHintTunnel } = useTunnels();

  return (
    <footer
      role="contentinfo"
      className="layer-ui__wrapper__footer App-menu App-menu_bottom"
    >
      <div
        className={clsx("layer-ui__wrapper__footer-left zen-mode-transition", {
          "layer-ui__wrapper__footer-left--transition-left":
            appState.zenModeEnabled,
        })}
      >
        <Stack.Col gap={2}>
          <Section heading="canvasActions">
            <ZoomActions
              renderAction={actionManager.renderAction}
              zoom={appState.zoom}
            />

            {!appState.viewModeEnabled && (
              <UndoRedoActions
                renderAction={actionManager.renderAction}
                className={clsx("zen-mode-transition", {
                  "layer-ui__wrapper__footer-left--transition-bottom":
                    appState.zenModeEnabled,
                })}
              />
            )}
          </Section>
        </Stack.Col>
      </div>
      <FooterCenterTunnel.Out />
      <div
        className={clsx("layer-ui__wrapper__footer-right zen-mode-transition", {
          "transition-right": appState.zenModeEnabled,
        })}
      >
        <Stack.Col gap={2} align="end">
          <Minimap
            elements={elements}
            elementsMap={elementsMap}
            appState={appState}
            setAppState={setAppState}
          />
          <div style={{ position: "relative" }}>
            {renderWelcomeScreen && <WelcomeScreenHelpHintTunnel.Out />}
            <HelpButton
              onClick={() => actionManager.executeAction(actionShortcuts)}
            />
          </div>
        </Stack.Col>
      </div>
      <ExitZenModeButton
        actionManager={actionManager}
        showExitZenModeBtn={showExitZenModeBtn}
      />
    </footer>
  );
};

export default Footer;
Footer.displayName = "Footer";
