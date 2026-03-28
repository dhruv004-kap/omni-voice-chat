import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { ChatMessage } from "@/hooks/useWebSocketVoice";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TranscriptPanelProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
  isStreaming: boolean;
}

export function TranscriptPanel({ messages, isOpen, onClose, isStreaming }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-500 ease-out ${
        isOpen ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto max-w-2xl rounded-t-2xl border border-[hsl(var(--border))] bg-[hsl(160_60%_4%)] backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <h3 className="text-sm font-semibold tracking-wider uppercase text-[hsl(160_80%_55%)]">
            Transcript
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <ScrollArea className="h-72 px-6 py-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Conversation will appear here...
            </p>
          )}
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[hsl(160_50%_15%)] text-[hsl(160_30%_85%)]"
                      : "bg-[hsl(220_10%_15%)] text-[hsl(220_10%_85%)]"
                  }`}
                >
                  {msg.role === "user" ? "🎤 Speaking..." : msg.content}
                  {msg.role === "assistant" && i === messages.length - 1 && isStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-1 bg-[hsl(160_80%_55%)] animate-pulse rounded-full align-middle" />
                  )}
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
