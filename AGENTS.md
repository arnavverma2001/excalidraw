# AGENTS.md

## Cursor Cloud specific instructions

Excalidraw is a Yarn (classic, v1) workspaces monorepo. Dependencies are installed at the repo root with `yarn install`; the cloud update script already runs this on startup, so you normally don't need to install anything manually.

### Services / what to run
There is one runnable product service for local dev: the **excalidraw-app** Vite dev server.

- Start it from the repo root with `yarn start` (delegates to `yarn --cwd ./excalidraw-app start`).
- It serves on `http://localhost:3001` (port set by `VITE_APP_PORT` in `.env.development`).
- The app is fully client-side (canvas, local-first). No backend/database is required to run, build, or test it. Collaboration (`excalidraw-room` on `:3002`) and AI (`:3016`) backends are **external repos not in this monorepo**; their endpoints default to `localhost`/hosted dev URLs and are optional — the editor works without them.

### Non-obvious caveats
- `yarn start` runs Vite with `vite-plugin-checker` (ESLint + TypeScript). The checker prints lines like `ERROR  [ESLint] Found 0 error and 0 warning` and `ERROR [TypeScript] Found 0 errors` — this is just the plugin's output formatting; **"Found 0 errors" means success, not a failure.**
- The app dev server does **not** require pre-building the `@excalidraw/*` packages: workspace path aliases resolve imports to package source (see `vitest.config.mts`). `yarn build:packages` is only needed for the npm-package consumers / `examples/*`.
- Tests print `Error JSON parsing firebase config. Supplied value: undefined` — harmless; Firebase config isn't set in the test env and the editor doesn't need it.

### Standard commands (see root `package.json` scripts and `CLAUDE.md`)
- Typecheck: `yarn test:typecheck`
- Lint: `yarn test:code` (autofix: `yarn fix`)
- Tests (single run): `yarn test:app --watch=false` (or `yarn test:update` to update snapshots)
- Build packages: `yarn build:packages`
- Build app: `yarn build`
