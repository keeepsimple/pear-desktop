import is from 'electron-is';

import { MACOS_VIBRANCY, type LiquidGlassConfig } from './types';
import { createBackend, LoggerPrefix } from '@/utils';

import type { BackendContext } from '@/types/contexts';
import type { BrowserWindow } from 'electron';

const apply = (window: BrowserWindow, config: LiquidGlassConfig) => {
  if (!is.macOS()) return;
  try {
    if (
      config.nativeVibrancy &&
      MACOS_VIBRANCY.includes(config.vibrancyMaterial)
    ) {
      window.setVibrancy(
        config.vibrancyMaterial as Parameters<BrowserWindow['setVibrancy']>[0],
      );
      // Punch the window background fully transparent so the vibrancy
      // material is visible behind the page (the renderer's .lg-native
      // class transparentizes body so the page no longer paints over it).
      window.setBackgroundColor('#00000000');
    } else {
      window.setVibrancy(null);
      window.setBackgroundColor('#000000');
    }
  } catch (err) {
    // Unsupported material/OS version: degrade to the CSS-only layer.
    console.warn(LoggerPrefix, 'liquid-glass: setVibrancy failed', err);
    window.setVibrancy(null);
    window.setBackgroundColor('#000000');
  }
};

const restore = (window: BrowserWindow) => {
  if (!is.macOS()) return;
  try {
    window.setVibrancy(null);
    window.setBackgroundColor('#000000');
  } catch (err) {
    console.warn(LoggerPrefix, 'liquid-glass: restore failed', err);
  }
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
