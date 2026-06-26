# Liquid Glass Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `liquid-glass` plugin that gives pear-desktop a Liquid Glass look — translucent, album-tinted frosted glass on the chrome surfaces (nav, sidebar, player bar, menus).

**Architecture:** A self-contained plugin under `src/plugins/liquid-glass/` following the existing `createPlugin` pattern. Renderer injects glass CSS via `adoptedStyleSheets` and drives it with CSS custom properties; the macOS backend adds native `setVibrancy` for real desktop blur. Album tint reuses `album-color-theme`'s `--ytmusic-album-color` variable with a neutral fallback.

**Tech Stack:** Electron 42, SolidJS, TypeScript 7, electron-vite, `electron-is`, oxlint/oxfmt, Playwright (`_electron`) for runtime verification.

## Global Constraints

- Plugins are auto-discovered by glob `src/plugins/*/index.{js,ts,jsx,tsx}` (see `vite-plugins/plugin-importer.mts`) — creating the folder registers the plugin; **no manual registration**.
- All user-facing strings go through `t('plugins.liquid-glass...')`; keys live in `src/i18n/resources/en.json` only (other locales fall back to English). Keep the `plugins` object alphabetically ordered.
- Every native (`setVibrancy` / window) call MUST be guarded by `is.macOS()`; the backend is inert on Windows/Linux.
- The plugin MUST NOT create timers, `MutationObserver`s, or per-song event listeners (memory-leak audit constraint). Tint rides on the CSS variable `album-color-theme` already maintains.
- `start()` registrations MUST be fully undone in `stop()` (adopted stylesheet cleared; vibrancy + window background restored).
- Touch only `src/plugins/liquid-glass/` and `src/i18n/resources/en.json`. No other core files.
- This codebase has **no unit-test framework for plugins** (only one Playwright e2e file). Verification per task = `pnpm typecheck` + `pnpm oxlint <files>` + `pnpm oxfmt --check <files>`, and where behavior is observable, the Playwright `_electron` driver from Task 6. Do not invent unit tests that cannot run.
- Default config values (from spec): `blur: 18`, `opacity: 0.45`, `tintStrength: 0.35`, `specular: true`, `nativeVibrancy: true`, `vibrancyMaterial: 'under-window'`, `surfaces: ['nav','sidebar','player','menu']`, `enabled: false`.

---

### Task 1: Types + i18n + minimal registered plugin

Scaffolds the plugin so it appears in the app (disabled), with config types and translations. No glass behavior yet.

**Files:**
- Create: `src/plugins/liquid-glass/types.ts`
- Create: `src/plugins/liquid-glass/index.ts`
- Modify: `src/i18n/resources/en.json` (add `plugins.liquid-glass` block, alphabetical — between `l16` keys; place after `"lastfm"`/`"lumiastream"` neighbors, before `"music-together"`)

**Interfaces:**
- Produces: `LiquidGlassConfig` (type), `VibrancyMaterial` (enum), `GlassSurface` (type), `MACOS_VIBRANCY` (array), `defaultConfig` (const in index.ts). Later tasks import these from `./types`.

```ts
// types.ts — exact content
export enum VibrancyMaterial {
  UNDER_WINDOW = 'under-window',
  UNDER_PAGE = 'under-page',
  CONTENT = 'content',
  FULLSCREEN_UI = 'fullscreen-ui',
  WINDOW = 'window',
}

export const MACOS_VIBRANCY = [
  VibrancyMaterial.UNDER_WINDOW,
  VibrancyMaterial.UNDER_PAGE,
  VibrancyMaterial.CONTENT,
  VibrancyMaterial.FULLSCREEN_UI,
  VibrancyMaterial.WINDOW,
];

export type GlassSurface = 'nav' | 'sidebar' | 'player' | 'menu';

export type LiquidGlassConfig = {
  enabled: boolean;
  blur: number; // px, 0..40
  opacity: number; // 0..1
  tintStrength: number; // 0..1 (0 = neutral frosted)
  specular: boolean;
  nativeVibrancy: boolean; // macOS only
  vibrancyMaterial: VibrancyMaterial;
  surfaces: GlassSurface[];
};
```

- [ ] **Step 1: Write `types.ts`** with the exact content above.

