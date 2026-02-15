interface NewSessionButtonProps {
  onClick: () => void;
}

export function NewSessionButton(props: NewSessionButtonProps) {
  return (
    <button
      class="icon-button"
      onClick={props.onClick}
      aria-label="新建会话"
      data-tooltip="新建会话"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
      </svg>
    </button>
  );
}