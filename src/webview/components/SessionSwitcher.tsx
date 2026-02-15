import { createSignal, Show, For, onCleanup, onMount } from "solid-js";
import type { Session } from "../types";
import type { SessionStatus } from "../state/types";

interface SessionSwitcherProps {
  onToggleHistory: () => void;
  isOpen: boolean;
}

export function SessionSwitcher(props: SessionSwitcherProps) {
  return (
    <button
      class={`icon-button ${props.isOpen ? "active" : ""}`}
      onClick={props.onToggleHistory}
      aria-label="Switch session"
      aria-expanded={props.isOpen}
      data-tooltip="History"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path fill-rule="evenodd" d="M1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0zM8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm.5 4.75a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 .47.69l3.5 1.167a.75.75 0 0 0 .48-1.414l-2.95-.983V4.75z"/>
      </svg>
    </button>
  );
}