- [ ] **Step 2: Write a minimal `index.ts`** (registers, disabled, no behavior yet):

```ts
import { VibrancyMaterial, type LiquidGlassConfig } from './types';
import { t } from '@/i18n';
import { createPlugin } from '@/utils';

export const defaultConfig: LiquidGlassConfig = {
  enabled: false,
  blur: 18,
  opacity: 0.45,
  tintStrength: 0.35,
  specular: true,
  nativeVibrancy: true,
  vibrancyMaterial: VibrancyMaterial.UNDER_WINDOW,
  surfaces: ['nav', 'sidebar', 'player', 'menu'],
};

export default createPlugin({
  name: () => t('plugins.liquid-glass.name'),
  description: () => t('plugins.liquid-glass.description'),
  addedVersion: '3.11.x',
  restartNeeded: false,
  config: defaultConfig,
});
```

- [ ] **Step 3: Add i18n keys** to `src/i18n/resources/en.json` inside the `plugins` object (alphabetical position), exactly:

```json
    "liquid-glass": {
      "description": "Frosted, album-tinted glass for the nav bar, sidebar, player bar and menus",
      "name": "Liquid Glass",
      "menu": {
        "blur": { "label": "Blur", "submenu": { "px": "{{value}}px" } },
        "opacity": { "label": "Glass opacity", "submenu": { "percent": "{{value}}%" } },
        "tint": { "label": "Album tint", "submenu": { "percent": "{{value}}%" } },
        "specular": { "label": "Specular edge highlight" },
        "nativeVibrancy": { "label": "Native window blur (macOS)" },
        "material": {
          "label": "Vibrancy material (macOS)",
          "submenu": {
            "under-window": "Under Window",
            "under-page": "Under Page",
            "content": "Content",
            "fullscreen-ui": "Fullscreen UI",
            "window": "Window"
          }
        },
        "surfaces": {
          "label": "Surfaces",
          "submenu": { "nav": "Nav bar", "sidebar": "Sidebar", "player": "Player bar", "menu": "Menus" }
        },
        "hint": { "albumColor": "Enable \"Album Color Theme\" for the album tint" }
      }
    },
```

- [ ] **Step 4: Verify gates pass.**

Run:
```bash
pnpm typecheck
pnpm oxlint src/plugins/liquid-glass/types.ts src/plugins/liquid-glass/index.ts
pnpm oxfmt --check src/plugins/liquid-glass src/i18n/resources/en.json
node -e "JSON.parse(require('fs').readFileSync('src/i18n/resources/en.json','utf8'));console.log('en.json valid')"
```
Expected: typecheck exit 0; oxlint exit 0; oxfmt reports correct format (run `pnpm oxfmt --write` first if it complains, then re-check); `en.json valid`.

- [ ] **Step 5: Commit.**

```bash
git add src/plugins/liquid-glass/types.ts src/plugins/liquid-glass/index.ts src/i18n/resources/en.json
git commit -m "feat(liquid-glass): scaffold plugin types, config and i18n"
```

---

### Task 2: Glass CSS + renderer (CSS layer, no native yet)

Adds the visible glass on chrome surfaces, driven by CSS custom properties, applied/removed cleanly. Album tint via `--ytmusic-album-color` with neutral fallback.

**Files:**
- Create: `src/plugins/liquid-glass/style.css`
- Modify: `src/plugins/liquid-glass/index.ts` (add `stylesheets` + `renderer`)

**Interfaces:**
- Consumes: `defaultConfig`, `LiquidGlassConfig`, `GlassSurface` from Task 1.
- Produces: renderer sets CSS vars `--lg-blur`, `--lg-opacity`, `--lg-tint` on `document.documentElement` and toggles body classes `liquid-glass`, `lg-specular`, `lg-surface-{nav|sidebar|player|menu}`. `style.css` reads these. Later tasks rely on these class/var names.

- [ ] **Step 1: Write `style.css`** (`?inline`-imported). Selectors for nav come from `blur-nav-bar`; sidebar/player/menu selectors are YouTube Music elements — validate/adjust against the running app in Task 6.

