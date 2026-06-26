# Liquid Glass — Design Spec

- **Date:** 2026-06-27
- **Status:** Approved (design), pending implementation plan
- **Target:** pear-desktop (YouTube Music desktop — Electron 42 + SolidJS + TypeScript 7)
- **Deliverable:** a new plugin `src/plugins/liquid-glass/` (no core changes)

## Goal

Give the app a "Liquid Glass"–style look: the **chrome** surfaces (left sidebar, top nav
bar, bottom player bar, menus/popups) become translucent frosted glass tinted by the current
album art, while the main content/track list stays readable. True OS-level Apple Liquid Glass
(refraction/lensing APIs) is not reachable from Electron's web layer; we approximate it with a
hybrid of native macOS vibrancy + CSS `backdrop-filter`, plus a specular border and optional
SVG displacement for edge refraction.

## Scope

In scope:
- New plugin `liquid-glass` applying glass styling to chrome surfaces only.
- macOS native window vibrancy layer (blurs the desktop behind the window).
- Cross-platform CSS glass layer (blurs app content behind each panel).
- Album-color tint by reusing `album-color-theme`'s CSS variable, with neutral fallback.
- Settings menu with the config knobs below.

Out of scope (YAGNI):
- Glassifying the main scrolling content/list area (perf + readability risk).
- Custom album-color extraction inside this plugin (reuse `album-color-theme` instead).
- Windows Mica/Acrylic tuning beyond the existing `setBackgroundMaterial` capability.
- Any change to core app files outside `src/plugins/liquid-glass/`.

## Architecture

Three stacked layers:

```
Layer 3 — CSS glass panels (renderer):
  backdrop-filter: blur()+saturate() on sidebar / nav / player bar / menu,
  tinted via rgba(var(--ytmusic-album-color, 255 255 255), tintStrength),
  specular highlight border + rounded corners.
Layer 2 — Transparent window + native vibrancy (backend, macOS only):
  window.setVibrancy(material) + transparent background → blurs the *desktop*
  behind the window at its background/edges.
Layer 1 — Album tint source:
  reuse album-color-theme's `--ytmusic-album-color` (R, G, B) on documentElement;
  fall back to neutral (255 255 255) when that plugin is disabled.
```

Platform behavior:
- **macOS:** Layers 2 + 3 → closest to Liquid Glass (real desktop blur + glass panels).
- **Windows/Linux:** Layer 2 is skipped; Layer 3 (CSS blur of app content behind panels)
  still renders the glass look — it just can't blur the desktop behind the window.

## Components (files)

```
src/plugins/liquid-glass/
├── index.ts      createPlugin({ name, description, addedVersion, restartNeeded,
│                 config, menu, stylesheets, backend, renderer })
├── types.ts      LiquidGlassConfig + macOS vibrancy MaterialType enum + surface keys
├── backend.ts    createBackend — macOS only: setVibrancy + transparent window bg.
│                 stop() restores: setVibrancy(null) + original background color.
├── menu.ts       settings menu (sliders + toggles, see Config)
└── style.css     glass rules for chrome selectors; imported `?inline`
```

- **Renderer** attaches/detaches the stylesheet via `adoptedStyleSheets` (the `blur-nav-bar`
  pattern): build a `CSSStyleSheet`, `replace(style)`, push into `document.adoptedStyleSheets`
  in `start()`; `replace('')` in `stop()`. It also writes the live config values to CSS custom
  properties (e.g. `--lg-blur`, `--lg-opacity`, `--lg-tint`) on `documentElement` so `style.css`
  reads them; updates them in `onConfigChange`.
- **Backend** runs only on macOS (guard with `electron-is`). It mirrors `transparent-player`'s
  `setVibrancy` approach. `stop()` and disable must fully restore the window.
- **No timers, no MutationObserver, no per-song listeners** in this plugin → no new leak surface
  (per the memory-leak audit). Tint updates ride on the CSS variable that `album-color-theme`
  already maintains.

## Data flow

