// renderer/state.ts — shared SolidJS signals so NavButton and QueuePanel stay
// in sync (design spec §2). No YT Music access lives here.

import { createSignal } from 'solid-js';

import type { QueueManagerPluginConfig, QueueTrack, SavedMeta } from '../types';

export type PanelStatus = 'ok' | 'empty' | 'error' | 'loading';

/** Whether the slide-out panel is open. */
export const [panelOpen, setPanelOpen] = createSignal(false);

/** The live, normalized queue. Driven by store.subscribe(). */
export const [tracks, setTracks] = createSignal<QueueTrack[]>([]);

/** Which UI state the panel body should render. */
export const [status, setStatus] = createSignal<PanelStatus>('empty');

/** Cheap saved-snapshot metadata from the backend (ch.3). */
export const [savedMeta, setSavedMeta] = createSignal<SavedMeta>({
  exists: false,
  savedAt: null,
  count: 0,
});

/**
 * Identifier of the action currently in flight (e.g. 'save-playlist',
 * 'save-queue', 'restore'), or null when idle. Drives the busy bar + the
 * per-button spinner/disabled state.
 */
export const [busyAction, setBusyAction] = createSignal<string | null>(null);

/** The current plugin config, kept in sync via the renderer's onConfigChange. */
export const [config, setConfig] =
  createSignal<QueueManagerPluginConfig | null>(null);