```css
/* Driven by CSS custom properties set by the renderer.
   Tint reuses album-color-theme's --ytmusic-album-color ("R, G, B");
   fallback to neutral white when that plugin is disabled. */
.liquid-glass {
  --lg-tint-rgb: var(--ytmusic-album-color, 255, 255, 255);
}

/* shared glass surface mixin via :is() groups */
.liquid-glass.lg-surface-nav #nav-bar-background,
.liquid-glass.lg-surface-nav ytmusic-tabs,
.liquid-glass.lg-surface-sidebar #guide-wrapper,
.liquid-glass.lg-surface-sidebar ytmusic-guide-renderer,
.liquid-glass.lg-surface-player ytmusic-player-bar,
.liquid-glass.lg-surface-menu tp-yt-paper-listbox,
.liquid-glass.lg-surface-menu ytmusic-menu-popup-renderer {
  background-color: rgba(18, 18, 18, var(--lg-opacity)) !important;
  background-image: linear-gradient(
    rgba(var(--lg-tint-rgb), calc(var(--lg-tint) * 0.6)),
    rgba(var(--lg-tint-rgb), calc(var(--lg-tint) * 0.6))
  ) !important;
  backdrop-filter: blur(var(--lg-blur)) saturate(180%) !important;
  -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(180%) !important;
}

.liquid-glass.lg-specular.lg-surface-nav #nav-bar-background,
.liquid-glass.lg-specular.lg-surface-player ytmusic-player-bar,
.liquid-glass.lg-specular.lg-surface-menu tp-yt-paper-listbox {
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22) !important;
}

.liquid-glass.lg-surface-menu tp-yt-paper-listbox,
.liquid-glass.lg-surface-menu ytmusic-menu-popup-renderer {
  border-radius: 14px !important;
  overflow: hidden !important;
}
```

- [ ] **Step 2: Rewrite `index.ts`** to add the stylesheet and renderer (keep Task 1 imports + `defaultConfig`):

```ts
import style from './style.css?inline';
import { VibrancyMaterial, type LiquidGlassConfig, type GlassSurface } from './types';
import { t } from '@/i18n';
import { createPlugin } from '@/utils';

export const defaultConfig: LiquidGlassConfig = {
  enabled: false,
  blur: 18,
  opacity: 0.45,
  tintStrength: 0.35,
  specular: true,
  nativeVibrancy: true,
  vibrancyMaterial: VibrancyMaterial.UNDER_WINDOW,
  surfaces: ['nav', 'sidebar', 'player', 'menu'],
};

const ALL_SURFACES: GlassSurface[] = ['nav', 'sidebar', 'player', 'menu'];

export default createPlugin({
  name: () => t('plugins.liquid-glass.name'),
  description: () => t('plugins.liquid-glass.description'),
  addedVersion: '3.11.x',
  restartNeeded: false,
  config: defaultConfig,
  stylesheets: [style],
  renderer: {
    styleSheet: null as CSSStyleSheet | null,
    applyVars(this: { props?: LiquidGlassConfig }, config: LiquidGlassConfig) {
      const root = document.documentElement;
      root.style.setProperty('--lg-blur', `${config.blur}px`);
      root.style.setProperty('--lg-opacity', config.opacity.toString());
      root.style.setProperty('--lg-tint', config.tintStrength.toString());
      const body = document.body;
      body.classList.toggle('liquid-glass', config.enabled);
      body.classList.toggle('lg-specular', config.enabled && config.specular);
      for (const s of ALL_SURFACES) {
        body.classList.toggle(
          `lg-surface-${s}`,
          config.enabled && config.surfaces.includes(s),
        );
      }
    },
    async start({ getConfig }) {
      this.styleSheet = new CSSStyleSheet();
      await this.styleSheet.replace(style);
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        this.styleSheet,
      ];
      this.applyVars(await getConfig());
    },
    onConfigChange(newConfig: LiquidGlassConfig) {
      this.applyVars(newConfig);
    },
    async stop() {
      await this.styleSheet?.replace('');
      const root = document.documentElement;
      root.style.removeProperty('--lg-blur');
      root.style.removeProperty('--lg-opacity');
      root.style.removeProperty('--lg-tint');
      const body = document.body;
      body.classList.remove('liquid-glass', 'lg-specular');
      for (const s of ALL_SURFACES) body.classList.remove(`lg-surface-${s}`);
    },
  },
});
```

