# AGENTS.md

## Cursor Cloud specific instructions

This is the Excalidraw monorepo (Yarn v1 workspaces, Node >=18). The update script runs `yarn install`, so dependencies are already installed when you start.

### Services / how to run

- **Web app (`excalidraw-app`, the main end-to-end product):** `yarn start` from the repo root (Vite dev server). Standard scripts live in the root `package.json`.
  - Gotcha: it serves on **http://localhost:3001**, not 3000. The README/docs say 3000, but `.env.development` sets `VITE_APP_PORT=3001`, which wins. Use 3001 when verifying the app.
  - Vite aliases the workspace packages' *source* (see `vitest.config.mts`), so you do **not** need `yarn build:packages` to run or test the app. Editing files under `packages/*` hot-reloads in the running app.
- **Library packages (`packages/*`):** build with `yarn build:packages` (esbuild). Only needed for publishing or for the `examples/*` apps, which consume the built `dist` (not source).
- **Examples (`examples/with-script-in-browser`, `examples/with-nextjs`):** require `yarn build:packages` first.

### Lint / typecheck / test / build (all from repo root)

- Lint: `yarn test:code` (ESLint, `--max-warnings=0`).
- Typecheck: `yarn test:typecheck` (`tsc`).
- Tests: `yarn test:app` (Vitest). Scope to a path, e.g. `yarn test:app run packages/math`. Use `yarn test:update` to update snapshots before committing.
- Build (prod, for verification only): `yarn build`.

### Notes / gotchas

- ESLint prints a benign warning that the installed TypeScript (5.9.3) is newer than `@typescript-eslint` officially supports, and `vite-plugin-checker` labels its checker output with the word "ERROR" even when it reports `Found 0 errors`. Both are noise, not failures.
- Optional, feature-specific backends are **not** part of this repo and default to `localhost` in dev, so those features won't work out of the box (expected): real-time collaboration WebSocket server (`VITE_APP_WS_SERVER_URL`, port 3002, repo `excalidraw/excalidraw-room`) and the AI backend (`VITE_APP_AI_BACKEND`, port 3016). The core editor works fully without them. Other endpoints (Firebase, JSON storage, libraries) point at hosted dev services and work without local setup.
