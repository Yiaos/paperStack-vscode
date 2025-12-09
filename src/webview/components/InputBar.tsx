/* @jsxImportSource solid-js */
import { createEffect, Show } from "solid-js";
import type { Agent } from "../types";
import { AgentSwitcher } from "./AgentSwitcher";

interface InputBarProps {
  value: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  selectedAgent: string | null;
  agents: Agent[];
  onAgentChange: (agentName: string) => void;
}

export function InputBar(props: InputBarProps) {
  let inputRef!: HTMLTextAreaElement;

  const adjustTextareaHeight = () => {
    if (inputRef) {
      inputRef.style.height = "auto";
      inputRef.style.height = `${Math.min(
        inputRef.scrollHeight,
        120
      )}px`;
    }
  };

  createEffect(() => {
    props.value;
    adjustTextareaHeight();
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!props.value.trim() || props.disabled) {
      return;
    }
    props.onSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleContainerClick = (e: MouseEvent) => {
    // Focus the textarea when clicking anywhere in the container
    // except on interactive elements (buttons)
    const target = e.target as HTMLElement;
    if (
      !target.closest("button") &&
      !target.closest(".agent-switcher-button") &&
      inputRef
    ) {
      inputRef.focus();
    }
  };

  return (
    <form class="input-container" onSubmit={handleSubmit} onClick={handleContainerClick}>
      <textarea
        ref={inputRef!}
        class="prompt-input"
        placeholder=""
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        disabled={props.disabled}
      />
      <div class="input-buttons">
        <Show when={props.agents.length > 0}>
          <AgentSwitcher
            agents={props.agents}
            selectedAgent={props.selectedAgent}
            onAgentChange={props.onAgentChange}
          />
        </Show>
        <button
          type="submit"
          class="shortcut-button shortcut-button--secondary"
          disabled={props.disabled || !props.value.trim()}
          aria-label="Submit (Cmd+Enter)"
        >
          ⌘⏎
        </button>
      </div>
    </form>
  );
}
