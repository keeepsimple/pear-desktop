// renderer/index.tsx — createRenderer lifecycle. Mounts the NavButton + the
// slide-out QueuePanel into Solid roots, wires store.subscribe to the shared
// signals, and listens for the main->renderer toggle push (design spec §2, §4).

import { render } from 'solid-js/web';

import { NavButton } from './NavButton';
import { fetchSavedMeta, QueuePanel } from './QueuePanel';
import { config, setConfig, setPanelOpen, setStatus, setTracks } from './state';
import * as store from './store';
import { createRenderer, LoggerPrefix } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import { QueueManagerChannel } from '../types';

import type { QueueTrack, QueueManagerPluginConfig } from '../types';
import type { RendererContext } from '@/types/contexts';

type Ipc = RendererContext<QueueManagerPluginConfig>['ipc'];

// Mount targets for the toggle button, per `buttonPlacement`.
const BUTTON_MOUNTS: Record<
  QueueManagerPluginConfig['buttonPlacement'],
  string
> = {
  'player-bar':
    'ytmusic-player-bar .right-controls-buttons, ytmusic-player-bar .middle-controls-buttons',
  'nav-bar': 'ytmusic-nav-bar #right-content, ytmusic-nav-bar .right-content',
};

export const renderer = createRenderer<
  {
    ipc?: Ipc;
    unsubscribeStore?: () => void;
    disposeButton?: () => void;
    disposePanel?: () => void;
    buttonContainer?: HTMLElement;
    panelContainer?: HTMLElement;
    togglePanelListener?: () => void;
    pushTracks(tracks: QueueTrack[]): void;
    refreshQueue(): void;
    subscribeToQueue(): void;
    mountPanel(): void;
    mountButton(
      placement: QueueManagerPluginConfig['buttonPlacement'],
    ): Promise<void>;
    unmountButton(): void;
  },
  QueueManagerPluginConfig
>({
  pushTracks(tracks: QueueTrack[]) {
    setTracks(tracks);
    setStatus(tracks.length === 0 ? 'empty' : 'ok');
  },

  refreshQueue() {
    if (!store.getQueueElement()) {
      setTracks([]);
      setStatus('error');
      return;
    }
    this.pushTracks(store.readQueue());
  },

  subscribeToQueue() {
    this.unsubscribeStore?.();
    this.refreshQueue();
    this.unsubscribeStore = store.subscribe((tracks) =>
      this.pushTracks(tracks),
    );
  },

  mountPanel() {
    if (this.panelContainer) return;
    const container = document.createElement('div');
    container.id = 'queue-manager-root';
    document.body.append(container);
    this.panelContainer = container;
    this.disposePanel = render(
      () => (
        <QueuePanel ipc={this.ipc!} onRetry={() => this.subscribeToQueue()} />
      ),
      container,
    );
  },

  async mountButton(placement) {
    if (this.buttonContainer) return;
    const target = await waitForElement<HTMLElement>(BUTTON_MOUNTS[placement], {
      maxRetry: 100,
      retryInterval: 200,
    }).catch(() => null);
    if (!target) {
      console.warn(
        LoggerPrefix,
        `[queue-manager] could not find a mount point for the toggle button (${placement})`,
      );
      return;
    }

    const container = document.createElement('span');
    container.classList.add('qm-nav-button-host');
    target.prepend(container);
    this.buttonContainer = container;
    this.disposeButton = render(() => <NavButton />, container);
  },

  unmountButton() {
    this.disposeButton?.();
    this.disposeButton = undefined;
    this.buttonContainer?.remove();
    this.buttonContainer = undefined;
  },

  async start(ctx: RendererContext<QueueManagerPluginConfig>) {
    this.ipc = ctx.ipc;
    const currentConfig = await ctx.getConfig();
    setConfig(currentConfig);

    // Cheap saved-snapshot metadata so "Restore" reflects reality immediately.
    await fetchSavedMeta(ctx.ipc).catch((error) =>
      console.warn(
        LoggerPrefix,
        '[queue-manager] failed to load saved meta',
        error,
      ),
    );

    // Global-hotkey toggle push from main (ch.4).
    this.togglePanelListener = () => setPanelOpen((open) => !open);
    ctx.ipc.on(QueueManagerChannel.togglePanel, this.togglePanelListener);

    this.mountPanel();

    // Wait for the queue element before the first read + subscription.
    await waitForElement('#queue', { maxRetry: 150, retryInterval: 200 }).catch(
      () => null,
    );
    this.subscribeToQueue();

    if (currentConfig.showButton) {
      await this.mountButton(currentConfig.buttonPlacement);
    }
  },

  onConfigChange(newConfig: QueueManagerPluginConfig) {
    const previous = config();
    setConfig(newConfig);
    // savedQueue and other settings churn here on every snapshot save — only
    // touch the button when its own settings changed (design spec §3).
    if (!previous) return;
    const placementChanged =
      previous.buttonPlacement !== newConfig.buttonPlacement;
    const visibilityChanged = previous.showButton !== newConfig.showButton;
    if (!placementChanged && !visibilityChanged) return;

    this.unmountButton();
    if (newConfig.showButton) {
      this.mountButton(newConfig.buttonPlacement).catch(() => {});
    }
  },

  stop(ctx: RendererContext<QueueManagerPluginConfig>) {
    this.unsubscribeStore?.();
    this.unsubscribeStore = undefined;

    if (this.togglePanelListener) {
      ctx.ipc.removeAllListeners(QueueManagerChannel.togglePanel);
      this.togglePanelListener = undefined;
    }

    this.unmountButton();

    this.disposePanel?.();
    this.disposePanel = undefined;
    this.panelContainer?.remove();
    this.panelContainer = undefined;

    setPanelOpen(false);
    setTracks([]);
    setStatus('empty');
  },
});
