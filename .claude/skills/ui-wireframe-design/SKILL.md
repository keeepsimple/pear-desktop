---
name: ui-wireframe-design
description: Use when turning a feature request into a wireframe, design spec, component breakdown, and IPC/API contract for a pear-desktop (Electron + SolidJS) plugin. Covers layout, UI states, visual taste, and the cross-process contract that frontend and backend build against. Trigger for any "design", "wireframe", "mockup", "UX flow", or "spec a feature" request before implementation.
---

# UI Wireframe & Design Spec

Produce the design artifact the whole pipeline builds from. The deliverable is
`_workspace/01_design_spec.md`. Its most valuable section is the **IPC/API contract** — that
is the binding agreement frontend and backend implement independently.

## Workflow

### 1. Understand the surface
- Identify which plugin contexts the feature touches: `renderer` (UI), `backend` (Electron main),
  `preload` (bridge), `menu` (settings), `config` (persisted state). Most features need a subset.
- Read 1–2 sibling plugins under `src/plugins/` to match existing structure and conventions.

### 2. Wireframe (layout + states)
Sketch the layout in ASCII or structured prose. This is a desktop music app — think in panels,
the player bar, overlays, menus, and lists. Define **every state** each view can be in:
`empty`, `loading`, `error`, `populated`. A wireframe that only shows the happy path is incomplete.

### 3. Component breakdown
List each component with: its responsibility, its props (inputs), its local signals (state), and
which contract channels/config it reads or writes. One row per component.

### 4. IPC/API contract (highest leverage)
Name every cross-process interaction and pin its shape. Use this exact mapping so producer and
consumer can't drift:

| Interaction | Renderer side | Backend side |
|-------------|---------------|--------------|
| Request/response | `ipc.invoke('ch', arg)` → `Promise<R>` | `ipc.handle('ch', listener)` returns `R` |
| Fire-and-forget (→backend) | `ipc.send('ch', arg)` | `ipc.on('ch', listener)` |
| Push (→renderer) | `ipc.on('ch', listener)` | `ipc.send('ch', data)` |
| HTTP (api-server) | caller fetches `METHOD /path` | route returns JSON `R` |

For each entry specify: **channel/path name**, **argument shape**, **return/data shape**. Write
shapes as concrete TypeScript types so both engineers paste the same thing. Avoid bare arrays when
the response may need metadata later — decide wrapping now.

### 5. Config schema
List every persisted field: `name: type = default`. These appear in the plugin `config` object,
get surfaced in `menu.ts`, and are read via `getConfig()`. Naming must be identical across all three.

### 6. Visual spec — design with intent
Invoke the `frontend-design` skill for aesthetic direction. Match pear-desktop's existing look
(dark, music-focused) and reuse existing CSS variables rather than inventing one-offs. Specify
color, typography scale, spacing rhythm, and motion. Avoid templated defaults — make deliberate choices.

## Output

Write `_workspace/01_design_spec.md` with sections: Wireframe · Component Breakdown · IPC/API
Contract · Config Schema · Visual Spec · Open Assumptions (anything you had to assume that affects
the contract). Then SendMessage the contract to both engineers.

## Why the contract matters

If the spec leaves a shape vague, frontend and backend each invent their own — they compile fine
(generics/casts hide it) and crash at runtime when the seams meet. A precise contract is the
cheapest bug prevention in the pipeline.
