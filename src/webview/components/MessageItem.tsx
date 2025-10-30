/* @jsxImportSource solid-js */
import { For, Show } from "solid-js";
import type { Message } from "../types";
import { MessagePartRenderer } from "./MessagePartRenderer";

interface MessageItemProps {
  message: Message;
  workspaceRoot?: string;
}

export function MessageItem(props: MessageItemProps) {
  return (
    <div class={`message message--${props.message.type}`}>
      <div class="message-content">
        <Show when={props.message.parts} fallback={props.message.text}>
          <For each={props.message.parts}>
            {(part) => <MessagePartRenderer part={part} workspaceRoot={props.workspaceRoot} />}
          </For>
        </Show>
      </div>
    </div>
  );
}
