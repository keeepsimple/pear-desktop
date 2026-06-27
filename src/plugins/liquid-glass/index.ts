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
