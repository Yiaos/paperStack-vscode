
import { For, Show, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";
import type { Message, Permission, MessagePart } from "../types";
import { MessagePartRenderer } from "./MessagePartRenderer";
import { Streamdown } from "../lib/streamdown";
import { vscode } from "../utils/vscode";
import { useSync } from "../state/sync";

interface MessageItemProps {
  message: Message;
  workspaceRoot?: string;
  pendingPermissions?: Accessor<Map<string, Permission>>;
  onPermissionResponse?: (permissionId: string, response: "once" | "always" | "reject") => void;
  isStreaming?: boolean;
  onCopy?: (text: string) => void;
  onRetry?: (messageId: string) => void;
  canRetry?: boolean;
}

export function MessageItem(props: MessageItemProps) {
  const sync = useSync();
  const parts = () => sync.getParts(props.message.id);
  const hasParts = () => parts().length > 0;
  const isUser = () => props.message.type === "user";
  const [copied, setCopied] = createSignal(false);
  let copyTimeout: number | undefined;
  
  // Derive user message text from parts (text parts only, excluding synthetic/ignored)
  const userText = createMemo(() => {
    if (!isUser()) return props.message.text ?? "";
    // Prefer message.text if set, otherwise derive from parts
    if (props.message.text) return props.message.text;
    const messageParts = parts();
    return messageParts
      .filter(
        (p) =>
          p?.type === "text" &&
          typeof p.text === "string" &&
          !(p as { synthetic?: boolean }).synthetic &&
          !(p as { ignored?: boolean }).ignored
      )
      .map((p) => p.text as string)
      .join("\n");
  });

  // Aggregate all text from assistant message parts for copy
  const assistantText = createMemo(() => {
    if (isUser()) return "";
    const messageParts = parts();
    if (messageParts.length > 0) {
      // Only include standard text parts, excluding reasoning and other tool/meta parts
      return messageParts
        .filter((p) => p.type === "text" && typeof p.text === "string" && !(p as { synthetic?: boolean }).synthetic)
        .map((p) => p.text as string)
        .join("\n");
    }
    return props.message.text ?? "";
  });
  
  const userAttachments = createMemo(() => {
    const messageParts = parts();
    return messageParts
      .filter((part) => part.type === "file")
      .map((part) => {
        const filePart = part as MessagePart & { url?: string; filename?: string };
        const url = filePart.url || "";
        let filename = filePart.filename || "";
        let start: number | undefined;
        let end: number | undefined;

        if (url) {
          try {
            const parsed = new URL(url);
            const startRaw = parsed.searchParams.get("start");
            const endRaw = parsed.searchParams.get("end");
            start = startRaw ? Number(startRaw) : undefined;
            end = endRaw ? Number(endRaw) : undefined;
            if (!filename && parsed.pathname) {
              const pathname = decodeURIComponent(parsed.pathname);
              const parts = pathname.split("/");
              filename = parts[parts.length - 1] || pathname;
            }
          } catch {
            // Ignore non-file URLs
          }
        }

        const labelBase = filename || url || "attachment";
        const label =
          Number.isFinite(start) && start !== undefined
            ? `${labelBase} L${start}${Number.isFinite(end) && end !== start ? `-${end}` : ""}`
            : labelBase;

        return {
          id: filePart.id || `${url}-${label}`,
          label,
          title: filename ? labelBase : url,
          url,
          startLine: Number.isFinite(start) ? start : undefined,
          endLine: Number.isFinite(end) ? end : undefined,
        };
      });
  });

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    const text = assistantText();
    if (text && props.onCopy) {
      props.onCopy(text);
      setCopied(true);
      if (copyTimeout) {
        clearTimeout(copyTimeout);
      }
      copyTimeout = window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRetry = (e: MouseEvent) => {
    e.stopPropagation();
    if (props.canRetry === false) {
      return;
    }
    if (props.onRetry) {
      props.onRetry(props.message.id);
    }
  };

  onCleanup(() => {
    if (copyTimeout) {
      clearTimeout(copyTimeout);
    }
  });
  
  return (
    <div class={`message message--${props.message.type}`} role="article" aria-label={`${props.message.type} message`}>
      <div class="message-content">
        <Show when={isUser()}>
          <Show when={userAttachments().length > 0}>
            <div class="message-attachments">
              <For each={userAttachments()}>
                {(attachment) => (
                  <button
                    type="button"
                    class="message-attachment"
                    data-tooltip={attachment.title ?? attachment.label}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!attachment.url) return;
                      vscode.postMessage({
                        type: "open-file",
                        url: attachment.url,
                        startLine: attachment.startLine,
                        endLine: attachment.endLine,
                      });
                    }}
                  >
                    <span class="message-attachment__text">{attachment.label}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={userText()}>
            <div class="message-text user-message-text">{userText()}</div>
          </Show>
        </Show>
        <Show
          when={!isUser()}
          fallback={null}
        >
          <Show 
            when={hasParts()} 
            fallback={
              <Show when={props.message.text}>
                <Streamdown mode={props.isStreaming ? "streaming" : "static"} class="message-text">
                  {props.message.text!}
                </Streamdown>
              </Show>
            }
          >
            <For each={parts()}>
              {(part) => <MessagePartRenderer part={part} workspaceRoot={props.workspaceRoot} pendingPermissions={props.pendingPermissions} onPermissionResponse={props.onPermissionResponse} isStreaming={props.isStreaming} />}
            </For>
          </Show>
        </Show>
      </div>
      <Show when={!isUser() && !props.isStreaming && (assistantText() !== "" || props.canRetry)}>
        <div class="message-action-bar">
          <Show when={assistantText() !== ""}>
            <button
              class="message-action-btn"
              onClick={handleCopy}
              aria-label={copied() ? "Copied" : "Copy"}
              data-tooltip={copied() ? "Copied!" : "Copy message"}
            >
              <Show when={copied()} fallback={
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="5.5" y="5.5" width="8" height="8" rx="1"/>
                  <path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1"/>
                </svg>
              }>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 8.5l3 3 7-7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </Show>
            </button>
          </Show>
          <Show when={props.onRetry}>
            <button
              class="message-action-btn"
              onClick={handleRetry}
              aria-label="Retry"
              data-tooltip={props.canRetry === false ? "Retry available after completion" : "Retry this message"}
              disabled={props.canRetry === false}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13.5 8a5.5 5.5 0 1 1-1.5-3.83L13.5 5.5"/>
                <path d="M13.5 2v3.5H10"/>
              </svg>
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
