# Plugin `queue-manager` — Design Spec

Date: 2026-06-27
Status: Approved (ready for implementation via `electron-fullstack-pipeline`)

## Goal
A pear-desktop plugin that renders a **custom queue panel** (read from YT Music's
internal store) and lets the user manage the live play queue — including when a whole
playlist is playing — with actions to reorder/remove, jump, save to a playlist,
smart-shuffle, clear, and save/restore the queue. Merges the previously-discussed
"add to playlist" idea into this single plugin.

## Why
No existing plugin manages the play queue or offers a quick "save current queue / add
current song to a playlist" action. `album-actions` only does bulk like/dislike;
`api-server`/`music-together` only add to the *queue*, not to saved playlists.

## Architecture & boundaries
```
src/plugins/queue-manager/
├── index.ts          # createPlugin definition + default config
├── menu.ts           # settings menu (hotkey, nav-button toggle, smart-shuffle on/off)
├── backend.ts        # IPC: persist/restore queue (electron-store), global hotkey
├── renderer/
│   ├── index.tsx     # mount nav button + slide-out overlay panel (SolidJS)
│   ├── QueuePanel.tsx# main panel: list, drag-reorder, action bar
│   ├── store.ts      # the ONLY adapter touching `#queue .queue.store.store`
│   └── playlist.ts   # saveQueueToPlaylistCommand + add-to-existing-playlist
└── style.css
```
`store.ts` isolates all YT Music internals (DOM/store) so DOM changes are contained.
`QueuePanel.tsx` works only with normalized data. `backend.ts` only handles persistence
and the global hotkey.

## Data flow
- **Read queue:** `store.ts` subscribes to `#queue .queue.store.store`, maps to
  `QueueTrack[]` (id, title, artist, thumbnail, index) via the `music-together`
  `mapQueueItem` / `getMusicQueueRenderer` patterns. Store change → Solid signal → re-render.
- **Jump / remove / reorder:** dispatch actions to the native store (no manual playback).
- **Save to playlist:** `saveQueueToPlaylistCommand` for saving the whole queue as a new
  playlist; add-to-existing uses the `/music/...` API + queue context params (cf. `song.ts`).
- **Smart shuffle:** shuffle index array plugin-side, then rewrite queue order.
- **Save/restore queue:** panel → IPC → `backend.ts` writes JSON via electron-store;
  restore reloads the saved videoIds into the queue.

## UX
- A queue icon button mounted near nav/player (via the repo's mount API, like other plugins).
- Button **or** configurable hotkey toggles a slide-out overlay panel.
- Item: thumbnail + title/artist; now-playing highlighted; hover shows remove / play-next;
  drag to reorder.
- Top action bar: **Save as playlist**, **Smart shuffle**, **Clear**, **Save/Restore queue**.
- Toast confirmation after each action (reuse existing notification system).

## Errors & edge states
- Empty queue → empty state, hide manipulation actions.
- `#queue`/store not found (YT Music DOM changed) → panel shows "cannot read queue",
  logs a warning; other plugins unaffected.
- Save-to-playlist failure / not signed in → clear error toast.

## Testing (QA gates)
- Typecheck + lint + build (oxlint/oxfmt) per repo gates.
- Playwright: open panel; correct track count while playing a playlist; jump; remove;
  reorder; save playlist (mocked command); smart-shuffle reorders; save→clear→restore matches.
