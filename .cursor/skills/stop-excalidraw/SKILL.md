---
name: stop-excalidraw
description: Stop the Excalidraw dev server, kill related node/vite/yarn processes, and free occupied ports. Use when the user asks to stop, shut down, kill, or tear down the local dev environment, free ports, or stop yarn start / vite for this repo.
---

# Stop Excalidraw

## Quick start

From the repo root:

```bash
bash .cursor/skills/stop-excalidraw/scripts/stop-dev.sh
```

This kills Excalidraw-related processes only — it checks that the process command or cwd is inside this repo before terminating anything.

## Ports cleaned up

Reads from `.env.development` plus known defaults:

| Port | Service |
|------|---------|
| 3001 | Vite dev server (`VITE_APP_PORT`) |
| 3000 | Vite fallback / plus app URL |
| 3002 | Collaboration WebSocket (`VITE_APP_WS_SERVER_URL`) |
| 3016 | AI backend (`VITE_APP_AI_BACKEND`) |
| 5000 | `vite preview` |
| 5001 | `http-server` production serve |

Only listeners owned by processes in this repo are killed. Unrelated services on the same port are left alone and reported.

## Workflow

```
Task Progress:
- [ ] Step 1: Run stop script
- [ ] Step 2: Verify ports are free
- [ ] Step 3: Report results
```

### Step 1: Run stop script

Execute from repo root:

```bash
bash .cursor/skills/stop-excalidraw/scripts/stop-dev.sh
```

The script exits non-zero if Excalidraw processes still hold ports after cleanup. Do not ignore failures — investigate and force-kill only repo-owned PIDs.

### Step 2: Verify ports are free

Confirm no repo-owned listeners remain:

```bash
for port in 3000 3001 3002 3016 5000 5001; do
  lsof -nP -iTCP:$port -sTCP:LISTEN 2>/dev/null || true
done
```

Or read `VITE_APP_PORT` from `.env.development` and check that port specifically.

### Step 3: Report results

Tell the user:
- Which PIDs were stopped (from script output)
- Whether all ports are free
- If anything was skipped because a non-Excalidraw process owns a port

## What gets killed

- `yarn start` / `vite` dev server and child esbuild processes
- `yarn start:production` / `http-server` on 5001
- `vite preview` on 5000
- `yarn start:example` dev server
- Parent shell wrappers started from this repo for the above

## What is NOT killed

- Processes outside this repo path
- Unrelated node services on shared ports (reported, not touched)
- `node_modules` or install artifacts — only running processes

## Manual fallback

If the script fails, find and kill repo-owned listeners directly:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
kill <pid>
```

Walk up the parent chain only while `ps`/`lsof` shows the cwd or command still references this repo.

## Pair with start skill

After stopping, use [start-excalidraw](../start-excalidraw/SKILL.md) to bring the dev server back up.
