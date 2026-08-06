---
name: preview-ui-changes
description: After any UI change, start or reuse the app preview and open it in the Cursor browser so the user can see how it looks. Use whenever CSS, React components, layout, styling, icons, menus, toolbars, or other visual UI is added, edited, or removed — including after implementing or fixing UI features — without waiting for the user to ask.
---

# Preview UI Changes

Every time a UI change is made, please open it in the browser and show me how it looks.

## When to run

After finishing a batch of UI-related edits in this session (components, styles, layout, icons, menus, visual behavior), do not stop at code-only. Preview immediately.

Skip only for pure non-visual work (types, tests, refactors with no render/style impact, docs).

## Steps

1. Follow [.cursor/skills/start-and-preview/SKILL.md](../start-and-preview/SKILL.md): ensure the dev server is running (`yarn start` from repo root if needed), wait for the Vite URL, then open it in the **Cursor browser** (not an external browser).
2. Navigate to the surface that changed when obvious (e.g. open the menu that gained an item, toggle the new control). Otherwise land on the main app.
3. Take a screenshot of the relevant UI and include it in your reply so the user can see the result without hunting for the browser tab.
4. Briefly note what to look at (what changed and where on screen).

## Rules

- Use Cursor's browser tools to drive and capture the preview.
- Prefer one preview pass after a coherent set of related UI edits, not after every single line.
- If the server fails to start or the page errors, report that loudly with the error — do not claim the UI looks fine without evidence.
