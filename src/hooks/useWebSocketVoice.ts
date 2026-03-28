import { useRef, useState, useCallback } from "react";

const SAMPLE_RATE = 16000;
const CHUNK_DURATION_MS = 100;
const CHUNK_SAMPLES = Math.floor(SAMPLE_RATE * CHUNK_DURATION_MS / 1000);

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function useWebSocketVoice(wsUrl: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState("Idle");

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isMutedRef = useRef(false);
  const currentResponseRef = useRef("");
  const playbackContextRef = useRef<AudioContext | null>(null);

  const addMessage = useCallback((role: "user" | "assistant", content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  }, []);

  const updateLastAssistant = useCallback((content: string) => {
    setMessages(prev => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "assistant") {
          copy[i] = { ...copy[i], content };
          return copy;
        }
      }
      return [...prev, { role: "assistant", content, timestamp: new Date() }];
    });
  }, []);

  const playAudioData = useCallback((audioBytes: ArrayBuffer) => {
    try {
      if (!playbackContextRef.current) {
        playbackContextRef.current = new AudioContext();
      }
      const ctx = playbackContextRef.current;
      
      // Assume server sends PCM16 at 24kHz (common TTS rate) or detect from data
      const pcm16 = new Int16Array(audioBytes);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }
      
      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  }, []);

  const handleWsMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
      // Binary data = audio response
      const handleBinary = async (data: Blob | ArrayBuffer) => {
        const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
        playAudioData(buffer);
      };
      handleBinary(event.data);
      return;
    }

    try {
      const msg = JSON.parse(event.data);
      const msgType = msg.type || "";

      if (msgType === "seg_start") {
        currentResponseRef.current = "";
        setIsStreaming(true);
        setStatusText("AI is responding...");
      } else if (msgType === "token") {
        const token = msg.text || "";
        currentResponseRef.current += token;
        updateLastAssistant(currentResponseRef.current);
      } else if (msgType === "seg_end") {
        const finalText = msg.text || currentResponseRef.current;
        updateLastAssistant(finalText);
        currentResponseRef.current = "";
        setIsStreaming(false);
        setStatusText("Listening...");
      } else if (msgType === "error") {
        setStatusText(`Error: ${msg.message || "Unknown"}`);
        setIsStreaming(false);
      } else if (msgType === "cancelled") {
        setIsStreaming(false);
        setStatusText("Cancelled");
      } else if (msgType === "done") {
        setIsStreaming(false);
        setStatusText("Done");
      }
    } catch {
      // Non-JSON message, ignore
    }
  }, [updateLastAssistant, playAudioData]);

  const startCall = useCallback(async () => {
    try {
      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 48000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      streamRef.current = stream;

      // Audio context for resampling
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessor to capture raw PCM
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Connect WebSocket
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsInCall(true);
        setStatusText("Connected — Listening...");

        // Send greeting silence
        const silence = new ArrayBuffer(SAMPLE_RATE * 2 * 0.2); // 200ms silence
        ws.send(silence);
        ws.send("EOF");

        // Start processing audio
        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = handleWsMessage;

      ws.onclose = () => {
        setIsConnected(false);
        setStatusText("Disconnected");
      };

      ws.onerror = () => {
        setStatusText("Connection error");
        setIsConnected(false);
      };

      // Resample 48kHz -> 16kHz and send
      const ratio = 48000 / SAMPLE_RATE; // 3
      let sendBuffer = new Float32Array(0);
      let isSendingAudio = false;

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) return;

        const input = e.inputBuffer.getChannelData(0);
        
        // Simple downsample by picking every nth sample
        const downsampled = new Float32Array(Math.floor(input.length / ratio));
        for (let i = 0; i < downsampled.length; i++) {
          downsampled[i] = input[Math.floor(i * ratio)];
        }

        // Accumulate and send in chunks
        const merged = new Float32Array(sendBuffer.length + downsampled.length);
        merged.set(sendBuffer);
        merged.set(downsampled, sendBuffer.length);
        sendBuffer = merged;

        while (sendBuffer.length >= CHUNK_SAMPLES) {
          const chunk = sendBuffer.slice(0, CHUNK_SAMPLES);
          sendBuffer = sendBuffer.slice(CHUNK_SAMPLES);

          // Convert to PCM16
          const pcm16 = new Int16Array(chunk.length);
          for (let i = 0; i < chunk.length; i++) {
            const s = Math.max(-1, Math.min(1, chunk[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          if (ws.readyState === WebSocket.OPEN && !isSendingAudio) {
            // Debounce: we send continuously
            ws.send(pcm16.buffer);
          }
        }
      };

    } catch (err) {
      console.error("Failed to start call:", err);
      setStatusText("Mic access denied");
    }
  }, [wsUrl, handleWsMessage]);

  const endCall = useCallback(() => {
    // Send EOF + cancel
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send("EOF");
      wsRef.current.send("CANCEL");
      wsRef.current.close();
    }

    // Stop audio
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());

    wsRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;

    setIsInCall(false);
    setIsConnected(false);
    setIsStreaming(false);
    setStatusText("Call ended");
    setMessages([]);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      isMutedRef.current = !prev;
      return !prev;
    });
  }, []);

  return {
    isConnected,
    isInCall,
    isMuted,
    isStreaming,
    messages,
    statusText,
    startCall,
    endCall,
    toggleMute,
  };
}
