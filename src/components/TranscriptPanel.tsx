import { useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import type { ChatMessage } from "@/hooks/useWebSocketVoice";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TranscriptPanelProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
  isStreaming: boolean;
  onClearHistory?: () => void;
}

export function TranscriptPanel({ messages, isOpen, onClose, isStreaming, onClearHistory }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAssistantIndex = [...messages].reverse().findIndex(msg => msg.role === "assistant");
  const streamingAssistantIndex =
    lastAssistantIndex === -1 ? -1 : messages.length - 1 - lastAssistantIndex;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      className={`pointer-events-none fixed inset-y-0 right-0 z-50 flex w-full justify-end p-3 sm:p-4 transition-transform duration-500 ease-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="pointer-events-auto flex h-full w-full max-w-[30rem] flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(160_60%_4%/0.96)] backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-7 py-5">
          <h3 className="text-base font-semibold tracking-[0.24em] uppercase text-[hsl(160_80%_55%)]">
            Transcript
          </h3>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-muted-foreground hover:text-red-400 transition-colors"
                title="Clear history"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="min-h-0 flex-1 px-7 py-5">
          {messages.length === 0 && (
            <p className="py-10 text-center text-base text-muted-foreground">
              Conversation will appear here...
            </p>
          )}
          <div className="space-y-5">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="flex flex-col gap-1">
                  <div
                    className={`max-w-[85%] rounded-2xl px-5 py-3 text-base leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[hsl(160_50%_15%)] text-[hsl(160_30%_85%)]"
                        : "bg-[hsl(220_10%_15%)] text-[hsl(220_10%_85%)]"
                    }`}
                  >
                    {msg.role === "user" ? "🎤 Speaking..." : msg.content}
                    {msg.role === "assistant" && i === streamingAssistantIndex && isStreaming && (
                      <span className="ml-1 inline-block h-5 w-1.5 animate-pulse rounded-full bg-[hsl(160_80%_55%)] align-middle" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 px-2 text-sm text-muted-foreground">
                    {msg.role === "assistant" && msg.ttft !== undefined && (
                      <span>⏱️ TTFT: {msg.ttft}ms</span>
                    )}
                    {msg.timestamp && (
                      <span>🕒 {new Date(msg.timestamp).toLocaleTimeString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div ref={bottomRef} />
        </ScrollArea>
      </div>
    </div>
  );
}
