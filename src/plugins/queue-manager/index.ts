import { backend } from './backend';
import { menu } from './menu';
import { renderer } from './renderer';
import style from './style.css?inline';
import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import type { QueueManagerPluginConfig } from './types';

export default createPlugin({
  name: () => t('plugins.queue-manager.name'),
  description: () => t('plugins.queue-manager.description'),
  authors: ['pear-desktop'],
  restartNeeded: false,
  addedVersion: '3.10.X',
  config: {
    enabled: false,
    hotkey: 'CmdOrCtrl+Shift+Q',
    showButton: true,
    buttonPlacement: 'player-bar',
    smartShuffle: true,
    confirmClear: true,
    savedQueue: null,
  } satisfies QueueManagerPluginConfig as QueueManagerPluginConfig,

  menu,
  renderer,
  backend,
  stylesheets: [style],
});
