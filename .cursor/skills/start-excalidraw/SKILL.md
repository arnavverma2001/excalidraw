---
name: start-excalidraw
description: Start the Excalidraw monorepo dev server and open it in Cursor's browser. Use when the user asks to run, start, launch, or preview this repo locally, open excalidraw in the browser, or spin up the dev environment.
---

# Start Excalidraw

## Quick start

From the repo root:

```bash
yarn start
```

This runs the full excalidraw.com app via Vite in `excalidraw-app/`. HMR is enabled; edits in `packages/*` or `excalidraw-app/` reload automatically.

## Prerequisites

- **Node.js** >= 18
- **Yarn** 1.x (repo pins `yarn@1.22.22`)

If `node_modules` is missing:

```bash
yarn install
```

## Dev server port

Port comes from `VITE_APP_PORT` in `.env.development` (currently **3001**). Vite falls back to **3000** if unset.

Before opening the browser, read the port from `.env.development` or wait for the Vite "ready" log:

```
➜  Local:   http://localhost:3001/
```

## Workflow

Copy this checklist and track progress:

```
Task Progress:
- [ ] Step 1: Check prerequisites
- [ ] Step 2: Install deps if needed
- [ ] Step 3: Check for existing dev server
- [ ] Step 4: Start dev server in background
- [ ] Step 5: Wait for Vite ready
- [ ] Step 6: Open in Cursor browser
```

### Step 1: Check prerequisites

Run `node -v` and `yarn -v`. Node must be >= 18.

### Step 2: Install deps if needed

Skip if `node_modules/` exists and is populated. Otherwise run `yarn install` from repo root.

### Step 3: Check for existing dev server

List terminal files or curl the expected port before starting a second server:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/
```

If it returns `200`, skip to Step 6 with the URL already running.

### Step 4: Start dev server in background

From repo root, run with `block_until_ms: 0` so it stays in the background:

```bash
yarn start
```

Do **not** use `yarn start:production` for local development — that builds first and serves static files without HMR.

### Step 5: Wait for Vite ready

Poll the terminal output until you see `VITE ... ready` and the `Local:` URL. First compile can take 10–30 seconds.

If startup fails:
- Missing deps → `yarn install`, retry
- Port in use → check `VITE_APP_PORT` in `.env.development` or kill the process on that port

### Step 6: Open in Cursor browser

Use the **cursor-ide-browser** MCP (read tool schemas first):

1. `browser_navigate` to `http://localhost:<port>/` with `position: "active"` so the user sees it
2. `browser_snapshot` to confirm the canvas loaded (look for toolbar, canvas area)
3. If verification fails, `browser_take_screenshot` and report what you see

For follow-up browser testing on an already-open tab: `browser_lock` → interact → `browser_lock` unlock.

## Other start commands

| Command | Use when |
|---------|----------|
| `yarn start` | Default — full app with HMR |
| `yarn start:example` | Testing the browser-script integration example (port 3001) |
| `yarn start:production` | Preview production build (no HMR, port 5001) |

## Repo layout (for context)

- `excalidraw-app/` — excalidraw.com web app (what `yarn start` runs)
- `packages/excalidraw/` — core editor library
- `packages/{common,element,math,utils}/` — shared packages

Package changes hot-reload through Vite aliases — no separate build step needed for dev.

## Optional services (not required to draw)

Collaboration (`VITE_APP_WS_SERVER_URL`, port 3002) and AI backend (port 3016) are optional. The editor works without them; collaboration and AI features will be degraded.
