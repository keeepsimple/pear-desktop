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
