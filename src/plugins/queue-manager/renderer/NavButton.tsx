// renderer/NavButton.tsx — the toggle button + live count badge, mounted near
// the player bar (or the nav bar, per config). Toggles `panelOpen`.

import { Show } from 'solid-js';

import { panelOpen, setPanelOpen, tracks } from './state';

export const NavButton = () => {
  const count = () => tracks().length;

  return (
    <button
      aria-label="Toggle queue manager"
      aria-pressed={panelOpen()}
      class="qm-nav-button style-scope ytmusic-player-bar"
      classList={{ 'qm-nav-button--active': panelOpen() }}
      onClick={() => setPanelOpen((open) => !open)}
      title="Queue manager"
      type="button"
    >
      <svg aria-hidden="true" height="24" viewBox="0 0 24 24" width="24">
        <path
          d="M3 6h13v2H3V6zm0 5h13v2H3v-2zm0 5h9v2H3v-2zm15-1.5l4 2.5-4 2.5v-5z"
          fill="currentColor"
        />
      </svg>
      <Show when={count() > 0}>
        <span class="qm-nav-badge">{count() > 99 ? '99+' : count()}</span>
      </Show>
    </button>
  );
};
