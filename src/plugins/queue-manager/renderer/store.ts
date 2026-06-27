// renderer/store.ts — THE ONLY module that touches YT Music internals
// (`#queue .queue.store.store`) and dispatches queue actions. Everything
// fragile about the YT Music DOM/store lives here so DOM changes are
// contained (design spec §0, §5). All mutations guard `getQueueElement()`
// for null first and return early so the panel can surface the ERROR state.

import { getMusicQueueRenderer } from '@/plugins/music-together/queue/song';
import { mapQueueItem } from '@/plugins/music-together/queue/utils';
import { LoggerPrefix } from '@/utils';

import type { QueueTrack } from '../types';
import type { ItemPlaylistPanelVideoRenderer } from '@/types/datahost-get-state';
import type { AppElement, QueueElement, Store } from '@/types/queue';

// --- low-level access ------------------------------------------------------

export const getQueueElement = (): QueueElement | null =>
  document.querySelector<QueueElement>('#queue');

const getStore = (): Store | null => {
  const store = getQueueElement()?.queue?.store?.store;
  return store ?? null;
};

let warnedMissingStore = false;
const warnOnce = (message: string) => {
  if (warnedMissingStore) return;
  warnedMissingStore = true;
  console.warn(LoggerPrefix, `[queue-manager] ${message}`);
};

// --- normalization (ItemPlaylistPanelVideoRenderer -> QueueTrack) ----------

// Separators YT Music interleaves between byline runs ("•", "&", ",").
const SEPARATOR = /^[\s•·&,/|]+$/;

const mapArtists = (item: ItemPlaylistPanelVideoRenderer): string => {
  const longRuns = item.longBylineText?.runs;
  if (Array.isArray(longRuns) && longRuns.length > 0) {
    const parts = longRuns
      .map((run) => run?.text ?? '')
      .filter((text) => text.trim().length > 0 && !SEPARATOR.test(text));
    if (parts.length > 0) return parts.join(' ').trim();
  }
  return item.shortBylineText?.runs?.[0]?.text ?? '';
};

const pickThumbnail = (item: ItemPlaylistPanelVideoRenderer): string | null => {
  const thumbnails = item.thumbnail?.thumbnails;
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
  // Last entry is the highest resolution.
  return thumbnails[thumbnails.length - 1]?.url ?? null;
};

// --- READ ------------------------------------------------------------------

export const readQueue = (): QueueTrack[] => {
  const store = getStore();
  if (!store) {
    warnOnce('queue store not found while reading the queue');
    return [];
  }

  const items = store.getState().queue.items;
  return mapQueueItem((it) => it, items)
    .map((item, index): QueueTrack | null => {
      if (!item) return null;
      return {
        index, // store-array index; the dispatch target for mutations
        videoId: item.videoId,
        title: item.title?.runs?.[0]?.text ?? '',
        artists: mapArtists(item),
        duration: item.lengthText?.runs?.[0]?.text ?? null,
        thumbnail: pickThumbnail(item),
        isPlaying: item.selected === true,
        playlistSetVideoId: item.playlistSetVideoId ?? null,
      };
    })
    .filter((track): track is QueueTrack => track !== null);
};

export const getSelectedIndex = (): number => {
  const store = getStore();
  if (!store) return -1;
  const selected = mapQueueItem(
    (it) => it?.selected === true,
    store.getState().queue.items,
  );
  return selected.findIndex(Boolean);
};

export const getVideoIds = (): string[] =>
  readQueue()
    .map((track) => track.videoId)
    .filter((id): id is string => Boolean(id));

export const subscribe = (cb: (tracks: QueueTrack[]) => void): (() => void) => {
  const store = getStore();
  if (!store) {
    warnOnce('queue store not found while subscribing');
    return () => {};
  }
  const unsubscribe = store.subscribe(() => cb(readQueue()));
  return typeof unsubscribe === 'function'
    ? (unsubscribe as () => void)
    : () => {};
};

// --- MUTATE (dispatch to the native store) ---------------------------------

const dispatch = (action: { type: string; payload?: unknown }): boolean => {
  const queue = getQueueElement();
  if (!queue) {
    warnOnce(`queue element missing for action "${action.type}"`);
    return false;
  }
  queue.dispatch(action);
  return true;
};

export const jumpTo = (index: number): boolean =>
  dispatch({ type: 'SET_INDEX', payload: index });

export const removeAt = (index: number): boolean =>
  dispatch({ type: 'REMOVE_ITEM', payload: index });

export const move = (fromIndex: number, toIndex: number): boolean => {
  if (fromIndex === toIndex) return true;
  return dispatch({ type: 'MOVE_ITEM', payload: { fromIndex, toIndex } });
};

export const playNext = (index: number): boolean => {
  const selected = getSelectedIndex();
  const target = (selected < 0 ? -1 : selected) + 1;
  return move(index, target);
};

export const clearQueue = (): boolean => dispatch({ type: 'CLEAR' });

// Smart shuffle: Fisher–Yates the indices AFTER the now-playing one, then
// apply the permutation via a sequence of MOVE_ITEM dispatches. Plugin-side
// ordering only — playback does not jump.
export const shuffleRest = (): boolean => {
  const store = getStore();
  if (!store) {
    warnOnce('queue store not found while shuffling');
    return false;
  }

  const tracks = readQueue();
  const total = tracks.length;
  const selected = getSelectedIndex();
  const start = (selected < 0 ? -1 : selected) + 1;
  if (total - start < 2) return true; // nothing meaningful to shuffle

  // Desired final ordering of the original indices for positions [start,total).
  const desired: number[] = [];
  for (let i = start; i < total; i++) desired.push(i);
  for (let i = desired.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [desired[i], desired[j]] = [desired[j], desired[i]];
  }

  // Simulate the live arrangement (by original index) and emit the minimal
  // moves to realize `desired`. Each MOVE_ITEM reindexes the store, so we
  // mirror that here.
  const current = tracks.map((track) => track.index);
  for (let position = start; position < total; position++) {
    const wanted = desired[position - start];
    const from = current.indexOf(wanted);
    if (from !== position) {
      if (!move(from, position)) return false;
      const [moved] = current.splice(from, 1);
      current.splice(position, 0, moved);
    }
  }
  return true;
};

// --- RESTORE (re-hydrate a saved snapshot into the live queue) -------------

export const setQueue = async (videoIds: string[]): Promise<boolean> => {
  const queue = getQueueElement();
  const store = getStore();
  if (!queue || !store) {
    warnOnce('queue element/store missing while restoring');
    return false;
  }
  if (videoIds.length === 0) return false;

  const response = await getMusicQueueRenderer(videoIds);
  if (!response) return false;

  const items = response.queueDatas.map((data) => data.content);
  queue.dispatch({
    type: 'UPDATE_ITEMS',
    payload: {
      items,
      nextQueueItemId: store.getState().queue.nextQueueItemId,
      shouldAssignIds: true,
      currentIndex: -1,
    },
  });
  return true;
};

// --- toasts (reuse YT Music's own toast service, §5) -----------------------

export const showToast = (message: string): void => {
  const app = document.querySelector<AppElement>('ytmusic-app');
  app?.toastService?.show(message);
};