- [ ] **Step 3: Verify gates.**

Run:
```bash
pnpm typecheck
pnpm oxlint src/plugins/liquid-glass
pnpm oxfmt --check src/plugins/liquid-glass
pnpm build
```
Expected: all exit 0 (run `pnpm oxfmt --write src/plugins/liquid-glass` if format check fails).

- [ ] **Step 4: Commit.**

```bash
git add src/plugins/liquid-glass/style.css src/plugins/liquid-glass/index.ts
git commit -m "feat(liquid-glass): add CSS glass layer and renderer wiring"
```

---

### Task 3: Settings menu

Exposes the config knobs so the look is tunable from the app menu.

**Files:**
- Create: `src/plugins/liquid-glass/menu.ts`
- Modify: `src/plugins/liquid-glass/index.ts` (wire `menu: onMenu`)

**Interfaces:**
- Consumes: `LiquidGlassConfig`, `VibrancyMaterial`, `MACOS_VIBRANCY`, `GlassSurface` from `./types`.
- Produces: `onMenu` (async `MenuContext<LiquidGlassConfig> => MenuTemplate`).

- [ ] **Step 1: Write `menu.ts`** (mirrors `transparent-player/menu.ts`):

```ts
import is from 'electron-is';

import { MACOS_VIBRANCY, type GlassSurface, type LiquidGlassConfig } from './types';
import { t } from '@/i18n';

import type { MenuTemplate } from '@/menu';
import type { MenuContext } from '@/types/contexts';

const blurList = [0, 6, 12, 18, 24, 32, 40];
const percentList = [0, 0.15, 0.25, 0.35, 0.45, 0.6, 0.75, 0.9, 1];
const surfaceList: GlassSurface[] = ['nav', 'sidebar', 'player', 'menu'];

export const onMenu = async ({
  getConfig,
  setConfig,
}: MenuContext<LiquidGlassConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();

  const menu: MenuTemplate = [
    {
      label: t('plugins.liquid-glass.menu.blur.label'),
      submenu: blurList.map((value) => ({
        label: t('plugins.liquid-glass.menu.blur.submenu.px', { value }),
        type: 'radio',
        checked: config.blur === value,
        click() {
          setConfig({ blur: value });
        },
      })),
    },
    {
      label: t('plugins.liquid-glass.menu.opacity.label'),
      submenu: percentList.map((value) => ({
        label: t('plugins.liquid-glass.menu.opacity.submenu.percent', {
          value: Math.round(value * 100),
        }),
        type: 'radio',
        checked: config.opacity === value,
        click() {
          setConfig({ opacity: value });
        },
      })),
    },
    {
      label: t('plugins.liquid-glass.menu.tint.label'),
      submenu: percentList.map((value) => ({
        label: t('plugins.liquid-glass.menu.tint.submenu.percent', {
          value: Math.round(value * 100),
        }),
        type: 'radio',
        checked: config.tintStrength === value,
        click() {
          setConfig({ tintStrength: value });
        },
      })),
    },
    {
      label: t('plugins.liquid-glass.menu.specular.label'),
      type: 'checkbox',
      checked: config.specular,
      click(item) {
        setConfig({ specular: item.checked });
      },
    },
    {
      label: t('plugins.liquid-glass.menu.surfaces.label'),
      submenu: surfaceList.map((surface) => ({
        label: t(`plugins.liquid-glass.menu.surfaces.submenu.${surface}`),
        type: 'checkbox',
        checked: config.surfaces.includes(surface),
        click(item) {
          const next = item.checked
            ? [...new Set([...config.surfaces, surface])]
            : config.surfaces.filter((s) => s !== surface);
          setConfig({ surfaces: next });
        },
      })),
    },
  ];

  if (is.macOS()) {
    menu.push(
      {
        label: t('plugins.liquid-glass.menu.nativeVibrancy.label'),
        type: 'checkbox',
        checked: config.nativeVibrancy,
        click(item) {
          setConfig({ nativeVibrancy: item.checked });
        },
      },
      {
        label: t('plugins.liquid-glass.menu.material.label'),
        submenu: MACOS_VIBRANCY.map((material) => ({
          label: t(`plugins.liquid-glass.menu.material.submenu.${material}`),
          type: 'radio',
          checked: config.vibrancyMaterial === material,
          click() {
            setConfig({ vibrancyMaterial: material });
          },
        })),
      },
    );
  }

  return menu;
};
```

