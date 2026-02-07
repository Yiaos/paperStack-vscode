import { Show, createMemo } from "solid-js";
import type { SyncStatus } from "../state/types";
import { useOpenCode } from "../hooks/useOpenCode";

interface LoadingOverlayProps {
  status: SyncStatus;
  logoUri?: string;
  onDismiss?: () => void;
  onReconnect?: () => void;
}

export function LoadingOverlay(props: LoadingOverlayProps) {
  const sdk = useOpenCode();
  const statusText = createMemo(() => {
    switch (props.status.status) {
      case "disconnected":
        return "已断开连接";
      case "connecting":
        return "正在连接 PaperStack 服务...";
      case "reconnecting":
        return "正在重新连接...";
      case "bootstrapping":
        return "正在加载数据...";
      case "error":
        return `连接失败: ${props.status.message}`;
      default:
        return "正在准备写作环境...";
    }
  });

  // 判断是否可以关闭（非强制等待状态）
  const canDismiss = createMemo(() => {
    const s = props.status.status;
    const attempt = props.status.status === "reconnecting" ? props.status.attempt : 0;
    // 错误、断开，或者重试次数过多时可以关闭
    return s === "error" || s === "disconnected" || (s === "reconnecting" && attempt >= 4);
  });

  // 判断是否显示重连按钮
  const showReconnect = createMemo(() => {
    const s = props.status.status;
    const attempt = props.status.status === "reconnecting" ? props.status.attempt : 0;
    // 错误、断开，或者重试次数过多（>=4次）时显示重启按钮
    return s === "error" || s === "disconnected" || (s === "reconnecting" && attempt >= 4);
  });

  // 判断是否显示进度条
  const showProgress = createMemo(() => {
    const s = props.status.status;
    return s === "connecting" || s === "bootstrapping" || s === "reconnecting";
  });

  // 判断是否显示警告图标 (超过3次重试)
  const showWarning = createMemo(() => {
    const s = props.status.status;
    const attempt = s === "reconnecting" ? (props.status.attempt ?? 0) : 0;
    return s === "error" || s === "disconnected" || (s === "reconnecting" && attempt > 3);
  });

  return (
    <div class="status-banner" role="status" aria-live="polite">
      <div class="status-banner__content">
        <Show when={showProgress()}>
          <div class="status-banner__spinner" />
        </Show>
        <Show when={showWarning()}>
          <span class="status-banner__icon">⚠️</span>
        </Show>
        <span class="status-banner__text">{statusText()}</span>
      </div>
      <div class="status-banner__actions">
        <Show when={showReconnect()}>
          <button
            class="status-banner__btn status-banner__btn--primary"
            onClick={() => {
              // 如果提供了 onReconnect，说明是手动重试（软重连）
              // 但为了应对后端进程崩溃，这里建议直接 Reload Window
              // 我们保留 onReconnect 接口，但在 UI 上我们倾向于 reloadWindow
              // 或者我们可以根据状态决定？
              // 用户需求明确：点击后运行 Developer: Reload Window
              sdk.reloadWindow();
            }}
          >
            重启窗口
          </button>
        </Show>
        {/* <Show when={canDismiss()}>
          <button
            class="status-banner__btn status-banner__btn--dismiss"
            onClick={() => props.onDismiss?.()}
            aria-label="关闭提示"
          >
            ×
          </button>
        </Show> */}
      </div>
    </div>
  );
}
