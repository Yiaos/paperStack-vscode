/* @jsxImportSource solid-js */
import type { MessagePart, Permission } from "../types";
import { TextBlock } from "./parts/TextBlock";
import { ReasoningBlock } from "./parts/ReasoningBlock";
import { ToolCall } from "./parts/ToolCall";

interface MessagePartRendererProps {
  part: MessagePart;
  workspaceRoot?: string;
  pendingPermissions?: Map<string, Permission>;
  onPermissionResponse?: (permissionId: string, response: "once" | "always" | "reject") => void;
}

export function MessagePartRenderer(props: MessagePartRendererProps) {
  switch (props.part.type) {
    case "text":
      return <TextBlock part={props.part} />;
    case "reasoning":
      return <ReasoningBlock part={props.part} />;
    case "tool":
      return <ToolCall part={props.part} workspaceRoot={props.workspaceRoot} pendingPermissions={props.pendingPermissions} onPermissionResponse={props.onPermissionResponse} />;
    case "step-start":
    case "step-finish":
      return null;
    default:
      return null;
  }
}
