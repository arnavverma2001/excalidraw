# AGENTS.md

See `CLAUDE.md` for project structure and the canonical dev/test/build commands
(`yarn test:typecheck`, `yarn test:code`, `yarn test:update`, `yarn fix`).

## Cursor Cloud specific instructions

- Dependencies are installed via the startup update script (`yarn install`), so they are already present at session start.
- Services: this repo is a frontend-only, local-first app. The only thing you need to run for development is the Vite dev server.
  - Start it with `yarn start` (alias for the `excalidraw-app` workspace). It serves on **http://localhost:3001** (non-default port, set via `VITE_APP_PORT` in `.env.development`).
  - `yarn start` runs `yarn && vite`, so it re-resolves workspace deps on launch (fast no-op when already installed).
  - The collaboration WebSocket server, AI backend, and Firebase backends referenced in `.env.development` are **optional external services**; basic drawing/editing works fully offline without them.
- Dev-server log gotcha: `vite-plugin-checker` prints lines like `ERROR  [ESLint] Found 0 error...` and `ERROR [TypeScript] Found 0 errors`. Despite the `ERROR` label, `Found 0 errors` means success — these are not failures.
- Tests use Vitest (jsdom). Run a scoped subset quickly with e.g. `yarn test:app run packages/math`; `yarn test:update` runs the full suite with snapshot updates.
