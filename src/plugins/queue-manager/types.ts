// Shared type contract for the `queue-manager` plugin.
// Single import source for renderer (FE) + backend (BE) so the IPC/config
// shapes can never drift. See _workspace/01_design_spec.md §3, §4, §5.

// --- Config (§3) -----------------------------------------------------------

export type QueueManagerButtonPlacement = 'player-bar' | 'nav-bar';

/** Persisted snapshot of a queue. Owned/written by the backend (§9.1). */
export interface SavedQueue {
  /** Ordered YT Music video ids of the snapshot. */
  videoIds: string[];
  /** Epoch ms when the snapshot was saved. */
  savedAt: number;
  /** videoIds.length, denormalized for cheap UI. */
  count: number;
}

export interface QueueManagerPluginConfig {
  enabled: boolean;
  /** Electron accelerator string, e.g. 'CmdOrCtrl+Shift+Q'. Empty string = no hotkey. */
  hotkey: string;
  showButton: boolean;
  buttonPlacement: QueueManagerButtonPlacement;
  smartShuffle: boolean;
  confirmClear: boolean;
  /** Persisted snapshot; NOT shown in menu. Written by the backend via setConfig. */
  savedQueue: SavedQueue | null;
}

// --- IPC payloads / returns (§4) ------------------------------------------

// 1 — queue-manager:save-queue (renderer -> main, req/res)
export interface SaveQueuePayload {
  /** Ordered ids the renderer read from the live queue (store.getVideoIds()). */
  videoIds: string[];
}
export interface SaveQueueResult {
  ok: boolean;
  /** Epoch ms persisted. */
  savedAt: number;
  /** == videoIds.length. */
  count: number;
}

// 2 — queue-manager:restore-queue (renderer -> main, req/res)
//     Main returns the persisted snapshot (or null). The RENDERER replays the
//     videoIds into the live queue via store.setQueue(); main never touches it.
export type RestoreQueueResult = SavedQueue | null;

// 3 — queue-manager:get-saved-meta (renderer -> main, req/res)
//     Cheap metadata so the UI can enable/disable "Restore".
export interface SavedMeta {
  exists: boolean;
  savedAt: number | null;
  count: number;
}

// 4 — queue-manager:toggle-panel (main -> renderer, push)
export interface TogglePanelPayload {
  source: 'hotkey';
}

// --- Renderer-only shapes (§5), kept here as the single type source -------

export interface QueueTrack {
  index: number;
  videoId: string;
  title: string;
  artists: string;
  duration: string | null;
  thumbnail: string | null;
  isPlaying: boolean;
  playlistSetVideoId: string | null;
}

export interface PlaylistSummary {
  playlistId: string;
  title: string;
  thumbnail: string | null;
}

// --- Channel name constants (avoid string drift) --------------------------

export const QueueManagerChannel = {
  saveQueue: 'queue-manager:save-queue',
  restoreQueue: 'queue-manager:restore-queue',
  getSavedMeta: 'queue-manager:get-saved-meta',
  togglePanel: 'queue-manager:toggle-panel',
} as const;
