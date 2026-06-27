import prompt from 'custom-electron-prompt';

import { t } from '@/i18n';
import promptOptions from '@/providers/prompt-options';

import type { QueueManagerPluginConfig } from './types';
import type { MenuTemplate } from '@/menu';
import type { MenuContext } from '@/types/contexts';

export const menu = async ({
  window,
  getConfig,
  setConfig,
}: MenuContext<QueueManagerPluginConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();

  const promptHotkey = async () => {
    const output = await prompt(
      {
        title: t('plugins.queue-manager.prompt.hotkey.title'),
        label: t('plugins.queue-manager.prompt.hotkey.label'),
        type: 'keybind',
        keybindOptions: [
          {
            value: 'toggle',
            label: t('plugins.queue-manager.prompt.hotkey.toggle'),
            default: config.hotkey,
          },
        ],
        height: 240,
        ...promptOptions(),
      },
      window,
    ).catch(console.error);

    if (!output) return; // cancelled

    const toggle = output.find((entry) => entry.value === 'toggle');
    // An empty accelerator clears the hotkey (button still toggles the panel).
    setConfig({ hotkey: toggle?.accelerator ?? '' });
  };

  return [
    {
      label: t('plugins.queue-manager.menu.set-hotkey'),
      click: promptHotkey,
    },
    {
      label: t('plugins.queue-manager.menu.show-button'),
      type: 'checkbox',
      checked: config.showButton,
      click: (item) => setConfig({ showButton: item.checked }),
    },
    {
      label: t('plugins.queue-manager.menu.button-placement.label'),
      submenu: [
        {
          label: t('plugins.queue-manager.menu.button-placement.player-bar'),
          type: 'radio',
          checked: config.buttonPlacement === 'player-bar',
          click: () => setConfig({ buttonPlacement: 'player-bar' }),
        },
        {
          label: t('plugins.queue-manager.menu.button-placement.nav-bar'),
          type: 'radio',
          checked: config.buttonPlacement === 'nav-bar',
          click: () => setConfig({ buttonPlacement: 'nav-bar' }),
        },
      ],
    },
    {
      label: t('plugins.queue-manager.menu.smart-shuffle'),
      type: 'checkbox',
      checked: config.smartShuffle,
      click: (item) => setConfig({ smartShuffle: item.checked }),
    },
    {
      label: t('plugins.queue-manager.menu.confirm-clear'),
      type: 'checkbox',
      checked: config.confirmClear,
      click: (item) => setConfig({ confirmClear: item.checked }),
    },
  ];
};