```
album-color-theme (if enabled) ──sets──> --ytmusic-album-color on <html>
                                                   │
config (getConfig) ──> renderer writes --lg-blur/--lg-opacity/--lg-tint on <html>
                                                   │
                          style.css reads both ──> glass panels render tinted
                                                   │
config.nativeVibrancy + macOS ──> backend.setVibrancy(material) ──> desktop blur
```

## Configuration (settings menu)

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `enabled` | boolean | `false` | standard plugin toggle |
| `blur` | number 0–40 (px) | `18` | backdrop-filter blur radius (capped ≤24 in UI guidance for perf) |
| `opacity` | number 0–1 | `0.45` | glass panel background opacity |
| `tintStrength` | number 0–1 | `0.35` | album-color tint amount; `0` = neutral frosted |
| `specular` | boolean | `true` | bright glossy border highlight |
| `nativeVibrancy` | boolean | `true` | macOS only; enables Layer 2. No-op off macOS |
| `vibrancyMaterial` | enum | `under-window` | macOS NSVisualEffectView material |
| `surfaces` | set | all | which chrome surfaces to glassify: nav / sidebar / player / menu |

`restartNeeded`: `false` for the renderer/CSS layer. The native vibrancy layer applies live via
`onConfigChange` in the backend (matching `transparent-player`, which itself is `restartNeeded`
only because of window-flag timing — to be confirmed during implementation; if live `setVibrancy`
proves unreliable, fall back to `restartNeeded: true`).

## Interaction with existing plugins

- **album-color-theme:** reused as the tint source. If disabled, tint falls back to neutral and
  the menu hints that enabling it produces the "living" album tint. No duplicate color extraction.
- **blur-nav-bar:** superseded (both blur the nav bar). Menu recommends disabling `blur-nav-bar`
  when `liquid-glass` is on. They do not crash if both run; the rules just overlap.
- **transparent-player:** both call `setVibrancy` and would fight over the window. They must not
  run simultaneously; the menu warns. (Implementation may detect and surface this via
  `window.mainConfig.plugins.isEnabled('transparent-player')`, as `transparent-player` already
  checks for `album-color-theme`.)

## Performance & safety

- `backdrop-filter` is GPU-costly (noted in the audit). Mitigations: cap blur ≤24px in the UI;
  apply glass only to chrome panels, never the large scrolling list; avoid animating blur.
- The plugin touches only: CSS custom properties + a class/stylesheet + (macOS) window vibrancy.
  It never mutates YouTube Music's internal DOM structure. If Google changes selectors, the glass
  simply stops showing on those nodes — the app keeps working.
- Cleanup: renderer `stop()` clears the adopted stylesheet; backend `stop()` restores vibrancy and
  background. No intervals/observers/listeners are created, so there is no teardown gap.

## Error handling

- Backend guards every native call behind `is.macOS()`; on other platforms the backend is inert.
- Missing `--ytmusic-album-color` → CSS `var(..., 255 255 255)` fallback (neutral), never invalid.
- If `setVibrancy` throws on an unsupported macOS version/material, catch, log, and continue with
  the CSS-only layer (graceful degradation rather than failing the plugin start).

## Testing / verification

- Quality gates: `pnpm typecheck`, `pnpm lint`, `pnpm build` must pass.
- Runtime (via the Playwright `_electron` driver already used in this repo):
  - Enable → disable → enable cycles produce no errors and fully restore the window (no leftover
    vibrancy/transparent background after disable).
  - With `album-color-theme` on, panels pick up the album tint; with it off, panels render neutral
    frosted without errors.
  - Toggling does not throw (backend has a real `stop()` with restore — same class of fix as the
    quality-changer/music-together lifecycle work).
- Manual visual check on macOS: glass over desktop at window background; readable content area.

## Open assumptions

- `transparent-player` is `restartNeeded: true`; whether live `setVibrancy` toggling is reliable
  enough for `liquid-glass` to stay `restartNeeded: false` is confirmed during implementation.
- Exact YTM selectors for sidebar/player-bar/menu are validated against the running app during
  implementation (nav bar selectors are known from `blur-nav-bar`).
