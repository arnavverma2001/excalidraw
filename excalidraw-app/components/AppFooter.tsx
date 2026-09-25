import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

export const AppFooter = React.memo(
  ({
    onChange,
    fancyPantsActive,
    onToggleFancyPants,
  }: {
    onChange: () => void;
    fancyPantsActive: boolean;
    onToggleFancyPants: () => void;
  }) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className={
              fancyPantsActive
                ? "fancy-pants-toggle fancy-pants-toggle--active"
                : "fancy-pants-toggle"
            }
            data-testid="fancy-pants-toggle"
            aria-pressed={fancyPantsActive}
            onClick={onToggleFancyPants}
          >
            {fancyPantsActive ? "Exit Fancy Pants" : "Fancy Pants"}
          </button>
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          {!isExcalidrawPlusSignedUser && <EncryptedIcon />}
        </div>
      </Footer>
    );
  },
);
