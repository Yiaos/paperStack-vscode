import { For, Show, createSignal, onMount, onCleanup, createEffect, on, type Accessor } from "solid-js";
import type { Message, Permission } from "../types";
import { MessageItem } from "./MessageItem";
import { EditableUserMessage } from "./EditableUserMessage";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useSync } from "../state/sync";
import { RecentSessions } from "./RecentSessions";

interface MessageListProps {
  messages: Message[];
  isThinking: boolean;
  workspaceRoot?: string;
  pendingPermissions?: Accessor<Map<string, Permission>>;
  onPermissionResponse?: (permissionId: string, response: "once" | "always" | "reject") => void;
  editingMessageId?: string | null;
  editingText?: string;
  onStartEdit?: (messageId: string, text: string) => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: (newText: string) => void;
  onEditTextChange?: (text: string) => void;
  sessionError?: string | null;
  onCopy?: (text: string) => void;
  onRetry?: (messageId: string) => void;
  canRetry?: boolean;
  recentSessions: import("../types").Session[];
  onSessionSelect: (sessionId: string) => void;
  onViewAllSessions: () => void;
  showHistory: boolean;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportSession: (sessionId: string) => void;
  onCloseHistory: () => void;
}

export function MessageList(props: MessageListProps) {
  const sync = useSync();
  let containerRef!: HTMLDivElement;
  let contentRef!: HTMLDivElement;
  let historyRef: HTMLDivElement | undefined;
  
  const [pinned, setPinned] = createSignal(true);
  let userInteracting = false;
  let pendingRAF = false;

  const scrollToBottom = () => {
    if (!containerRef) return;
    containerRef.scrollTop = containerRef.scrollHeight;
  };

  const scheduleAutoScroll = () => {
    if (!pinned() || pendingRAF) return;
    pendingRAF = true;
    requestAnimationFrame(() => {
      pendingRAF = false;
      scrollToBottom();
    });
  };

  const isAtBottom = () => {
    if (!containerRef) return true;
    const { scrollHeight, scrollTop, clientHeight } = containerRef;
    return scrollTop + clientHeight >= scrollHeight - 2;
  };

  const handleScroll = () => {
    // Only react to scroll if the user is interacting
    if (!userInteracting) return;
    setPinned(isAtBottom());
  };

  onMount(() => {
    setPinned(true);

    const startUser = () => { userInteracting = true; };
    const endUser = () => { userInteracting = false; };

    containerRef.addEventListener("scroll", handleScroll, { passive: true });
    containerRef.addEventListener("wheel", startUser, { passive: true });
    containerRef.addEventListener("pointerdown", startUser, { passive: true });
    containerRef.addEventListener("touchstart", startUser, { passive: true });

    window.addEventListener("pointerup", endUser, { passive: true });
    window.addEventListener("touchend", endUser, { passive: true });

    const resizeObserver = new ResizeObserver(() => scheduleAutoScroll());
    resizeObserver.observe(contentRef);

    onCleanup(() => {
      containerRef.removeEventListener("scroll", handleScroll);
      containerRef.removeEventListener("wheel", startUser);
      containerRef.removeEventListener("pointerdown", startUser);
      containerRef.removeEventListener("touchstart", startUser);
      window.removeEventListener("pointerup", endUser);
      window.removeEventListener("touchend", endUser);
      resizeObserver.disconnect();
    });
  });

  // Handle new messages
  createEffect(
    on(
      () => props.messages.length,
      () => {
        setPinned(true);
        scheduleAutoScroll();
      }
    )
  );

  // Handle message content changes (streaming)
  createEffect(() => {
    const msgs = props.messages;
    const last = msgs[msgs.length - 1];
    
    // Build a signature that changes when streaming updates arrive
    const lastParts = last ? sync.getParts(last.id) : [];
    const sig = !last
      ? ""
      : lastParts.length
      ? lastParts
          .map(
            (p) =>
              `${p.id}:${p.type}:${p.text?.length ?? 0}:${p.state?.status ?? ""}:${
                p.state?.output?.length ?? 0
              }`
          )
          .join("|")
      : `text:${last.text?.length ?? 0}`;
    
    // Access sig to create reactive dependency
    void sig;
    
    // Trigger auto-scroll if pinned
    scheduleAutoScroll();
  });

  // Handle thinking indicator appearing/disappearing
  createEffect(
    on(
      () => props.isThinking,
      () => scheduleAutoScroll()
    )
  );

  // Handle session error appearing/disappearing
  createEffect(
    on(
      () => props.sessionError,
      () => scheduleAutoScroll()
    )
  );

  createEffect(() => {
    if (!props.showHistory) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (historyRef && !historyRef.contains(e.target as Node)) {
        props.onCloseHistory();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    onCleanup(() => document.removeEventListener("mousedown", handleOutsideClick));
  });

  const getMessageIndex = (messageId: string) => {
    return props.messages.findIndex(m => m.id === messageId);
  };

  const isMessageDimmed = (messageId: string) => {
    const editingId = props.editingMessageId;
    if (!editingId) return false;
    
    const editingIndex = getMessageIndex(editingId);
    const currentIndex = getMessageIndex(messageId);
    
    // Dim messages that come after the one being edited
    return currentIndex > editingIndex;
  };

  return (
    <div class="message-list-root">
      <Show when={props.showHistory}>
        <div class="session-history-overlay" ref={historyRef!}>
          <RecentSessions 
            sessions={props.recentSessions} 
            onSessionSelect={props.onSessionSelect}
            onViewAll={props.onViewAllSessions}
            mode="full"
            onRenameSession={props.onRenameSession}
            onDeleteSession={props.onDeleteSession}
            onExportSession={props.onExportSession}
          />
        </div>
      </Show>

      <div class="messages-container" ref={containerRef!} role="log" aria-label="Messages">
        <div class="messages-content" ref={contentRef!}>
          <Show when={props.messages.length === 0 && !props.isThinking}>
            <RecentSessions 
              sessions={props.recentSessions} 
              onSessionSelect={props.onSessionSelect}
              onViewAll={props.onViewAllSessions}
              mode="compact"
              onRenameSession={props.onRenameSession}
              onDeleteSession={props.onDeleteSession}
              onExportSession={props.onExportSession}
            />
          </Show>

          <For each={props.messages}>
          {(message, index) => {
            const isLastMessage = () => index() === props.messages.length - 1;
            const isStreaming = () => isLastMessage() && props.isThinking && message.type === "assistant";
            const isEditing = () => props.editingMessageId === message.id;
            const isDimmed = () => isMessageDimmed(message.id);
            
            // Get the text content of the message for editing
            const messageText = () => {
              if (message.text) return message.text;
              const msgParts = sync.getParts(message.id);
              if (msgParts.length > 0) {
                return msgParts
                  .filter(
                    (p) =>
                      p.type === "text" &&
                      p.text &&
                      !(p as { synthetic?: boolean }).synthetic
                  )
                  .map(p => p.text)
                  .join("\n");
              }
              return "";
            };
            
            return (
              <Show 
                when={message.type === "user" && isEditing()}
                fallback={
                  <div 
                    class={`message-wrapper ${isDimmed() ? "message-wrapper--dimmed" : ""}`}
                    onClick={() => {
                      if (message.type === "user" && props.onStartEdit && !props.isThinking) {
                        props.onStartEdit(message.id, messageText());
                      }
                    }}
                    style={{ cursor: message.type === "user" && !props.isThinking ? "text" : "default" }}
                  >
                    <MessageItem 
                      message={message} 
                      workspaceRoot={props.workspaceRoot} 
                      pendingPermissions={props.pendingPermissions} 
                      onPermissionResponse={props.onPermissionResponse} 
                      isStreaming={isStreaming()} 
                      onCopy={props.onCopy}
                      onRetry={props.onRetry}
                      canRetry={props.canRetry}
                    />
                  </div>
                }
              >
                <EditableUserMessage
                  text={props.editingText || ""}
                  onTextChange={props.onEditTextChange || (() => {})}
                  onSubmit={() => props.onSubmitEdit?.(props.editingText || "")}
                  onCancel={props.onCancelEdit || (() => {})}
                />
              </Show>
            );
          }}
        </For>

        <ThinkingIndicator when={props.isThinking} />
        
        <Show when={props.sessionError}>
          <div class="session-error" role="alert">
            {props.sessionError}
          </div>
        </Show>
      </div>
    </div>
    </div>
  );
}
