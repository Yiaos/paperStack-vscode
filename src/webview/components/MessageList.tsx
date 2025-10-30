/* @jsxImportSource solid-js */
import { For, createEffect } from "solid-js";
import type { Message } from "../types";
import { MessageItem } from "./MessageItem";
import { ThinkingIndicator } from "./ThinkingIndicator";

interface MessageListProps {
  messages: Message[];
  isThinking: boolean;
  workspaceRoot?: string;
}

export function MessageList(props: MessageListProps) {
  let containerRef!: HTMLDivElement;
  let endRef!: HTMLDivElement;

  const shouldStick = () => {
    const el = containerRef;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  createEffect(() => {
    props.messages;
    props.isThinking;
    if (shouldStick()) {
      requestAnimationFrame(() => {
        endRef?.scrollIntoView({ behavior: "auto" });
      });
    }
  });

  return (
    <div class="messages-container" ref={containerRef!}>
      <For each={props.messages}>
        {(message) => <MessageItem message={message} workspaceRoot={props.workspaceRoot} />}
      </For>

      <ThinkingIndicator when={props.isThinking} />

      <div ref={endRef!} />
    </div>
  );
}
