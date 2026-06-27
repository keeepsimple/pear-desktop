import is from 'electron-is';

import {
  MACOS_VIBRANCY,
  type GlassSurface,
  type LiquidGlassConfig,
} from './types';
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
