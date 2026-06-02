# AGENTS.md

## Cursor Cloud specific instructions

### Monorepo overview

Excalidraw is a Yarn 1 workspaces monorepo. Primary development targets:

| Target | Path | Purpose |
|--------|------|---------|
| Web app (excalidraw.com) | `excalidraw-app/` | Full app; start with `yarn start` from repo root |
| Editor library | `packages/excalidraw/` (+ `common`, `element`, `math`, `utils`) | npm packages; resolved from source in dev via Vite aliases |
| Examples | `examples/*` | Optional embed demos |

See `CLAUDE.md` for architecture and standard commands (`yarn test:typecheck`, `yarn test:update`, `yarn fix`).

### Dev server

- **Command:** `yarn start` (runs Vite in `excalidraw-app/`)
- **URL:** `http://localhost:3001` (from `excalidraw-app/.env.development` `VITE_APP_PORT`; Vite config falls back to 3000 if unset)
- **Requirement:** Node `>=18` (see root `package.json` `engines`); repo pins `packageManager` to `yarn@1.22.22`
- Packages are consumed from **source** in dev; `yarn build:packages` is only needed for publishing or running examples that import built artifacts

### Lint / test / build (no extra services)

| Task | Command |
|------|---------|
| Typecheck | `yarn test:typecheck` |
| ESLint | `yarn test:code` |
| Prettier check | `yarn test:other` |
| Unit tests | `yarn test:app --watch=false` (or `yarn test:update` before commits) |
| Production build | `yarn build:app` |

Vitest uses jsdom; no database or local backend is required for tests.

### Optional services (not started by default)

| Feature | How to enable locally |
|---------|------------------------|
| Real-time collaboration | Run [excalidraw-room](https://github.com/excalidraw/excalidraw-room) on port **3002** (`VITE_APP_WS_SERVER_URL`) |
| AI diagram-to-code | Backend on port **3016** (`VITE_APP_AI_BACKEND`) |
| Share links / Firebase / libraries | Use dev `.env` defaults (remote APIs) or override env vars |

### Gotchas

- **Husky pre-commit** is installed but `.husky/pre-commit` has `lint-staged` commented out; rely on CI/local `yarn test:*` manually.
- **Firebase config** warnings in some app tests (`Error JSON parsing firebase config`) are expected when env is minimal; tests still pass.
- **Vite dev server** runs TypeScript/ESLint checkers in the terminal; `ERROR` lines with `Found 0 errors` are normal checker output, not failures.
- **`dev-docs/`** is not in root workspaces; install and run separately (`cd dev-docs && yarn && yarn start` on port 3003) if working on documentation.
