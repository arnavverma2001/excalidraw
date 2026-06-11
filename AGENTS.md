# AGENTS.md

## Cursor Cloud specific instructions

Excalidraw is a Yarn (classic v1) monorepo. Dependencies are refreshed automatically on startup via the update script (`yarn install`), so you normally don't need to install anything manually.

### Services

- **excalidraw-app** (the web app + bundled editor library) is the only service to run for development. The core editor is fully client-side; no backend is required for drawing. Sharing/libraries default to hosted dev endpoints, and collaboration/AI need separate repos (`excalidraw-room` on `:3002`, AI backend on `:3016`) that are not in this monorepo.

### Running the app

- Start the dev server with `yarn start` (root). Non-obvious: it serves on **http://localhost:3001/** (`VITE_APP_PORT=3001`), even though the README/Docker docs reference port 3000.
- On a fresh dev server, the first page load occasionally renders a crash/"Aw, Snap!" page — just reload the tab and the canvas loads normally.
- The dev server runs `vite-plugin-checker`, which prints blocks labeled `ERROR` even when it reports `Found 0 errors` — those are not real failures; check the count.

### Lint / test / build commands

Standard commands are in the root `package.json` and `CLAUDE.md`:
- Lint: `yarn test:code` (eslint), auto-fix with `yarn fix`
- Typecheck: `yarn test:typecheck` (tsc)
- Tests: `yarn test:app` (vitest); update snapshots with `yarn test:update`. Scope to a path, e.g. `yarn test:app --run packages/math`.
- Build app: `yarn build`; build library packages: `yarn build:packages`
