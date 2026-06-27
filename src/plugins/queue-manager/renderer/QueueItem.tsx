// renderer/QueueItem.tsx — one queue row. Pure: props in, callbacks out.
// Never touches YT Music internals. Accesses props via getters (no destructure)
// to keep SolidJS reactivity intact.

import { Show } from 'solid-js';

import type { QueueTrack } from '../types';

export interface QueueItemProps {
  track: QueueTrack;
  isDropTarget: boolean;
  isDragging: boolean;
  onJump: () => void;
  onPlayNext: () => void;
  onRemove: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onDragEnd: (event: DragEvent) => void;
}

export const QueueItem = (props: QueueItemProps) => {
  return (
    <li
      class="qm-row"
      classList={{
        'qm-row--playing': props.track.isPlaying,
        'qm-row--drop-target': props.isDropTarget,
        'qm-row--dragging': props.isDragging,
      }}
      draggable={true}
      onDragEnd={(event) => props.onDragEnd(event)}
      onDragOver={(event) => props.onDragOver(event)}
      onDragStart={(event) => props.onDragStart(event)}
      onDrop={(event) => props.onDrop(event)}
    >
      <button
        class="qm-row__body"
        onClick={() => props.onJump()}
        title={props.track.title}
        type="button"
      >
        <div class="qm-row__thumb">
          <Show
            fallback={<div class="qm-row__thumb-placeholder">♪</div>}
            when={props.track.thumbnail}
          >
            <img
              alt=""
              draggable={false}
              loading="lazy"
              src={props.track.thumbnail!}
            />
          </Show>
          <Show when={props.track.isPlaying}>
            <span aria-hidden="true" class="qm-row__playing-icon">
              ▶
            </span>
          </Show>
        </div>

        <div class="qm-row__meta">
          <Show when={props.track.isPlaying}>
            <span class="qm-row__now-playing">Now playing</span>
          </Show>
          <span class="qm-row__title">{props.track.title}</span>
          <span class="qm-row__subtitle">
            {props.track.artists}
            <Show when={props.track.duration}>
              {' · '}
              {props.track.duration}
            </Show>
          </span>
        </div>
      </button>

      <div class="qm-row__actions">
        <button
          aria-label="Play next"
          class="qm-icon-button"
          onClick={(event) => {
            event.stopPropagation();
            props.onPlayNext();
          }}
          title="Play next"
          type="button"
        >
          <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18">
            <path d="M6 5l8.5 7L6 19V5zm10 0h2v14h-2V5z" fill="currentColor" />
          </svg>
        </button>
        <button
          aria-label="Remove from queue"
          class="qm-icon-button"
          onClick={(event) => {
            event.stopPropagation();
            props.onRemove();
          }}
          title="Remove from queue"
          type="button"
        >
          <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18">
            <path
              d="M6 7h12v2H6V7zm2 3h8l-1 9H9l-1-9zm3-6h2l1 1h3v2H4V5h3l1-1z"
              fill="currentColor"
            />
          </svg>
        </button>
        <span
          aria-hidden="true"
          class="qm-row__drag-handle"
          title="Drag to reorder"
        >
          <svg height="18" viewBox="0 0 24 24" width="18">
            <path
              d="M9 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm9-12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
              fill="currentColor"
            />
          </svg>
        </span>
      </div>
    </li>
  );
};
