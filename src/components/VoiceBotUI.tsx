import { useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, FileText, Settings } from "lucide-react";
import { useWebSocketVoice } from "@/hooks/useWebSocketVoice";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { Input } from "@/components/ui/input";

const DEFAULT_WS_URL = "ws://205.147.100.19/ws/omni";

export function VoiceBotUI() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [showSettings, setShowSettings] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const {
    isInCall,
    isMuted,
    isStreaming,
    messages,
    statusText,
    startCall,
    endCall,
    toggleMute,
  } = useWebSocketVoice(wsUrl);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#060606]">
      {/* Ambient glow line */}
      <div className="pointer-events-none absolute top-[38%] left-0 right-0 h-px">
        <div className="mx-auto h-[2px] w-3/4 bg-gradient-to-r from-transparent via-[hsl(190_100%_50%/0.6)] to-transparent blur-sm" />
        <div className="mx-auto mt-[-1px] h-px w-1/2 bg-gradient-to-r from-transparent via-[hsl(160_100%_55%/0.4)] to-transparent" />
      </div>

      {/* Pulse ring when in call */}
      {isInCall && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-44 w-44 animate-ping rounded-full bg-[hsl(160_80%_45%/0.06)]" style={{ animationDuration: "2s" }} />
          <div className="absolute inset-4 animate-ping rounded-full bg-[hsl(160_80%_45%/0.04)]" style={{ animationDuration: "3s" }} />
        </div>
      )}

      {/* Settings gear */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        <Settings className="h-5 w-5" />
      </button>

      {showSettings && (
        <div className="absolute top-14 right-6 z-20 w-80 rounded-xl border border-[hsl(var(--border))] bg-[hsl(220_15%_8%)] p-4 shadow-2xl">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            WebSocket URL
          </label>
          <Input
            value={wsUrl}
            onChange={e => setWsUrl(e.target.value)}
            className="mt-2 bg-[hsl(220_15%_12%)] border-[hsl(220_10%_20%)] text-foreground text-sm"
            disabled={isInCall}
            placeholder="ws://..."
          />
        </div>
      )}

      {/* Top branding */}
      <div className="mb-4 text-center z-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Qwen3 <span className="text-[hsl(160_80%_55%)]">Omni</span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground tracking-widest uppercase">
          Voice Agent
        </p>
      </div>

      {/* Description */}
      <p className="z-10 mb-12 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
        Have a casual conversation with our AI voice agent powered by Qwen3 Omni. Ask questions and get real-time responses.
      </p>

      {/* Action buttons */}
      <div className="z-10 flex items-center gap-10">
        {/* Transcript */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-300 ${
              showTranscript
                ? "border-[hsl(160_60%_40%)] bg-[hsl(160_50%_15%)] text-[hsl(160_80%_55%)]"
                : "border-[hsl(220_10%_25%)] bg-[hsl(220_10%_12%)] text-muted-foreground hover:bg-[hsl(220_10%_16%)]"
            }`}
          >
            <FileText className="h-5 w-5" />
          </button>
          <span className="text-xs text-muted-foreground">Transcript</span>
        </div>

        {/* Call button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={isInCall ? endCall : startCall}
            className={`flex h-[72px] w-[72px] items-center justify-center rounded-full transition-all duration-300 shadow-lg ${
              isInCall
                ? "bg-[hsl(0_70%_50%)] hover:bg-[hsl(0_70%_45%)] shadow-[0_0_30px_hsl(0_70%_50%/0.3)]"
                : "bg-[hsl(160_70%_42%)] hover:bg-[hsl(160_70%_38%)] shadow-[0_0_30px_hsl(160_70%_42%/0.3)]"
            }`}
          >
            {isInCall ? (
              <PhoneOff className="h-7 w-7 text-white" />
            ) : (
              <Phone className="h-7 w-7 text-white" />
            )}
          </button>
          <span className="text-xs text-muted-foreground">
            {isInCall ? "End Call" : "Start Call"}
          </span>
        </div>

        {/* Mute */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={toggleMute}
            disabled={!isInCall}
            className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-300 ${
              !isInCall
                ? "border-[hsl(220_10%_20%)] bg-[hsl(220_10%_10%)] text-[hsl(220_10%_30%)] cursor-not-allowed"
                : isMuted
                  ? "border-[hsl(0_60%_40%)] bg-[hsl(0_50%_15%)] text-[hsl(0_70%_60%)]"
                  : "border-[hsl(220_10%_25%)] bg-[hsl(220_10%_12%)] text-muted-foreground hover:bg-[hsl(220_10%_16%)]"
            }`}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <span className="text-xs text-muted-foreground">
            {isMuted ? "Unmute" : "Mute"}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="z-10 mt-8 flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            isInCall
              ? "bg-[hsl(160_80%_55%)] shadow-[0_0_6px_hsl(160_80%_55%/0.6)]"
              : "bg-muted-foreground"
          }`}
        />
        <span className="text-xs text-muted-foreground">{statusText}</span>
      </div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="z-10 mt-4 flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-3 w-0.5 rounded-full bg-[hsl(160_80%_55%)] animate-pulse"
              style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
            />
          ))}
        </div>
      )}

      {/* Transcript panel */}
      <TranscriptPanel
        messages={messages}
        isOpen={showTranscript}
        onClose={() => setShowTranscript(false)}
        isStreaming={isStreaming}
      />
    </div>
  );
}
