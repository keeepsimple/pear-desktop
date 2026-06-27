---
name: solid-renderer-dev
description: Use when implementing the renderer (UI) side of a pear-desktop plugin — SolidJS components, signals, styles, settings menu, and wiring UI to the backend via the IPC bridge. Trigger for "build the frontend", "renderer.tsx", "SolidJS component", "settings menu", or any renderer-side work against a design contract.
---

# SolidJS Renderer Development

Implement the UI defined in `_workspace/01_design_spec.md` inside `src/plugins/{name}/`,
consuming exactly the IPC/config shapes the contract defines.

## SolidJS essentials (not React)

Reactivity is fine-grained and tracked through getters — the mental model differs from React:

- State: `const [val, setVal] = createSignal(initial)`. Read with `val()`, set with `setVal(next)`.
- **Never destructure props** — `props.foo` stays reactive; `const { foo } = props` freezes it.
- Derived values: `createMemo(() => …)`. Side effects: `createEffect(() => …)` (auto-tracks deps).
- Cleanup: `onCleanup(() => …)` inside effects/components. Mount work: `onMount(() => …)`.
- Control flow in JSX: `<Show when={cond()}>`, `<For each={list()}>{item => …}</For>`,
  `<Index>` for index-stable lists. Don't use `.map()` in JSX for reactive lists.
- Components run **once** — logic that must re-run goes in effects/memos, not the component body.

## Plugin renderer shape

Renderer lives in `renderer.tsx` (or `.ts`), styles in `style.css`, settings in `menu.ts`.
Follow the `createPlugin` lifecycle:

```ts
renderer: {
  start(ctx) { /* mount UI, register ipc listeners */ },
  stop(ctx) { /* unmount, ctx.ipc.removeAllListeners('ch') */ },
  onConfigChange(newConfig) { /* react to settings change */ },
  onPlayerApiReady(playerApi, ctx) { /* when you need the music player API */ },
}
```

Read a sibling renderer (e.g. `src/plugins/downloader/renderer.tsx`) to match conventions.

## Talking to the backend (the contract)

Use `ctx.ipc` only — never reach into Electron directly from the renderer:

- Request/response: `const r = await ctx.ipc.invoke('ch', arg)` — `ch` and the awaited shape MUST
  match the backend's `ipc.handle('ch', …)` return. Branch on the structured error the backend returns.
- Fire-and-forget: `ctx.ipc.send('ch', arg)`.
- Backend push: `ctx.ipc.on('ch', listener)` — **always** pair with `removeAllListeners('ch')` in `stop`.
- Config: `await ctx.getConfig()` to read, `ctx.setConfig({ field })` to persist.

**Do not `as`-cast an `invoke` result to force a shape.** If what you get back doesn't match the
contract, that's a real mismatch — SendMessage `backend-engineer` and reconcile the contract.

## Settings menu

`menu.ts` returns `Electron.MenuItemConstructorOptions[]` from `menu(ctx)`. Surface each config
field with the exact name from the schema. Toggle/checkbox items call `ctx.setConfig(...)`.

## Styling

Implement the visual spec. Reuse existing CSS variables and app classes; scope new rules to the
plugin. Honor every UI state from the wireframe — render `loading`/`empty`/`error`, not just data.

## Output

Write the renderer files, then record in `_workspace/02_frontend_notes.md` every channel and config
field consumed, with the shape you expect. QA cross-checks this against the backend notes.
