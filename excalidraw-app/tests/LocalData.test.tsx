import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { it, vi } from "vitest";

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
} from "@excalidraw/element/types";

import ExcalidrawApp from "../App";
import { STORAGE_KEYS } from "../app_constants";

const { h } = window;

vi.mock("../../excalidraw-app/data/firebase.ts", () => {
  return {
    loadFromFirebase: async () => null,
    saveToFirebase: () => {},
    isSavedToFirebase: () => true,
    loadFilesFromFirebase: async () => ({
      loadedFiles: [],
      erroredFiles: new Map(),
    }),
    saveFilesToFirebase: async () => ({
      savedFiles: new Map(),
      erroredFiles: new Map(),
    }),
  };
});

vi.mock("socket.io-client", () => {
  return {
    default: () => ({
      close: () => {},
      on: () => {},
      once: () => {},
      off: () => {},
      emit: () => {},
    }),
  };
});

/**
 * Local scene as persisted by excalidraw.com (localStorage) whose image binary
 * data is no longer in IndexedDB (`files-db` / `files-store`), e.g. after the
 * browser evicted or the user cleared site storage. `files-db` is empty here
 * because each test file gets a fresh fake-indexeddb.
 */
const seedLocalSceneWithMissingImageFiles = () => {
  const images = ["a", "b", "c"].map((id) =>
    API.createElement({
      type: "image",
      id: `image-${id}`,
      fileId: `file-${id}` as FileId,
      status: "saved",
      x: 0,
      y: 120 * ["a", "b", "c"].indexOf(id),
      width: 100,
      height: 100,
    }),
  );
  const rectangle = API.createElement({
    type: "rectangle",
    id: "rect",
    x: 200,
    y: 0,
    width: 100,
    height: 100,
  });
  const text = {
    ...API.createElement({ type: "text", id: "text", text: "hello", x: 200 }),
    width: 40,
    height: 20,
  };
  const elements: ExcalidrawElement[] = [...images, rectangle, text];

  localStorage.setItem(
    STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
    JSON.stringify(elements),
  );
};

const getImageElements = () =>
  h.elements.filter((el): el is ExcalidrawImageElement => el.type === "image");

// https://github.com/excalidraw/excalidraw/issues/10645
describe("restoring a local scene whose image files are missing from IndexedDB", () => {
  beforeEach(() => {
    localStorage.clear();
    seedLocalSceneWithMissingImageFiles();
  });

  it("keeps the image elements and marks them as errored", async () => {
    await render(<ExcalidrawApp />);

    await waitFor(() => {
      const images = getImageElements();
      expect(images).toHaveLength(3);
      images.forEach((image) => expect(image.status).toBe("error"));
    });

    expect(h.elements.map((el) => el.id).sort()).toEqual(
      ["image-a", "image-b", "image-c", "rect", "text"].sort(),
    );
    getImageElements().forEach((image) => {
      expect(h.app.files[image.fileId!]).toBeUndefined();
    });
  });

  // Still reproduces: images silently render as grey placeholders and the
  // user gets no toast, error dialog, or other indication that the image data
  // is gone. Correct behavior (per the issue): either the image data persists,
  // or the user is clearly warned that it is missing. Flip to `it` once a
  // warning is surfaced.
  it.fails("warns the user that image data is missing", async () => {
    await render(<ExcalidrawApp />);

    await waitFor(() => {
      getImageElements().forEach((image) => expect(image.status).toBe("error"));
    });

    await waitFor(
      () => {
        expect(
          h.state.toast?.message ||
            h.state.errorMessage ||
            document.querySelector(".ErrorDialog, [role='dialog']"),
        ).toBeTruthy();
      },
      { timeout: 1000 },
    );
  });
});
