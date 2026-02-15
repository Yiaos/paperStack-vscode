import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import type { Session } from "../types";

interface RecentSessionsProps {
  sessions: Session[];
  onSessionSelect: (sessionId: string) => void;
  onViewAll: () => void;
  mode?: "compact" | "full";
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportSession: (sessionId: string) => void;
}

export function RecentSessions(props: RecentSessionsProps) {
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [confirmDeleteId, setConfirmDeleteId] = createSignal<string | null>(null);
  const [contextMenuId, setContextMenuId] = createSignal<string | null>(null);

  // Close context menu when clicking outside
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (contextMenuId() && !target.closest(".session-menu-container")) {
        setContextMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  // Take top 3 sessions for compact mode, or all for full mode (scroll handles overflow)
  const isFull = () => props.mode === "full";
  const limit = () => isFull() ? props.sessions.length : 3;
  const recentSessions = () => props.sessions.slice(0, limit());

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return "now";
  };

  const handleStartRename = (e: MouseEvent, session: Session) => {
    e.stopPropagation();
    setRenamingId(session.id);
    setRenameValue(session.title);
    setContextMenuId(null);
  };

  const handleSubmitRename = (sessionId: string) => {
    const value = renameValue().trim();
    if (value) {
      props.onRenameSession(sessionId, value);
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleRequestDelete = (e: MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(sessionId);
    setContextMenuId(null);
  };

  const handleConfirmDelete = (e: MouseEvent, sessionId: string) => {
    e.stopPropagation();
    props.onDeleteSession(sessionId);
    setConfirmDeleteId(null);
  };

  const handleCancelDelete = (e: MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const handleExport = (e: MouseEvent, sessionId: string) => {
    e.stopPropagation();
    props.onExportSession(sessionId);
    setContextMenuId(null);
  };

  const handleToggleMenu = (e: MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setContextMenuId((current) => (current === sessionId ? null : sessionId));
  };

  return (
    <div class={`recent-sessions ${isFull() ? "recent-sessions--full" : ""}`}>
      <div class="recent-sessions-list">
        <For each={recentSessions()}>
          {(session) => {
            const isRenaming = () => renamingId() === session.id;
            const isConfirmingDelete = () => confirmDeleteId() === session.id;
            const isMenuOpen = () => contextMenuId() === session.id;

            return (
              <div 
                class="recent-session-item" 
                onClick={() => {
                  if (isMenuOpen()) {
                    setContextMenuId(null);
                    return;
                  }
                  if (!isRenaming() && !isConfirmingDelete()) {
                    props.onSessionSelect(session.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Show when={isRenaming()} fallback={
                  <>
                    <div class="recent-session-title" data-tooltip={session.title}>{session.title}</div>
                    
                    <Show when={isConfirmingDelete()}>
                      <div class="session-confirm-delete" onClick={(e) => e.stopPropagation()}>
                        <span class="session-confirm-text">Delete?</span>
                        <button
                          class="session-confirm-btn session-confirm-btn--yes"
                          onClick={(e) => handleConfirmDelete(e, session.id)}
                          aria-label="Confirm delete"
                        >Yes</button>
                        <button
                          class="session-confirm-btn session-confirm-btn--no"
                          onClick={handleCancelDelete}
                          aria-label="Cancel delete"
                        >No</button>
                      </div>
                    </Show>

                    <Show when={!isConfirmingDelete()}>
                      <div class="recent-session-meta">
                        <div class="recent-session-time">{formatRelativeTime(session.time.updated)}</div>
                        <div class="session-menu-container" onClick={(e) => e.stopPropagation()}>
                          <button
                            class={`session-menu-trigger ${isMenuOpen() ? "active" : ""}`}
                            onClick={(e) => handleToggleMenu(e, session.id)}
                            aria-label="Session options"
                            type="button"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M3 8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
                            </svg>
                          </button>
                          <Show when={isMenuOpen()}>
                            <div class="session-context-menu session-context-menu--icons" role="menu">
                              <button
                                class="session-action-button"
                                onClick={(e) => handleStartRename(e, session)}
                                aria-label="Rename session"
                                data-tooltip="Rename"
                                type="button"
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                  <path d="M13.23 1l-1.46 1.46L13.54 4.23 15 2.77 13.23 1zM2 11.23V14h2.77L12.54 6.23 9.77 3.46 2 11.23zM1 15v1h15v-1H1z"/>
                                </svg>
                              </button>
                              <button
                                class="session-action-button"
                                onClick={(e) => handleExport(e, session.id)}
                                aria-label="Export session"
                                data-tooltip="Export"
                                type="button"
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                  <path d="M14 11v2H2v-2H1v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2h-1zM8.5 1.5v8.25l2.25-2.25.75.75-3.5 3.5-3.5-3.5.75-.75 2.25 2.25V1.5h1z"/>
                                </svg>
                              </button>
                              <button
                                class="session-action-button session-action-button--danger"
                                onClick={(e) => handleRequestDelete(e, session.id)}
                                aria-label="Delete session"
                                data-tooltip="Delete"
                                type="button"
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                  <path d="M11 2H9c0-.55-.45-1-1-1s-1 .45-1 1H5c-.55 0-1 .45-1 1v1h8V3c0-.55-.45-1-1-1zm2 3H3v9c0 .55.45 1 1 1h8c.55 0 1-.45 1-1V5z"/>
                                </svg>
                              </button>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </Show>
                  </>
                }>
                  <div class="session-rename-row" onClick={(e) => e.stopPropagation()}>
                    <RenameInput
                      value={renameValue()}
                      onInput={setRenameValue}
                      onSubmit={() => handleSubmitRename(session.id)}
                      onCancel={handleCancelRename}
                    />
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
      <Show when={!isFull() && props.sessions.length > 3}>
        <div 
          class="recent-sessions-footer" 
          onClick={props.onViewAll}
          role="button"
          tabIndex={0}
        >
          查看全部 ({props.sessions.length} 个)
        </div>
      </Show>
    </div>
  );
}

function RenameInput(props: {
  value: string;
  onInput: (val: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  let ref: HTMLInputElement | undefined;

  onMount(() => {
    setTimeout(() => {
      if (ref) {
        ref.focus();
        ref.select();
      }
    }, 0);
  });

  return (
    <input
      ref={ref}
      class="session-rename-input"
      type="text"
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          props.onSubmit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          props.onCancel();
        }
      }}
      onBlur={props.onSubmit}
    />
  );
}
