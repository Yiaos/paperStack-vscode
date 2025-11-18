/* @jsxImportSource solid-js */
import { createSignal, createMemo, Show, onMount } from "solid-js";
import { InputBar } from "./components/InputBar";
import { MessageList } from "./components/MessageList";
import { TopBar } from "./components/TopBar";
import { useVsCodeBridge } from "./hooks/useVsCodeBridge";
import { applyPartUpdate, applyMessageUpdate } from "./utils/messageUtils";
import type { Message, Agent, Session } from "./types";

const DEBUG = false;

function App() {
  const [input, setInput] = createSignal("");
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [isThinking, setIsThinking] = createSignal(false);
  const [isReady, setIsReady] = createSignal(false);
  const [agents, setAgents] = createSignal<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = createSignal<string | null>(null);
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] = createSignal<string>("New Session");
  const [workspaceRoot, setWorkspaceRoot] = createSignal<string | undefined>(undefined);

  const hasMessages = createMemo(() =>
    messages().some((m) => m.type === "user" || m.type === "assistant")
  );

  const sessionsToShow = createMemo(() => {
    // Don't show the current session if it's new (no ID yet)
    return sessions().filter(s => s.id !== currentSessionId() || currentSessionId() !== null);
  });

  const { send } = useVsCodeBridge({
    onInit: (ready, workspaceRootPath, sessionId, sessionTitle, incomingMessages) => {
      setIsReady(ready);
      setWorkspaceRoot(workspaceRootPath);
      
      // Restore active session state from backend if it exists
      if (sessionId) {
        setCurrentSessionId(sessionId);
        setCurrentSessionTitle(sessionTitle || "New Session");
        
        // Load messages from the active session
        if (incomingMessages && incomingMessages.length > 0) {
          const messages: Message[] = incomingMessages.map((raw: any) => {
            const m = raw?.info ?? raw;
            const parts = raw?.parts ?? m?.parts ?? [];
            const text =
              m?.text ??
              (Array.isArray(parts)
                ? parts
                    .filter((p: any) => p?.type === "text" && typeof p.text === "string")
                    .map((p: any) => p.text)
                    .join("\n")
                : "");
            
            const role = m?.role ?? "assistant";
            
            return {
              id: m.id,
              type: role === "user" ? "user" : "assistant",
              text,
              parts,
            };
          });
          setMessages(messages);
        }
      }
    },

    onAgentList: (agentList) => {
      setAgents(agentList);
      if (!selectedAgent() && agentList.length > 0) {
        setSelectedAgent(agentList[0].name);
      }
    },

    onThinking: (thinking) => {
      setIsThinking(thinking);
    },

    onPartUpdate: (part) => {
      if (DEBUG) {
        console.log('[Webview] part-update received:', {
          partId: part.id,
          partType: part.type,
          messageID: part.messageID,
        });
      }
      setMessages((prev) => applyPartUpdate(prev, part));
    },

    onMessageUpdate: (finalMessage) => {
      if (DEBUG) {
        console.log('[Webview] message-update received:', {
          id: finalMessage.id,
          role: finalMessage.role,
          hasParts: !!(finalMessage.parts && finalMessage.parts.length > 0)
        });
      }
      setMessages((prev) => applyMessageUpdate(prev, finalMessage));
    },

    onResponse: (payload) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "assistant" as const,
          text: payload.text,
          parts: payload.parts,
        },
      ]);
    },

    onError: (errorMessage) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "assistant" as const,
          text: `Error: ${errorMessage}`,
        },
      ]);
    },

    onSessionList: (sessionList) => {
      setSessions(sessionList);
    },

    onSessionSwitched: (sessionId, title, incomingMessages) => {
      setCurrentSessionId(sessionId);
      setCurrentSessionTitle(title);
      
      // Load messages from the session
      if (incomingMessages && incomingMessages.length > 0) {
        const messages: Message[] = incomingMessages.map((raw: any) => {
          const m = raw?.info ?? raw;
          const parts = raw?.parts ?? m?.parts ?? [];
          const text =
            m?.text ??
            (Array.isArray(parts)
              ? parts
                  .filter((p: any) => p?.type === "text" && typeof p.text === "string")
                  .map((p: any) => p.text)
                  .join("\n")
              : "");
          
          const role = m?.role ?? "assistant";
          
          return {
            id: m.id,
            type: role === "user" ? "user" : "assistant",
            text,
            parts,
          };
        });
        setMessages(messages);
      } else {
        setMessages([]);
      }
    },
  });

  onMount(() => {
    send({ type: "load-sessions" });
  });

  const handleSubmit = () => {
    const text = input().trim();
    if (!text) return;
    
    const agent = agents().some(a => a.name === selectedAgent()) 
      ? selectedAgent() 
      : null;
    
    send({
      type: "sendPrompt",
      text,
      agent,
    });
    setInput("");
  };

  const handleSessionSelect = (sessionId: string) => {
    send({ type: "switch-session", sessionId });
  };

  const handleNewSession = () => {
    send({ type: "create-session" });
    // The session-switched event handler will update the UI state
  };

  return (
    <div class={`app ${hasMessages() ? "app--has-messages" : ""}`}>
      <TopBar
        sessions={sessionsToShow()}
        currentSessionId={currentSessionId()}
        currentSessionTitle={currentSessionTitle()}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
      />

      <Show when={!hasMessages()}>
        <InputBar
          value={input()}
          onInput={setInput}
          onSubmit={handleSubmit}
          disabled={!isReady() || isThinking()}
          selectedAgent={selectedAgent()}
          agents={agents()}
          onAgentChange={setSelectedAgent}
        />
      </Show>

      <MessageList messages={messages()} isThinking={isThinking()} workspaceRoot={workspaceRoot()} />

      <Show when={hasMessages()}>
        <div class="input-divider" />
        <InputBar
          value={input()}
          onInput={setInput}
          onSubmit={handleSubmit}
          disabled={!isReady() || isThinking()}
          selectedAgent={selectedAgent()}
          agents={agents()}
          onAgentChange={setSelectedAgent}
        />
      </Show>
    </div>
  );
}

export default App;
