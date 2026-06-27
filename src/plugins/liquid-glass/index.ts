import { backend } from './backend';
import { onMenu } from './menu';
import style from './style.css?inline';
import {
  VibrancyMaterial,
  type LiquidGlassConfig,
  type GlassSurface,
} from './types';
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
  menu: onMenu,
  backend,
  renderer: {
    applyVars(config: LiquidGlassConfig) {
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
      body.classList.toggle(
        'lg-native',
        config.enabled &&
          config.nativeVibrancy &&
          !!(
            window.electronIs &&
            window.electronIs.macOS &&
            window.electronIs.macOS()
          ),
      );
    },
    async start({ getConfig }) {
      this.applyVars(await getConfig());
    },
    onConfigChange(newConfig: LiquidGlassConfig) {
      this.applyVars(newConfig);
    },
    stop() {
      const root = document.documentElement;
      root.style.removeProperty('--lg-blur');
      root.style.removeProperty('--lg-opacity');
      root.style.removeProperty('--lg-tint');
      const body = document.body;
      body.classList.remove('liquid-glass', 'lg-specular', 'lg-native');
      for (const s of ALL_SURFACES) body.classList.remove(`lg-surface-${s}`);
    },
  },
});