- [ ] **Step 2: Wire the menu in `index.ts`.** Add the import and the `menu` field.

Add near the other imports:
```ts
import { onMenu } from './menu';
```
Add `menu: onMenu,` to the `createPlugin({...})` object (e.g. directly after `stylesheets: [style],`).

- [ ] **Step 3: Verify gates.**

Run:
```bash
pnpm typecheck
pnpm oxlint src/plugins/liquid-glass
pnpm oxfmt --check src/plugins/liquid-glass
```
Expected: all exit 0.

- [ ] **Step 4: Commit.**

```bash
git add src/plugins/liquid-glass/menu.ts src/plugins/liquid-glass/index.ts
git commit -m "feat(liquid-glass): add settings menu for glass tuning"
```

---

### Task 4: Native macOS vibrancy backend

Adds the real desktop-blur layer on macOS, with full restore on disable.

**Files:**
- Create: `src/plugins/liquid-glass/backend.ts`
- Modify: `src/plugins/liquid-glass/index.ts` (wire `backend`)

**Interfaces:**
- Consumes: `LiquidGlassConfig`, `VibrancyMaterial`, `MACOS_VIBRANCY` from `./types`.
- Produces: `backend` (a `createBackend` object) imported by `index.ts`.

- [ ] **Step 1: Write `backend.ts`** (mirrors `transparent-player/backend.ts`, adds guards + restore + try/catch degradation):

```ts
import is from 'electron-is';

import { MACOS_VIBRANCY, type LiquidGlassConfig } from './types';
import { createBackend, LoggerPrefix } from '@/utils';

import type { BackendContext } from '@/types/contexts';
import type { BrowserWindow } from 'electron';

const apply = (window: BrowserWindow, config: LiquidGlassConfig) => {
  if (!is.macOS()) return;
  try {
    if (config.nativeVibrancy && MACOS_VIBRANCY.includes(config.vibrancyMaterial)) {
      window.setVibrancy(
        config.vibrancyMaterial as Parameters<BrowserWindow['setVibrancy']>[0],
      );
    } else {
      window.setVibrancy(null);
    }
  } catch (err) {
    // Unsupported material/OS version: degrade to the CSS-only layer.
    console.warn(LoggerPrefix, 'liquid-glass: setVibrancy failed', err);
    window.setVibrancy(null);
  }
};

const restore = (window: BrowserWindow) => {
  if (!is.macOS()) return;
  window.setVibrancy(null);
};

export const backend = createBackend({
  window: null as BrowserWindow | null,
  async start({ window, getConfig }: BackendContext<LiquidGlassConfig>) {
    this.window = window;
    apply(window, await getConfig());
  },
  onConfigChange(newConfig: LiquidGlassConfig) {
    if (this.window) apply(this.window, newConfig);
  },
  stop({ window }: BackendContext<LiquidGlassConfig>) {
    restore(window);
    this.window = null;
  },
});
```

> If `LoggerPrefix` is not exported from `@/utils`, drop that import and the prefix arg — confirm with `grep -n "export const LoggerPrefix" src/utils/index.ts` (it is used in `src/loader/main.ts`).

- [ ] **Step 2: Wire the backend in `index.ts`.** Add `import { backend } from './backend';` and add `backend,` to the `createPlugin({...})` object.

- [ ] **Step 3: Verify gates + build.**

Run:
```bash
pnpm typecheck
pnpm oxlint src/plugins/liquid-glass
pnpm oxfmt --check src/plugins/liquid-glass
pnpm build
```
Expected: all exit 0.

- [ ] **Step 4: Commit.**

```bash
git add src/plugins/liquid-glass/backend.ts src/plugins/liquid-glass/index.ts
git commit -m "feat(liquid-glass): add native macOS vibrancy backend with restore"
```

---

### Task 5: Coexistence hint with album-color-theme

Surfaces a non-blocking hint when the album tint source is off, so the "tinted" look isn't silently neutral. (No hard dependency; pure UX.)

