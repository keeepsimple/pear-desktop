// renderer/QueuePanel.tsx — the slide-out overlay. Presentational: it reads the
// shared signals (state.ts), calls store.ts / playlist.ts for queue work, and
// the backend over `ipc` ONLY for persist/restore/meta (design spec §4, §6).
// It never touches YT Music internals directly.

import { createMemo, createSignal, For, Show } from 'solid-js';

import { saveQueueToPlaylist } from './playlist';
import { QueueItem } from './QueueItem';
import {
  busyAction,
  config,
  panelOpen,
  savedMeta,
  setBusyAction,
  setPanelOpen,
  setSavedMeta,
  setStatus,
  status,
  tracks,
} from './state';
import * as store from './store';

import { QueueManagerChannel } from '../types';

import type {
  QueueManagerPluginConfig,
  SaveQueueResult,
  SavedMeta,
  SavedQueue,
} from '../types';
import type { RendererContext } from '@/types/contexts';

export interface QueuePanelProps {
  ipc: RendererContext<QueueManagerPluginConfig>['ipc'];
  /** Re-read the live queue after a transient error (the [Retry] button). */
  onRetry: () => void;
}

export const QueuePanel = (props: QueuePanelProps) => {
  const [dragIndex, setDragIndex] = createSignal<number | null>(null);
  const [overIndex, setOverIndex] = createSignal<number | null>(null);

  const count = () => tracks().length;
  const smartShuffleEnabled = () => config()?.smartShuffle ?? true;
  const canRestore = () => savedMeta().exists;
  const isBusy = (action: string) => busyAction() === action;

  const savedSummary = createMemo(() => {
    const meta = savedMeta();
    if (!meta.exists) return '';
    const tracksLabel = meta.count === 1 ? 'track' : 'tracks';
    return `${meta.count} ${tracksLabel} saved`;
  });

  // --- actions -------------------------------------------------------------

  const onSaveAsPlaylist = async () => {
    if (busyAction()) return;
    setBusyAction('save-playlist');
    try {
      const ok = await saveQueueToPlaylist();
      store.showToast(
        ok
          ? 'Opening "save to playlist"…'
          : "Couldn't save to a playlist — are you signed in?",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const onSmartShuffle = () => {
    if (busyAction()) return;
    const ok = store.shuffleRest();
    store.showToast(
      ok ? 'Shuffled the rest of the queue' : "Couldn't shuffle the queue",
    );
  };

  const onClear = () => {
    if (busyAction()) return;
    if (config()?.confirmClear && !window.confirm('Clear the entire queue?')) {
      return;
    }
    const ok = store.clearQueue();
    if (ok) store.showToast('Queue cleared');
  };

  const onSaveQueue = async () => {
    if (busyAction()) return;
    const videoIds = store.getVideoIds();
    if (videoIds.length === 0) return; // guarded — no IPC for an empty queue
    setBusyAction('save-queue');
    try {
      // Backend contract: ch.1 queue-manager:save-queue -> SaveQueueResult
      const result: SaveQueueResult = await props.ipc.invoke(
        QueueManagerChannel.saveQueue,
        { videoIds },
      );
      if (result?.ok) {
        setSavedMeta({
          exists: true,
          savedAt: result.savedAt,
          count: result.count,
        });
        store.showToast(`Queue saved · ${result.count} tracks`);
      } else {
        store.showToast("Couldn't save the queue");
      }
    } finally {
      setBusyAction(null);
    }
  };

  const onRestoreQueue = async () => {
    if (busyAction() || !canRestore()) return;
    setBusyAction('restore');
    setStatus('loading');
    try {
      // Two-step restore (§6): main returns the ids; the renderer replays them.
      const saved: SavedQueue | null = await props.ipc.invoke(
        QueueManagerChannel.restoreQueue,
      );
      if (!saved || saved.videoIds.length === 0) {
        store.showToast('No saved queue to restore');
        return;
      }
      const ok = await store.setQueue(saved.videoIds);
      store.showToast(
        ok ? 'Saved queue restored' : "Couldn't restore the saved queue",
      );
    } finally {
      setBusyAction(null);
      // store.subscribe drives the list back to 'ok'/'empty'; if the store was
      // missing, fall back to a fresh read so we don't get stuck on 'loading'.
      props.onRetry();
    }
  };

  // --- drag reorder --------------------------------------------------------

  const onDragStart = (index: number) => (event: DragEvent) => {
    setDragIndex(index);
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  };

  const onDrop = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    // Source index travels in the drag payload, so this handler stays free of
    // reactive reads (the signal is set in onDragStart for visual state only).
    const raw = event.dataTransfer?.getData('text/plain');
    const from = raw === undefined || raw === '' ? Number.NaN : Number(raw);
    if (!Number.isNaN(from) && from !== index) {
      store.move(from, index);
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const onDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  // --- render --------------------------------------------------------------

  return (
    <div
      aria-hidden={!panelOpen()}
      aria-label="Queue manager"
      class="qm-overlay"
      classList={{ 'qm-overlay--open': panelOpen() }}
      role="dialog"
    >
      <div class="qm-panel">
        <header class="qm-panel__header">
          <div class="qm-panel__title">
            <span class="qm-panel__heading">Queue</span>
            <Show when={status() !== 'error'}>
              <span class="qm-panel__count">
                · {count()} {count() === 1 ? 'track' : 'tracks'}
              </span>
            </Show>
          </div>
          <button
            aria-label="Close queue manager"
            class="qm-icon-button qm-panel__close"
            onClick={() => setPanelOpen(false)}
            title="Close"
            type="button"
          >
            <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20">
              <path
                d="M18.3 5.7l-1.4-1.4L12 9.2 7.1 4.3 5.7 5.7 10.6 10.6 5.7 15.5l1.4 1.4L12 12l4.9 4.9 1.4-1.4-4.9-4.9z"
                fill="currentColor"
              />
            </svg>
          </button>
        </header>

        <Show when={busyAction()}>
          <div aria-hidden="true" class="qm-progress" />
        </Show>

        {/* Action bar — manipulation actions hide on empty/error states. */}
        <Show
          when={status() === 'ok' || (status() === 'loading' && count() > 0)}
        >
          <div class="qm-actionbar">
            <button
              class="qm-action"
              disabled={Boolean(busyAction())}
              onClick={onSaveAsPlaylist}
              type="button"
            >
              <Show
                fallback={<span>+ Save as playlist</span>}
                when={isBusy('save-playlist')}
              >
                <span class="qm-spinner" /> Saving…
              </Show>
            </button>
            <Show when={smartShuffleEnabled()}>
              <button
                class="qm-action"
                disabled={Boolean(busyAction())}
                onClick={onSmartShuffle}
                type="button"
              >
                ⤮ Smart shuffle
              </button>
            </Show>
            <button
              class="qm-action"
              disabled={Boolean(busyAction())}
              onClick={onSaveQueue}
              type="button"
            >
              <Show
                fallback={<span>⤓ Save queue</span>}
                when={isBusy('save-queue')}
              >
                <span class="qm-spinner" /> Saving…
              </Show>
            </button>
            <button
              class="qm-action"
              disabled={Boolean(busyAction()) || !canRestore()}
              onClick={onRestoreQueue}
              title={savedSummary()}
              type="button"
            >
              <Show fallback={<span>⟲ Restore</span>} when={isBusy('restore')}>
                <span class="qm-spinner" /> Restoring…
              </Show>
            </button>
            <button
              class="qm-action qm-action--danger"
              disabled={Boolean(busyAction())}
              onClick={onClear}
              type="button"
            >
              🗑 Clear
            </button>
          </div>
        </Show>

        {/* Body — one of empty / error / populated. */}
        <div class="qm-body">
          <Show when={status() === 'error'}>
            <div class="qm-placeholder">
              <span class="qm-placeholder__glyph">⚠</span>
              <p class="qm-placeholder__title">
                Can't read the queue right now
              </p>
              <p class="qm-placeholder__hint">YT Music may have updated.</p>
              <button
                class="qm-action"
                onClick={() => props.onRetry()}
                type="button"
              >
                Retry
              </button>
            </div>
          </Show>

          <Show when={status() === 'empty'}>
            <div class="qm-placeholder">
              <span class="qm-placeholder__glyph">♪</span>
              <p class="qm-placeholder__title">Your queue is empty</p>
              <p class="qm-placeholder__hint">Play something to get started</p>
              <Show when={canRestore()}>
                <button
                  class="qm-action"
                  disabled={Boolean(busyAction())}
                  onClick={onRestoreQueue}
                  type="button"
                >
                  <Show
                    fallback={<span>⟲ Restore queue</span>}
                    when={isBusy('restore')}
                  >
                    <span class="qm-spinner" /> Restoring…
                  </Show>
                </button>
              </Show>
            </div>
          </Show>

          <Show
            when={status() === 'ok' || (status() === 'loading' && count() > 0)}
          >
            <ul class="qm-list">
              <For each={tracks()}>
                {(track) => (
                  <QueueItem
                    isDragging={dragIndex() === track.index}
                    isDropTarget={overIndex() === track.index}
                    onDragEnd={onDragEnd}
                    onDragOver={onDragOver(track.index)}
                    onDragStart={onDragStart(track.index)}
                    onDrop={onDrop(track.index)}
                    onJump={() => store.jumpTo(track.index)}
                    onPlayNext={() => store.playNext(track.index)}
                    onRemove={() => store.removeAt(track.index)}
                    track={track}
                  />
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </div>
  );
};

// Re-exported so the renderer entry can refresh saved-meta on start without
// duplicating the channel name / shape.
export const fetchSavedMeta = async (
  ipc: RendererContext<QueueManagerPluginConfig>['ipc'],
): Promise<void> => {
  const meta: SavedMeta = await ipc.invoke(QueueManagerChannel.getSavedMeta);
  if (meta) setSavedMeta(meta);
};
