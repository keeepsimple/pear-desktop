# Boundary Check Procedures

Detailed cross-process verification procedures for pear-desktop plugins. The principle behind all
of them: **read the producer and consumer side by side and compare the contract.** Existence checks
("is there a handler?") are weak; coherence checks ("does the handler return what the caller awaits?")
are what catch real bugs.

## Table of contents

1. Why static review and a green build miss these
2. IPC request/response (`handle` ↔ `invoke`)
3. IPC fire-and-forget (`send` ↔ `on`)
4. IPC backend push (`send` ↔ `on`)
5. Config coherence (schema ↔ menu ↔ reads)
6. HTTP coherence (Hono route ↔ caller)
7. Plugin lifecycle coherence
8. Failure-pattern catalog

---

## 1. Why static review and a green build miss these

- **Generics lie.** `await ctx.ipc.invoke('ch') as ResultType` compiles no matter what the backend
  actually returns. The cast asserts a shape the runtime may not honor.
- **`pnpm build` ≠ correctness.** Type casts, `any`, and generics pass the compiler and fail at runtime.
- **Existence ≠ connection.** "A handler for `ch` exists" and "the handler returns what `invoke('ch')`
  expects" are entirely different claims. Always verify the second.

---

## 2. IPC request/response (`handle` ↔ `invoke`)

**Producer:** backend `ctx.ipc.handle('ch', listener)` — the listener's **return value** is the data.
**Consumer:** renderer `await ctx.ipc.invoke('ch', arg)`.

Procedure:
1. Grep backend for `ipc.handle(` — list each channel and the shape its listener returns.
2. Grep renderer for `ipc.invoke(` — list each channel and the shape it awaits/uses.
3. For each channel, compare: **name** identical? **arg** shape matches the listener's parameter?
   **return** shape matches what the renderer reads off the result?
4. Flag wrapping mismatches: backend returns `{ items: [...] }` but renderer does `result.map(...)`
   (expecting a bare array), or vice-versa.
5. Flag any `invoke` whose channel has no `handle` (dead call) and any `handle` no one invokes (dead handler).

---

## 3. IPC fire-and-forget (`send` ↔ `on`, renderer→backend)

**Producer:** renderer `ctx.ipc.send('ch', arg)`. **Consumer:** backend `ctx.ipc.on('ch', listener)`.

Procedure: match channel names 1:1; confirm the `arg` the renderer sends matches the listener's
expected parameter shape. Flag sends with no matching `on` and listeners no one sends to.

---

## 4. IPC backend push (`send` ↔ `on`, backend→renderer)

**Producer:** backend `ctx.ipc.send(channel, data)`. **Consumer:** renderer `ctx.ipc.on('ch', listener)`.

Procedure: match channel names; confirm `data` shape matches the listener's parameter. **Critical
cleanup check:** every renderer `ipc.on('ch')` must have a matching `removeAllListeners('ch')` in
`stop()` — a missing teardown leaks listeners across plugin reloads.

---

## 5. Config coherence (schema ↔ menu ↔ reads)

Three places must agree on field names, types, and defaults:
1. The plugin `config` object (the schema + defaults).
2. `menu.ts` — settings UI items that toggle/set each field.
3. Every `getConfig()` read and `setConfig({ field })` write in backend and renderer.

Procedure: list the schema fields; grep all `getConfig`/`setConfig`/`newConfig.` accesses across
backend and renderer; flag any field read but not in the schema (will be `undefined` at runtime),
any schema field never surfaced in `menu.ts` (unreachable setting), and any name drift between them.

---

## 6. HTTP coherence (Hono route ↔ caller)

**Producer:** the route handler's JSON response. **Consumer:** the caller's expected shape.

Procedure: list `METHOD /path` for each route and the JSON it returns; compare to each caller's
expected shape. Watch for response wrapping (`{ data: ... }`), status-vs-body shape (a `202`-style
immediate ack vs the final result the caller tries to read), and path/method drift.

---

## 7. Plugin lifecycle coherence

- Plugin `name()` is unique across `src/plugins/`.
- Everything `start(ctx)` registers (handlers, listeners, DOM, timers) is torn down in `stop(ctx)`
  (`removeHandler`, `removeAllListeners`, clear intervals, unmount).
- `onConfigChange(newConfig)` reads only fields that exist in the schema.
- The contexts used match the declared sections (renderer code only uses `RendererContext` members;
  backend only `BackendContext` members — e.g. renderer has `invoke`, backend has `handle`, not vice-versa).

---

## 8. Failure-pattern catalog

Real boundary bugs this catches (generalized — watch for the shape, not just these instances):

| Pattern | Boundary | Symptom |
|---------|----------|---------|
| Backend returns bare array, renderer expects `{ items }` (or reverse) | handle↔invoke | `x.map is not a function` / `undefined` |
| Field-name drift (`thumbnailUrl` vs `thumbnail_url`) | any | value silently `undefined` |
| Channel used on one side only | any IPC | call never resolves / handler never fires |
| `as`-cast hiding a divergent shape | handle↔invoke | compiles, crashes at runtime |
| Config field read but not in schema | config | `undefined`, default never applies |
| Schema field never in `menu.ts` | config | user can't change a setting |
| `ipc.on` with no `removeAllListeners` in `stop` | push | leaked listeners, duplicate handlers after reload |
| Handler throws instead of returning structured error | handle↔invoke | renderer `invoke` hangs / unhandled rejection |
| Immediate ack shape read as final-result shape | HTTP/IPC | caller reads a field that isn't there yet |
