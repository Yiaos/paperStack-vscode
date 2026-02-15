import { createEffect, onMount } from "solid-js";

interface EditableUserMessageProps {
  text: string;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function EditableUserMessage(props: EditableUserMessageProps) {
  let textareaRef!: HTMLTextAreaElement;

  const adjustTextareaHeight = () => {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, 200)}px`;
    }
  };

  createEffect(() => {
    props.text;
    adjustTextareaHeight();
  });

  onMount(() => {
    textareaRef?.focus();
    // Move cursor to end
    textareaRef.selectionStart = textareaRef.value.length;
    textareaRef.selectionEnd = textareaRef.value.length;
    adjustTextareaHeight();
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onCancel();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      props.onSubmit();
    }
  };

  const handleContainerClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("button") && textareaRef) {
      textareaRef.focus();
    }
  };

  return (
    <div class="input-container" onClick={handleContainerClick} style={{ "margin-top": "8px" }}>
      <textarea
        ref={textareaRef!}
        class="prompt-input"
        value={props.text}
        onInput={(e) => props.onTextChange(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder="Edit your message..."
      />
      <div class="input-footer">
        <div class="input-footer-left"></div>
        <div class="input-footer-right">
          <button
            type="button"
            class="input-action-button input-action-button--stop"
            onClick={() => props.onCancel()}
            aria-label="Cancel (Escape)"
            data-tooltip="Cancel (Escape)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="4" y="4" width="8" height="8" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            class="input-action-button input-action-button--primary"
            disabled={!props.text.trim()}
            onClick={() => props.onSubmit()}
            aria-label="Submit (Cmd+Enter)"
            data-tooltip="Update message (Cmd+Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 1.5l-13 4.5 5.5 1.5 1.5 5.5 6-11.5z" />
              <path d="M7 8l2.5-2.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
