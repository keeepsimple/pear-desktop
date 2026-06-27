import { globalShortcut } from 'electron';

import { QueueManagerChannel } from './types';
import { createBackend, LoggerPrefix } from '@/utils';

import type {
  QueueManagerPluginConfig,
  SaveQueuePayload,
  SaveQueueResult,
  SavedMeta,
  SavedQueue,
  RestoreQueueResult,
  TogglePanelPayload,
} from './types';
import type { BackendContext } from '@/types/contexts';

/**
 * queue-manager backend — the ENTIRE main-process surface (design spec §0, §4).
 *
 * Responsibilities (and nothing else):
 *   1. Persist the queue snapshot via the plugin config store (setConfig/getConfig).
 *   2. Restore the snapshot (return ids ONLY; the renderer replays them).
 *   3. Expose cheap saved-snapshot metadata.
 *   4. Register the global hotkey and push a toggle event to the renderer.
 *
 * Main NEVER touches the YT Music queue — it only stores/returns video ids.
 */

// The accelerator we currently hold, so we can unregister exactly it on
// stop/reconfigure (never globalShortcut.unregisterAll — that would clobber
// other plugins). Module-scoped: there is one backend per plugin load.
let registeredHotkey: string | null = null;
// Cached so onConfigChange (which only receives the new config) can reach
// ipc.send to push the toggle event.
let backendCtx: BackendContext<QueueManagerPluginConfig> | null = null;

const unregisterHotkey = () => {
  if (registeredHotkey) {
    try {
      globalShortcut.unregister(registeredHotkey);
    } catch (error) {
      console.warn(
        LoggerPrefix,
        '[queue-manager] failed to unregister global hotkey',
        error,
      );
    }
    registeredHotkey = null;
  }
};

const registerHotkey = (hotkey: string) => {
  if (!hotkey) {
    registeredHotkey = null;
    return;
  }

  try {
    const ok = globalShortcut.register(hotkey, () => {
      const payload: TogglePanelPayload = { source: 'hotkey' };
      backendCtx?.ipc.send(QueueManagerChannel.togglePanel, payload);
    });

    if (ok) {
      registeredHotkey = hotkey;
    } else {
      // Already claimed by another app/plugin — the toggle button still works.
      registeredHotkey = null;
      console.warn(
        LoggerPrefix,
        `[queue-manager] could not register global hotkey "${hotkey}" (already in use). The toggle button still works.`,
      );
    }
  } catch (error) {
    registeredHotkey = null;
    console.warn(
      LoggerPrefix,
      `[queue-manager] failed to register global hotkey "${hotkey}"`,
      error,
    );
  }
};

export const backend = createBackend<
  Record<never, never>,
  QueueManagerPluginConfig
>({
  async start(ctx) {
    const { ipc, getConfig } = ctx;
    backendCtx = ctx;

    // --- 1. Persist queue -------------------------------------------------
    ipc.handle(
      QueueManagerChannel.saveQueue,
      async (payload: SaveQueuePayload): Promise<SaveQueueResult> => {
        try {
          const videoIds = Array.isArray(payload?.videoIds)
            ? payload.videoIds.filter(
                (id): id is string => typeof id === 'string',
              )
            : [];

          const savedAt = Date.now();
          const count = videoIds.length;

          const savedQueue: SavedQueue = { videoIds, savedAt, count };
          await ctx.setConfig({ savedQueue });

          return { ok: true, savedAt, count };
        } catch (error) {
          console.error(
            LoggerPrefix,
            '[queue-manager] failed to save queue snapshot',
            error,
          );
          return { ok: false, savedAt: 0, count: 0 };
        }
      },
    );

    // --- 2. Restore queue (return ids only) -------------------------------
    ipc.handle(
      QueueManagerChannel.restoreQueue,
      async (): Promise<RestoreQueueResult> => {
        try {
          const config = await getConfig();
          return config.savedQueue ?? null;
        } catch (error) {
          console.error(
            LoggerPrefix,
            '[queue-manager] failed to read saved queue snapshot',
            error,
          );
          return null;
        }
      },
    );

    // --- 3. Saved metadata ------------------------------------------------
    ipc.handle(
      QueueManagerChannel.getSavedMeta,
      async (): Promise<SavedMeta> => {
        try {
          const config = await getConfig();
          const saved = config.savedQueue;
          if (!saved) {
            return { exists: false, savedAt: null, count: 0 };
          }
          return {
            exists: true,
            savedAt: saved.savedAt,
            count: saved.count,
          };
        } catch (error) {
          console.error(
            LoggerPrefix,
            '[queue-manager] failed to read saved queue metadata',
            error,
          );
          return { exists: false, savedAt: null, count: 0 };
        }
      },
    );

    // --- 4. Global hotkey -> push toggle ----------------------------------
    const config = await getConfig();
    registerHotkey(config.hotkey);
  },

  stop(ctx) {
    ctx.ipc.removeHandler(QueueManagerChannel.saveQueue);
    ctx.ipc.removeHandler(QueueManagerChannel.restoreQueue);
    ctx.ipc.removeHandler(QueueManagerChannel.getSavedMeta);
    unregisterHotkey();
    backendCtx = null;
  },

  onConfigChange(newConfig) {
    // Re-register the hotkey when (and only when) it changed. savedQueue and
    // other settings churn here on every save — don't re-register for those.
    if (newConfig.hotkey === registeredHotkey) return;
    unregisterHotkey();
    registerHotkey(newConfig.hotkey);
  },
});
