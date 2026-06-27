---
name: electron-backend-dev
description: Use when implementing the backend (Electron main process) side of a pear-desktop plugin — IPC handlers, plugin backend lifecycle, Node integrations, and Hono API routes. Trigger for "build the backend", "IPC handler", "main process", "api-server route", or any main-process work against a design contract.
---

# Electron Backend Development

Implement the main-process side of `_workspace/01_design_spec.md` inside `src/plugins/{name}/`,
returning exactly the shapes the renderer consumes.

## Plugin backend shape

Backend lives in `src/plugins/{name}/backend/` (or `main/`) with an `index.ts` exporting the
lifecycle. Follow `createPlugin`:

```ts
backend: {
  start(ctx) {
    ctx.ipc.handle('ch', async (event, arg) => { /* return contract shape */ });
    ctx.ipc.on('event-ch', (event, arg) => { /* fire-and-forget */ });
  },
  stop(ctx) { ctx.ipc.removeHandler('ch'); /* tear down everything start() set up */ },
  onConfigChange(newConfig) { /* react to settings */ },
}
```

Read `src/plugins/api-server/backend/` for a full reference (routes, schemes, lifecycle).

## The IPC contract (your side)

`ctx.ipc` in the backend context exposes:

- `handle('ch', listener)` — request/response. Pairs with renderer `invoke('ch')`. **The value you
  return IS the renderer's data.** Return the contract's exact shape — if the contract says
  `{ items, total }`, never return a bare array and assume the UI adapts.
- `on('ch', listener)` — fire-and-forget. Pairs with renderer `send('ch')`.
- `send(channel, data)` — push to renderer. Pairs with renderer `on('ch')`. Use `ctx.window`'s
  webContents when you need to target the window.
- `removeHandler('ch')` — call in `stop()` for every handler you registered.

Config: `await ctx.getConfig()` to read, `ctx.setConfig({ field })` to persist (names must match
the schema and the renderer/menu).

## Returning errors across the boundary

A thrown error in a handler rejects the renderer's `invoke` — which often surfaces as a silent
hang or an unhandled rejection. Wrap handler bodies and return a **structured** result the renderer
can branch on (e.g. `{ ok: false, error }`) when failure is expected, rather than letting it throw.

## Hono routes (api-server feature)

When the feature exposes HTTP, follow the api-server route + scheme pattern: define the request
schema, register the route under the existing app, and return JSON matching the documented response
shape. Keep `METHOD /path` and the response shape identical to the contract.

## Node concerns are yours

Filesystem paths (use Electron's path helpers, not hard-coded paths), child processes, native
modules, and propagating their failures cleanly across IPC. Don't block the main thread on heavy work.

## Output

Write the backend files, then record in `_workspace/03_backend_notes.md` every channel/route
implemented with its **actual** request and response shape. QA cross-checks this against the frontend notes.
