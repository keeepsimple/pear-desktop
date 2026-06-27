// renderer/playlist.ts — playlist commands (renderer-only, NO IPC).
//   * saveQueueToPlaylist(): trigger YT Music's native saveQueueToPlaylistCommand
//     (the queue header's "Save" chip) to save the WHOLE queue.
//   * getLibraryPlaylists() / addToPlaylist(): add the current song to an
//     existing playlist via ytmusic-app.networkManager.
//
// ASSUMPTIONS (design spec §7/§9): the exact endpoints / request bodies for
// the library-playlist listing and the edit-playlist call are sketched from
// the datahost-get-state shapes and confirmed-by-implementation, not from a
// frozen contract. They are renderer-only and do NOT cross the IPC line, so
// refining them later has zero contract impact. All functions fail soft
// (return false / []) so the UI can surface a toast instead of throwing.

import { getQueueElement } from './store';
import { LoggerPrefix } from '@/utils';

import type { PlaylistSummary } from '../types';
import type { MusicPlayerAppElement } from '@/types/music-player-app-element';

const getApp = (): MusicPlayerAppElement | null =>
  document.querySelector<MusicPlayerAppElement>('ytmusic-app');

// --- save the whole queue as a playlist (native command) -------------------

export const saveQueueToPlaylist = async (): Promise<boolean> => {
  const queue = getQueueElement();
  if (!queue) {
    console.warn(
      LoggerPrefix,
      '[queue-manager] queue element missing for save',
    );
    return false;
  }

  // YT Music renders the queue header's "Save" chip backed by
  // saveQueueToPlaylistCommand; clicking it opens YT Music's own
  // "save to playlist" dialog. We locate it defensively by icon/label so a
  // header markup change degrades to a clean `false` (→ error toast).
  const header =
    queue.querySelector('ytmusic-player-queue-header-renderer') ??
    document.querySelector('ytmusic-player-queue-header-renderer');

  const candidates = Array.from(
    header?.querySelectorAll<HTMLElement>(
      'ytmusic-chip-cloud-chip-renderer, yt-chip-cloud-chip-renderer, tp-yt-paper-chip, button',
    ) ?? [],
  );

  const saveChip = candidates.find((element) => {
    const iconType =
      element.querySelector('tp-yt-iron-icon, yt-icon')?.getAttribute('icon') ??
      '';
    const label = (
      element.getAttribute('aria-label') ??
      element.textContent ??
      ''
    ).toLowerCase();
    return (
      iconType.toUpperCase().includes('ADD_TO_PLAYLIST') ||
      iconType.toLowerCase().includes('playlist') ||
      label.includes('save')
    );
  });

  if (!saveChip) {
    console.warn(
      LoggerPrefix,
      '[queue-manager] save-to-playlist chip not found in queue header',
    );
    return false;
  }

  saveChip.click();
  return true;
};

// --- add the current song to an existing playlist --------------------------

interface BrowseResponse {
  contents?: unknown;
}

// Walk the /browse response for `musicTwoRowItemRenderer` playlist cards.
// Defensive + shape-tolerant (§7): unknown structures are skipped.
const normalizePlaylists = (response: BrowseResponse): PlaylistSummary[] => {
  const found: PlaylistSummary[] = [];
  const seen = new Set<string>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const record = node as Record<string, unknown>;
    const card = record.musicTwoRowItemRenderer as
      | Record<string, unknown>
      | undefined;
    if (card) {
      const navigation = card.navigationEndpoint as
        | Record<string, unknown>
        | undefined;
      const browse = navigation?.browseEndpoint as
        | { browseId?: string }
        | undefined;
      const browseId = browse?.browseId;
      if (typeof browseId === 'string' && browseId.startsWith('VL')) {
        const playlistId = browseId.slice(2);
        if (!seen.has(playlistId)) {
          seen.add(playlistId);
          const title = card.title as
            | { runs?: { text?: string }[] }
            | undefined;
          const thumbnail = (
            (card.thumbnailRenderer as Record<string, unknown>)
              ?.musicThumbnailRenderer as
              | { thumbnail?: { thumbnails?: { url?: string }[] } }
              | undefined
          )?.thumbnail?.thumbnails;
          found.push({
            playlistId,
            title: title?.runs?.[0]?.text ?? '',
            thumbnail: thumbnail?.[thumbnail.length - 1]?.url ?? null,
          });
        }
      }
    }

    for (const value of Object.values(record)) visit(value);
  };

  visit(response.contents);
  return found;
};

export const getLibraryPlaylists = async (): Promise<PlaylistSummary[]> => {
  const app = getApp();
  if (!app) return [];

  try {
    const response = await app.networkManager.fetch<
      BrowseResponse,
      { browseId: string }
    >('/browse', { browseId: 'FEmusic_liked_playlists' });
    return normalizePlaylists(response ?? {});
  } catch (error) {
    console.warn(
      LoggerPrefix,
      '[queue-manager] failed to list library playlists',
      error,
    );
    return [];
  }
};

export const addToPlaylist = async (
  playlistId: string,
  videoId: string,
): Promise<boolean> => {
  const app = getApp();
  if (!app) return false;

  try {
    await app.networkManager.fetch<
      unknown,
      {
        playlistId: string;
        actions: { addedVideoId: string; action: string }[];
      }
    >('/browse/edit_playlist', {
      playlistId,
      actions: [{ addedVideoId: videoId, action: 'ACTION_ADD_VIDEO' }],
    });
    return true;
  } catch (error) {
    console.warn(
      LoggerPrefix,
      '[queue-manager] failed to add the current song to a playlist',
      error,
    );
    return false;
  }
};