**Files:**
- Modify: `src/plugins/liquid-glass/menu.ts`

**Interfaces:**
- Consumes: `window.mainConfig.plugins.isEnabled(id)` — the same API `transparent-player/index.ts` uses (`await window.mainConfig.plugins.isEnabled('album-color-theme')`). NOTE: this is a **renderer** global; the menu runs in the **main** process, so use the main-side config instead.

- [ ] **Step 1: Add an album-tint hint** at the top of the returned menu in `menu.ts`. The menu runs in main; read plugin-enabled state via the main `config` module. Add near the imports:

```ts
import * as config from '@/config';
```
Then build a leading hint item (disabled/non-clickable) when album-color-theme is off and tint > 0. Insert this just before `return menu;` is constructed — i.e. compute first, then unshift:

```ts
  const albumThemeOn =
    (config.get('plugins.album-color-theme') as { enabled?: boolean } | undefined)
      ?.enabled ?? false;
  if (!albumThemeOn && config.tintStrength > 0) {
    menu.unshift({
      label: t('plugins.liquid-glass.menu.hint.albumColor'),
      enabled: false,
    });
  }
```

> `config.tintStrength` is wrong — use the already-fetched `config` object's field. Since the local variable is named `config` (the fetched `LiquidGlassConfig`) AND the module import is also `config`, rename the import to avoid the clash: `import * as appConfig from '@/config';` and use `appConfig.get(...)`. Apply that rename.

Corrected snippet:
```ts
// at imports:
import * as appConfig from '@/config';

// before `return menu;`:
const albumThemeOn =
  (appConfig.get('plugins.album-color-theme') as { enabled?: boolean } | undefined)
    ?.enabled ?? false;
if (!albumThemeOn && config.tintStrength > 0) {
  menu.unshift({ label: t('plugins.liquid-glass.menu.hint.albumColor'), enabled: false });
}
```

- [ ] **Step 2: Verify gates.**

Run:
```bash
pnpm typecheck
pnpm oxlint src/plugins/liquid-glass
pnpm oxfmt --check src/plugins/liquid-glass
```
Expected: all exit 0. If `appConfig.get` rejects the dynamic key type, cast the key: `appConfig.get('plugins.album-color-theme' as never)` — keep the runtime string identical.

- [ ] **Step 3: Commit.**

```bash
git add src/plugins/liquid-glass/menu.ts
git commit -m "feat(liquid-glass): hint to enable album-color-theme for tint"
```

---

### Task 6: Runtime verification (Playwright `_electron`) + selector validation

Confirms the plugin enables/disables cleanly (window fully restored — the lifecycle concern from earlier fixes) and that the glass renders. Validates/repairs the YTM selectors used in `style.css`.

**Files:**
- Temporary: `.drive-liquid-glass.mjs` (created in project root, removed at the end — do not commit)
- Possibly modify: `src/plugins/liquid-glass/style.css` (selector fixes found here)

- [ ] **Step 1: Build the app.**

Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 2: Write the driver** to `.drive-liquid-glass.mjs` (project root so it resolves `@playwright/test`):

```js
import { _electron as electron } from '@playwright/test';
import * as path from 'node:path';

const APP_DIR = process.cwd();
const BIN = path.join(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');

let mainLog = '';
const wd = setTimeout(() => { console.log('WATCHDOG'); process.exit(99); }, 100_000);
wd.unref();

const app = await electron.launch({ executablePath: BIN, args: ['.', '--no-sandbox'], cwd: APP_DIR, timeout: 60_000 });
app.process().stdout?.on('data', (d) => (mainLog += d));
app.process().stderr?.on('data', (d) => (mainLog += d));

const page = await app.firstWindow({ timeout: 30_000 });
let rendererLog = '';
page.on('console', (m) => (rendererLog += `[${m.type()}] ${m.text()}\n`));
page.on('pageerror', (e) => (rendererLog += `[pageerror] ${e.message}\n`));
await new Promise((r) => setTimeout(r, 9_000));

const seq = [{ enabled: true }, { enabled: false }, { enabled: true }, { enabled: false }];
for (const obj of seq) {
  await page.evaluate((o) => window.ipcRenderer.invoke('peard:set-config', 'liquid-glass', o), obj);
  await new Promise((r) => setTimeout(r, 900));
}
// Enable once more and inspect applied state.
await page.evaluate(() => window.ipcRenderer.invoke('peard:set-config', 'liquid-glass', { enabled: true }));
await new Promise((r) => setTimeout(r, 1200));
const state = await page.evaluate(() => ({
  hasClass: document.body.classList.contains('liquid-glass'),
  blur: getComputedStyle(document.documentElement).getPropertyValue('--lg-blur').trim(),
  navMatched: !!document.querySelector('#nav-bar-background'),
  playerMatched: !!document.querySelector('ytmusic-player-bar'),
}));
console.log('STATE', JSON.stringify(state));
try { await page.screenshot({ path: '/tmp/liquid-glass.png' }); console.log('shot /tmp/liquid-glass.png'); } catch {}

const bad = /second handler|load-failed|unload-failed/i;
const hits = (mainLog + rendererLog).split('\n').filter((l) => bad.test(l));
console.log('error hits:', hits.length);
hits.forEach((l) => console.log('  >', l));
await app.close();
console.log(hits.length === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
```

