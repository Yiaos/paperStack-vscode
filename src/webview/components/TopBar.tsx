import { SessionSwitcher } from "./SessionSwitcher";
import { NewSessionButton } from "./NewSessionButton";
import type { Session } from "../types";
import type { SessionStatus } from "../state/types";

interface TopBarProps {
  sessions: Session[];
  currentSessionId: string | null;
  currentSessionTitle: string;
  sessionStatus: (sessionId: string) => SessionStatus | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onRefreshSessions: () => Promise<void>;
  onOpenSettings: () => void;
}

export function TopBar(props: TopBarProps) {
  return (
    <div class="top-bar">
      <SessionSwitcher
        sessions={props.sessions}
        currentSessionId={props.currentSessionId}
        currentSessionTitle={props.currentSessionTitle}
        sessionStatus={props.sessionStatus}
        onSessionSelect={props.onSessionSelect}
        onRefreshSessions={props.onRefreshSessions}
      />
      <div class="top-bar-actions">
        <NewSessionButton onClick={props.onNewSession} />
        <button class="icon-button" onClick={props.onOpenSettings} aria-label="设置" title="设置">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.14.473c-.07.236-.24.416-.45.513-.21.097-.45.11-.67.037l-.473-.14c-1.4-.413-2.397 1.4-1.05 2.81l.14.473c.07.236.097.45.037.67a.75.75 0 0 1-.513.45l-.473.14c-1.4.413-1.4 2.397 0 2.81l.473.14c.236.07.416.24.513.45.097.21.11.45.037.67l-.14.473c-.413 1.4 1.4 2.397 2.81 1.05l.473-.14c.21-.07.45-.037.67.037.21.097.38.277.45.513l.14.473c.413 1.4 2.397 1.4 2.81 0l.14-.473c.07-.236.24-.416.45-.513.21-.097.45-.11.67-.037l.473.14c1.4.413 2.397-1.4 1.05-2.81l-.14-.473c-.07-.236-.097-.45-.037-.67a.75.75 0 0 1 .513-.45l.473-.14c1.4-.413 1.4-2.397 0-2.81l-.473-.14a.75.75 0 0 1-.45-.513.75.75 0 0 1-.037-.67l.14-.473c.413-1.4-1.4-2.397-2.81-1.05l-.473.14a.75.75 0 0 1-.67-.037.75.75 0 0 1-.45-.513l-.14-.473zM8 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}