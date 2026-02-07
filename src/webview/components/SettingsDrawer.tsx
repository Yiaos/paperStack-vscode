import { createSignal, createEffect, onMount, Show } from "solid-js";
import { vscode } from "../utils/vscode";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDrawer(props: SettingsDrawerProps) {
  const [mainFile, setMainFile] = createSignal("");
  const [autoCompile, setAutoCompile] = createSignal(true);
  const [isSaving, setIsSaving] = createSignal(false);

  // Sync settings with host
  onMount(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === "settings-data") {
        setMainFile(e.data.settings.mainFile || "");
        setAutoCompile(e.data.settings.autoCompile ?? true);
      } else if (e.data.type === "settings-updated") {
        setIsSaving(false);
        props.onClose();
      }
    };
    window.addEventListener("message", handleMessage);
    vscode.postMessage({ type: "get-settings" });
  });

  const handleSave = () => {
    setIsSaving(true);
    vscode.postMessage({
      type: "update-settings",
      settings: {
        mainFile: mainFile(),
        autoCompile: autoCompile(),
      },
    });
  };

  return (
    <Show when={props.isOpen}>
      <div class="settings-drawer-overlay" onClick={props.onClose}>
        <div class="settings-drawer" onClick={(e) => e.stopPropagation()}>
          <div class="settings-header">
            <h3>设置</h3>
            <button class="icon-button" onClick={props.onClose} aria-label="关闭">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
          </div>

          <div class="settings-content">
            <div class="setting-item">
              <label>LaTeX 主文件路径</label>
              <input
                type="text"
                class="settings-input"
                placeholder="main.tex"
                value={mainFile()}
                onInput={(e) => setMainFile(e.currentTarget.value)}
              />
              <p class="setting-description">指定编译时的入口文件。</p>
            </div>

            <div class="setting-item setting-item--row">
              <label>自动编译 PDF</label>
              <input
                type="checkbox"
                checked={autoCompile()}
                onChange={(e) => setAutoCompile(e.currentTarget.checked)}
              />
            </div>
          </div>

          <div class="settings-footer">
            <button
              class="shortcut-button shortcut-button--secondary"
              onClick={handleSave}
              disabled={isSaving()}
            >
              {isSaving() ? "正在保存..." : "确认"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
