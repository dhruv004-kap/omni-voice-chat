import { useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, FileText, Settings } from "lucide-react";
import { useWebSocketVoice } from "@/hooks/useWebSocketVoice";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { Input } from "@/components/ui/input";

const DEFAULT_WS_URL = "wss://warm-slightly-mutt.ngrok-free.app/ws/chat";
const WAVEFORM_BARS = [16, 30, 20, 40, 24, 36, 18, 34, 22, 42, 26, 32, 18, 38, 24, 30, 20, 36, 16, 28];

export function VoiceBotUI() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [showSettings, setShowSettings] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const contentShiftClass = showTranscript ? "lg:-translate-x-64" : "lg:translate-x-0";
  const settingsPositionClass = showTranscript ? "right-5 lg:right-[36rem]" : "right-5";

  const {
    isInCall,
    isMuted,
    isStreaming,
    isUserSpeaking,
    messages,
    statusText,
    startCall,
    endCall,
    toggleMute,
    clearHistory,
  } = useWebSocketVoice(wsUrl);
  const showWaveform = isStreaming || isUserSpeaking;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060606]">
      {/* Ambient glow line */}
      {/* Settings gear */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className={`absolute top-6 z-30 text-muted-foreground transition-all duration-500 hover:text-foreground ${settingsPositionClass}`}
      >
        <Settings className="h-6 w-6" />
      </button>

      {showSettings && (
        <div className={`absolute top-16 z-30 w-96 rounded-xl border border-[hsl(var(--border))] bg-[hsl(220_15%_8%)] p-5 shadow-2xl transition-all duration-500 ${settingsPositionClass}`}>
          <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            WebSocket URL
          </label>
          <Input
            value={wsUrl}
            onChange={e => setWsUrl(e.target.value)}
            className="mt-3 h-11 bg-[hsl(220_15%_12%)] border-[hsl(220_10%_20%)] text-base text-foreground"
            disabled={isInCall}
            placeholder="ws://..."
          />
        </div>
      )}

      <div className="flex min-h-screen items-center justify-center px-6">
        <div className={`relative z-10 flex w-full max-w-3xl flex-col items-center text-center transition-transform duration-500 ${contentShiftClass}`}>
          {/* Pulse ring when in call */}
          {isInCall && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="h-52 w-52 animate-ping rounded-full bg-[hsl(160_80%_45%/0.06)]" style={{ animationDuration: "2s" }} />
              <div className="absolute inset-5 animate-ping rounded-full bg-[hsl(160_80%_45%/0.04)]" style={{ animationDuration: "3s" }} />
            </div>
          )}

          {/* Top branding */}
          <div className="relative mb-5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              <span className="text-[hsl(160_80%_55%)]">VELO</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground tracking-[0.28em] uppercase">
              Voice Agent
            </p>
          </div>

          <div className="pointer-events-none mb-10 h-px w-[min(96vw,1080px)]">
            <div className="relative mx-auto flex h-10 w-full items-center justify-center overflow-hidden">
              <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-gradient-to-r from-transparent via-[hsl(190_100%_50%/0.6)] to-transparent blur-sm transition-all duration-500" />
              <div className="absolute left-1/2 top-1/2 h-[2px] w-2/3 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-[hsl(160_100%_55%/0.55)] to-transparent transition-all duration-500" />
              {showWaveform && (
                <div className="relative flex h-full w-[min(70vw,720px)] items-center justify-center gap-1.5">
                  {WAVEFORM_BARS.map((height, index) => (
                    <span
                      key={index}
                      className="w-1.5 rounded-full bg-[hsl(160_90%_58%)] shadow-[0_0_10px_hsl(160_90%_58%/0.45)]"
                      style={{
                        height: `${height}px`,
                        animation: `voice-wave ${0.85 + (index % 4) * 0.18}s ease-in-out ${index * 0.06}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="mb-14 max-w-xl text-base leading-relaxed text-muted-foreground">
            Have a casual conversation with a voice agent powered by Velo. Ask questions and get real-time responses.
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-12">
            {/* Transcript */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className={`flex h-[68px] w-[68px] items-center justify-center rounded-full border transition-all duration-300 ${
                    showTranscript
                      ? "border-[hsl(160_60%_40%)] bg-[hsl(160_50%_15%)] text-[hsl(160_80%_55%)]"
                      : "border-[hsl(220_10%_25%)] bg-[hsl(220_10%_12%)] text-muted-foreground hover:bg-[hsl(220_10%_16%)]"
                  }`}
                >
                  <FileText className="h-6 w-6" />
                </button>
                {messages.length > 0 && (
                  <div className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(160_70%_50%)] text-sm font-bold text-white shadow-lg">
                    {messages.length}
                  </div>
                )}
              </div>
              <span className="text-sm text-muted-foreground">Transcript</span>
            </div>

            {/* Call button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={isInCall ? endCall : startCall}
                className={`flex h-[88px] w-[88px] items-center justify-center rounded-full transition-all duration-300 shadow-lg ${
                  isInCall
                    ? "bg-[hsl(0_70%_50%)] hover:bg-[hsl(0_70%_45%)] shadow-[0_0_30px_hsl(0_70%_50%/0.3)]"
                    : "bg-[hsl(160_70%_42%)] hover:bg-[hsl(160_70%_38%)] shadow-[0_0_30px_hsl(160_70%_42%/0.3)]"
                }`}
              >
                {isInCall ? (
                  <PhoneOff className="h-8 w-8 text-white" />
                ) : (
                  <Phone className="h-8 w-8 text-white" />
                )}
              </button>
              <span className="text-sm text-muted-foreground">
                {isInCall ? "End Call" : "Start Call"}
              </span>
            </div>

            {/* Mute */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={toggleMute}
                disabled={!isInCall}
                className={`flex h-[68px] w-[68px] items-center justify-center rounded-full border transition-all duration-300 ${
                  !isInCall
                    ? "border-[hsl(220_10%_20%)] bg-[hsl(220_10%_10%)] text-[hsl(220_10%_30%)] cursor-not-allowed"
                    : isMuted
                      ? "border-[hsl(0_60%_40%)] bg-[hsl(0_50%_15%)] text-[hsl(0_70%_60%)]"
                      : "border-[hsl(220_10%_25%)] bg-[hsl(220_10%_12%)] text-muted-foreground hover:bg-[hsl(220_10%_16%)]"
                }`}
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
              <span className="text-sm text-muted-foreground">
                {isMuted ? "Unmute" : "Mute"}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="mt-10 flex items-center gap-3">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                isInCall
                  ? "bg-[hsl(160_80%_55%)] shadow-[0_0_6px_hsl(160_80%_55%/0.6)]"
                  : "bg-muted-foreground"
              }`}
            />
            <span className="text-sm text-muted-foreground">{statusText}</span>
          </div>

          {/* Streaming indicator */}
          {isStreaming && (
            <div className="mt-5 flex items-center gap-2">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="h-4 w-1 rounded-full bg-[hsl(160_80%_55%)] animate-pulse"
                  style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transcript panel */}
      <TranscriptPanel
        messages={messages}
        isOpen={showTranscript}
        onClose={() => setShowTranscript(false)}
        isStreaming={isStreaming}
        onClearHistory={clearHistory}
      />

      <style>{`
        @keyframes voice-wave {
          0%, 100% { transform: scaleY(0.25); opacity: 0.35; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
