---
name: start-and-preview
description: Start the Excalidraw dev server and open the app in the Cursor browser. Use when the user asks to start, run, serve, or preview this repo/app, or to open it in the browser.
---

# Start & Preview

Start the dev server and preview the running app in the Cursor browser.

## Steps

1. From the repo root, start the dev server as a **background** process (do not block waiting on it):

```bash
yarn start
```

This runs the `excalidraw-app` Vite dev server on `http://localhost:3000` (override the port with the `VITE_APP_PORT` env var).

2. Before opening the browser, check whether the server is already running (a previous terminal may still have it up) to avoid a duplicate. If it is, skip step 1.

3. Wait until Vite prints the local URL (e.g. `Local: http://localhost:3000/`) before opening the browser. Do not open the browser prematurely.

4. Open `http://localhost:3000` (or the overridden port) in the Cursor browser to preview.

## Notes

- If port 3000 is taken, Vite may pick another port; use whatever URL Vite prints.
- Keep the server running in the background for the rest of the session so the preview stays live.
