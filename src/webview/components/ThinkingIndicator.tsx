/* @jsxImportSource solid-js */
import { Show } from "solid-js";

interface ThinkingIndicatorProps {
  when: boolean;
}

export function ThinkingIndicator(props: ThinkingIndicatorProps) {
  return (
    <Show when={props.when}>
      <details class="message message--thinking" open>
        <summary>
          <span class="thinking-icon"></span>
          <span>Thinking...</span>
        </summary>
      </details>
    </Show>
  );
}