- [ ] **Step 3: Run the driver.**

Run: `node .drive-liquid-glass.mjs 2>&1 | tail -40`
Expected: `RESULT: PASS` (0 error hits), `STATE` shows `hasClass:true`, `blur:"18px"`, and `navMatched`/`playerMatched` `true`.

- [ ] **Step 4: Fix selectors if needed.** If `navMatched`/`playerMatched` is `false`, the YTM selector changed. Inspect live: add a temporary `page.evaluate` listing candidate elements (e.g. `[...document.querySelectorAll('*')].filter(e=>e.tagName.toLowerCase().includes('player-bar')).map(e=>e.tagName)`), update the selectors in `style.css`, rebuild (`pnpm build`), and re-run Step 3 until matched. Open `/tmp/liquid-glass.png` to visually confirm glass appears.

- [ ] **Step 5: Clean up + final gate.**

Run:
```bash
rm -f .drive-liquid-glass.mjs
pnpm typecheck && pnpm oxlint src/plugins/liquid-glass && pnpm oxfmt --check src/plugins/liquid-glass && pnpm build
```
Expected: all exit 0; `.drive-liquid-glass.mjs` gone (never committed).

- [ ] **Step 6: Commit any selector fixes.**

```bash
git add src/plugins/liquid-glass/style.css
git commit -m "fix(liquid-glass): align glass selectors with live YTM DOM" || echo "no selector changes to commit"
```

---

## Self-Review

**Spec coverage:**
- Hybrid native + CSS → Task 2 (CSS) + Task 4 (native). ✓
- Chrome surfaces only (nav/sidebar/player/menu) → Task 2 selectors + `surfaces` config. ✓
- Album tint reuse `--ytmusic-album-color` + neutral fallback → Task 2 `--lg-tint-rgb: var(--ytmusic-album-color, 255,255,255)`. ✓
- Config knobs (blur/opacity/tint/specular/nativeVibrancy/material/surfaces) → Task 1 type + Task 3 menu. ✓
- macOS guard + restore → Task 4 (`is.macOS()`, `stop` restores). ✓
- No timers/observers/listeners → none introduced. ✓
- Coexistence (album-color-theme hint; blur-nav-bar/transparent-player overlap) → Task 5 hint; overlap is documented behavior (no crash) per spec. ✓
- Verification typecheck/lint/build + Playwright → each task gates + Task 6. ✓
- Graceful degradation if `setVibrancy` throws → Task 4 try/catch. ✓

**Placeholder scan:** No TBD/TODO. Selector uncertainty is handled by an explicit validation step (Task 6 Step 4), not left vague.

**Type consistency:** `LiquidGlassConfig`, `VibrancyMaterial`, `MACOS_VIBRANCY`, `GlassSurface`, `defaultConfig` used consistently across tasks; CSS var names (`--lg-blur/opacity/tint`) and class names (`liquid-glass`, `lg-specular`, `lg-surface-*`) match between Task 2's renderer and `style.css`.

**Note on Task 5:** the inline correction (rename `config` import to `appConfig`) is folded into the corrected snippet — implement that version, not the first draft.
