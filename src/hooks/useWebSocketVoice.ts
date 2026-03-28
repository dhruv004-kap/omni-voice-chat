// import { useRef, useState, useCallback, useEffect } from "react";

// const SAMPLE_RATE = 16000;
// const CHUNK_DURATION_MS = 100;
// const CHUNK_SAMPLES = Math.floor(SAMPLE_RATE * CHUNK_DURATION_MS / 1000);
// const STORAGE_KEY = "voice_chat_history";

// export interface ChatMessage {
//   role: "user" | "assistant";
//   content: string;
//   timestamp: Date;
//   ttft?: number; // Time To First Token in milliseconds
// }

// export function useWebSocketVoice(wsUrl: string) {
//   const [isConnected, setIsConnected] = useState(false);
//   const [isInCall, setIsInCall] = useState(false);
//   const [isMuted, setIsMuted] = useState(false);
//   const [messages, setMessages] = useState<ChatMessage[]>(() => {
//     // Load from localStorage on mount and convert timestamp strings to Date objects
//     try {
//       const saved = localStorage.getItem(STORAGE_KEY);
//       if (saved) {
//         const parsed = JSON.parse(saved);
//         return parsed.map((msg: any) => ({
//           ...msg,
//           timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp,
//         }));
//       }
//       return [];
//     } catch {
//       return [];
//     }
//   });
//   const [isStreaming, setIsStreaming] = useState(false);
//   const [statusText, setStatusText] = useState("Idle");

//   const wsRef = useRef<WebSocket | null>(null);
//   const audioContextRef = useRef<AudioContext | null>(null);
//   const streamRef = useRef<MediaStream | null>(null);
//   const processorRef = useRef<ScriptProcessorNode | null>(null);
//   const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
//   const isMutedRef = useRef(false);
//   const currentResponseRef = useRef("");
//   const playbackContextRef = useRef<AudioContext | null>(null);
//   const lastMessageTimeRef = useRef<number>(0); // Track when last segment started (for TTFT)
//   const firstTokenReceivedRef = useRef(false); // Track if we got first token for current segment
//   const currentAssistantIndexRef = useRef<number | null>(null);

//   // Save messages to localStorage whenever they change
//   useEffect(() => {
//     localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
//   }, [messages]);

//   const addMessage = useCallback((role: "user" | "assistant", content: string, ttft?: number) => {
//     setMessages(prev => [...prev, { role, content, timestamp: new Date(), ttft }]);
//   }, []);

//   const addAssistantMessage = useCallback((content = "") => {
//     setMessages(prev => {
//       currentAssistantIndexRef.current = prev.length;
//       return [...prev, { role: "assistant", content, timestamp: new Date() }];
//     });
//   }, []);

//   const updateCurrentAssistant = useCallback((content: string, ttft?: number) => {
//     setMessages(prev => {
//       const index = currentAssistantIndexRef.current;

//       if (index === null || !prev[index] || prev[index].role !== "assistant") {
//         currentAssistantIndexRef.current = prev.length;
//         return [...prev, { role: "assistant", content, timestamp: new Date(), ttft }];
//       }

//       const copy = [...prev];
//       copy[index] = { ...copy[index], content, ...(ttft !== undefined && { ttft }) };
//       return copy;
//     });
//   }, []);

//   const playAudioData = useCallback((audioBytes: ArrayBuffer) => {
//     try {
//       if (!playbackContextRef.current) {
//         playbackContextRef.current = new AudioContext();
//       }
//       const ctx = playbackContextRef.current;
      
//       // Assume server sends PCM16 at 24kHz (common TTS rate) or detect from data
//       const pcm16 = new Int16Array(audioBytes);
//       const float32 = new Float32Array(pcm16.length);
//       for (let i = 0; i < pcm16.length; i++) {
//         float32[i] = pcm16[i] / 32768;
//       }
      
//       const buffer = ctx.createBuffer(1, float32.length, 24000);
//       buffer.getChannelData(0).set(float32);
//       const source = ctx.createBufferSource();
//       source.buffer = buffer;
//       source.connect(ctx.destination);
//       source.start();
//     } catch (e) {
//       console.error("Audio playback error:", e);
//     }
//   }, []);

//   const handleWsMessage = useCallback((event: MessageEvent) => {
//     if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
//       // Binary data = audio response
//       const handleBinary = async (data: Blob | ArrayBuffer) => {
//         const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
//         playAudioData(buffer);
//       };
//       handleBinary(event.data);
//       return;
//     }

//     try {
//       const msg = JSON.parse(event.data);
//       const msgType = msg.type || "";

//       if (msgType === "seg_start") {
//         currentResponseRef.current = "";
//         firstTokenReceivedRef.current = false;
//         lastMessageTimeRef.current = Date.now(); // Record time when new segment starts
//         addAssistantMessage();
//         setIsStreaming(true);
//         setStatusText("AI is responding...");
//       } else if (msgType === "token") {
//         const token = msg.text || "";
        
//         // Calculate TTFT on first token of this segment
//         if (!firstTokenReceivedRef.current && lastMessageTimeRef.current > 0) {
//           firstTokenReceivedRef.current = true;
//           const ttft = Date.now() - lastMessageTimeRef.current;
//           currentResponseRef.current += token;
//           updateCurrentAssistant(currentResponseRef.current, ttft);
//         } else {
//           currentResponseRef.current += token;
//           updateCurrentAssistant(currentResponseRef.current);
//         }
//       } else if (msgType === "seg_end") {
//         const finalText = msg.text || currentResponseRef.current;
//         updateCurrentAssistant(finalText);
//         currentResponseRef.current = "";
//         currentAssistantIndexRef.current = null;
//         setIsStreaming(false);
//         setStatusText("Listening...");
//       } else if (msgType === "error") {
//         currentAssistantIndexRef.current = null;
//         setStatusText(`Error: ${msg.message || "Unknown"}`);
//         setIsStreaming(false);
//       } else if (msgType === "cancelled") {
//         currentAssistantIndexRef.current = null;
//         setIsStreaming(false);
//         setStatusText("Cancelled");
//       } else if (msgType === "done") {
//         currentAssistantIndexRef.current = null;
//         setIsStreaming(false);
//         setStatusText("Done");
//       }
//     } catch {
//       // Non-JSON message, ignore
//     }
//   }, [addAssistantMessage, updateCurrentAssistant, playAudioData]);

//   const startCall = useCallback(async () => {
//     try {
//       // Get microphone
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: { sampleRate: 48000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
//       });
//       streamRef.current = stream;

//       // Audio context for resampling
//       const audioCtx = new AudioContext({ sampleRate: 48000 });
//       audioContextRef.current = audioCtx;

//       const source = audioCtx.createMediaStreamSource(stream);
//       sourceRef.current = source;

//       // ScriptProcessor to capture raw PCM
//       const processor = audioCtx.createScriptProcessor(4096, 1, 1);
//       processorRef.current = processor;

//       // Connect WebSocket
//       const ws = new WebSocket(wsUrl);
//       ws.binaryType = "arraybuffer";
//       wsRef.current = ws;

//       ws.onopen = () => {
//         setIsConnected(true);
//         setIsInCall(true);
//         setStatusText("Connected — Listening...");

//         // Send greeting silence
//         // const silence = new ArrayBuffer(SAMPLE_RATE * 2 * 0.2); // 200ms silence
//         // ws.send(silence);
//         // ws.send("EOF");

//         // Start processing audio
//         source.connect(processor);
//         processor.connect(audioCtx.destination);
//       };

//       ws.onmessage = handleWsMessage;

//       ws.onclose = () => {
//         setIsConnected(false);
//         setStatusText("Disconnected");
//       };

//       ws.onerror = () => {
//         setStatusText("Connection error");
//         setIsConnected(false);
//       };

//       // Resample 48kHz -> 16kHz and send
//       const ratio = 48000 / SAMPLE_RATE; // 3
//       let sendBuffer = new Float32Array(0);
//       let hasStartedSending = false;

//       processor.onaudioprocess = (e) => {
//         if (isMutedRef.current) return;

//         const input = e.inputBuffer.getChannelData(0);
        
//         // Simple downsample by picking every nth sample
//         const downsampled = new Float32Array(Math.floor(input.length / ratio));
//         for (let i = 0; i < downsampled.length; i++) {
//           downsampled[i] = input[Math.floor(i * ratio)];
//         }

//         // Accumulate and send in chunks
//         const merged = new Float32Array(sendBuffer.length + downsampled.length);
//         merged.set(sendBuffer);
//         merged.set(downsampled, sendBuffer.length);
//         sendBuffer = merged;

//         while (sendBuffer.length >= CHUNK_SAMPLES) {
//           const chunk = sendBuffer.slice(0, CHUNK_SAMPLES);
//           sendBuffer = sendBuffer.slice(CHUNK_SAMPLES);

//           // Convert to PCM16
//           const pcm16 = new Int16Array(chunk.length);
//           for (let i = 0; i < chunk.length; i++) {
//             const s = Math.max(-1, Math.min(1, chunk[i]));
//             pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
//           }

//           if (ws.readyState === WebSocket.OPEN) {
//             // Track first audio chunk sent to measure TTFT
//             if (!hasStartedSending) {
//               hasStartedSending = true;
//               lastMessageTimeRef.current = Date.now();
//               firstTokenReceivedRef.current = false;
//               addMessage("user", "🎤 Speaking...");
//             }
//             ws.send(pcm16.buffer);
//           }
//         }
//       };

//     } catch (err) {
//       console.error("Failed to start call:", err);
//       setStatusText("Mic access denied");
//     }
//   }, [wsUrl, handleWsMessage]);

//   const endCall = useCallback(() => {
//     // Send EOF + cancel
//     if (wsRef.current?.readyState === WebSocket.OPEN) {
//       wsRef.current.send("EOF");
//       wsRef.current.send("CANCEL");
//       wsRef.current.close();
//     }

//     // Stop audio
//     processorRef.current?.disconnect();
//     sourceRef.current?.disconnect();
//     audioContextRef.current?.close();
//     streamRef.current?.getTracks().forEach(t => t.stop());

//     wsRef.current = null;
//     audioContextRef.current = null;
//     streamRef.current = null;
//     processorRef.current = null;
//     sourceRef.current = null;
//     currentAssistantIndexRef.current = null;

//     setIsInCall(false);
//     setIsConnected(false);
//     setIsStreaming(false);
//     setStatusText("Call ended");
//     // Keep messages for persistent history
//   }, []);

//   const toggleMute = useCallback(() => {
//     setIsMuted(prev => {
//       isMutedRef.current = !prev;
//       return !prev;
//     });
//   }, []);

//   const clearHistory = useCallback(() => {
//     setMessages([]);
//     currentAssistantIndexRef.current = null;
//     localStorage.removeItem(STORAGE_KEY);
//   }, []);

//   return {
//     isConnected,
//     isInCall,
//     isMuted,
//     isStreaming,
//     messages,
//     statusText,
//     startCall,
//     endCall,
//     toggleMute,
//     clearHistory,
//   };
// }

// import { useRef, useState, useCallback, useEffect } from "react";

// const SAMPLE_RATE = 16000;
// const CHUNK_DURATION_MS = 100;
// const CHUNK_SAMPLES = Math.floor((SAMPLE_RATE * CHUNK_DURATION_MS) / 1000);
// const STORAGE_KEY = "voice_chat_history";

// export interface ChatMessage {
//   role: "user" | "assistant";
//   content: string;
//   timestamp: Date;
//   ttft?: number; // Time To First Token in milliseconds
// }

// export function useWebSocketVoice(wsUrl: string) {
//   const [isConnected, setIsConnected] = useState(false);
//   const [isInCall, setIsInCall] = useState(false);
//   const [isMuted, setIsMuted] = useState(false);
//   const [messages, setMessages] = useState<ChatMessage[]>(() => {
//     // Load from localStorage on mount and convert timestamp strings to Date objects
//     try {
//       const saved = localStorage.getItem(STORAGE_KEY);
//       if (saved) {
//         const parsed = JSON.parse(saved);
//         return parsed.map((msg: any) => ({
//           ...msg,
//           timestamp:
//             typeof msg.timestamp === "string"
//               ? new Date(msg.timestamp)
//               : msg.timestamp,
//         }));
//       }
//       return [];
//     } catch {
//       return [];
//     }
//   });
//   const [isStreaming, setIsStreaming] = useState(false);
//   const [statusText, setStatusText] = useState("Idle");

//   const wsRef = useRef<WebSocket | null>(null);
//   const audioContextRef = useRef<AudioContext | null>(null);
//   const streamRef = useRef<MediaStream | null>(null);
//   const processorRef = useRef<ScriptProcessorNode | null>(null);
//   const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
//   const isMutedRef = useRef(false);
//   const currentResponseRef = useRef("");
//   const playbackContextRef = useRef<AudioContext | null>(null);
//   const lastMessageTimeRef = useRef<number>(0); // Track when last segment started (for TTFT)
//   const firstTokenReceivedRef = useRef(false); // Track if we got first token for current segment
//   const currentAssistantIndexRef = useRef<number | null>(null);

//   // NEW: Track audio scheduling time to prevent overlapping playback chunks
//   const nextPlayTimeRef = useRef<number>(0);

//   // Save messages to localStorage whenever they change
//   useEffect(() => {
//     localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
//   }, [messages]);

//   const addMessage = useCallback(
//     (role: "user" | "assistant", content: string, ttft?: number) => {
//       setMessages((prev) => [
//         ...prev,
//         { role, content, timestamp: new Date(), ttft },
//       ]);
//     },
//     [],
//   );

//   const addAssistantMessage = useCallback((content = "") => {
//     setMessages((prev) => {
//       currentAssistantIndexRef.current = prev.length;
//       return [...prev, { role: "assistant", content, timestamp: new Date() }];
//     });
//   }, []);

//   const updateCurrentAssistant = useCallback(
//     (content: string, ttft?: number) => {
//       setMessages((prev) => {
//         const index = currentAssistantIndexRef.current;

//         if (
//           index === null ||
//           !prev[index] ||
//           prev[index].role !== "assistant"
//         ) {
//           currentAssistantIndexRef.current = prev.length;
//           return [
//             ...prev,
//             { role: "assistant", content, timestamp: new Date(), ttft },
//           ];
//         }

//         const copy = [...prev];
//         copy[index] = {
//           ...copy[index],
//           content,
//           ...(ttft !== undefined && { ttft }),
//         };
//         return copy;
//       });
//     },
//     [],
//   );

//   // UPDATED: Properly schedule audio playback to avoid white noise distortion
//   const playAudioData = useCallback((audioBytes: ArrayBuffer) => {
//     try {
//       if (!playbackContextRef.current) {
//         playbackContextRef.current = new AudioContext();
//         // Initialize the play time to the current context time
//         nextPlayTimeRef.current = playbackContextRef.current.currentTime;
//       }
//       const ctx = playbackContextRef.current;

//       // Ensure the byte length is a multiple of 2 (Int16 is 2 bytes)
//       const validByteLength = Math.floor(audioBytes.byteLength / 2) * 2;
//       const cleanBytes = audioBytes.slice(0, validByteLength);

//       // Convert PCM16 to Float32
//       const pcm16 = new Int16Array(cleanBytes);
//       const float32 = new Float32Array(pcm16.length);
//       for (let i = 0; i < pcm16.length; i++) {
//         float32[i] = pcm16[i] / 32768;
//       }

//       const buffer = ctx.createBuffer(1, float32.length, 24000);
//       buffer.getChannelData(0).set(float32);

//       const source = ctx.createBufferSource();
//       source.buffer = buffer;
//       source.connect(ctx.destination);

//       // SCHEDULE PLAYBACK:
//       // Start at current time if we've fallen behind, otherwise append to the end of the scheduled track
//       const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
//       source.start(startTime);

//       // Advance the pointer for the next incoming chunk
//       nextPlayTimeRef.current = startTime + buffer.duration;
//     } catch (e) {
//       console.error("Audio playback error:", e);
//     }
//   }, []);

//   // UPDATED: Reset the audio scheduler on new segment starts
//   const handleWsMessage = useCallback(
//     (event: MessageEvent) => {
//       if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
//         // Binary data = audio response
//         const handleBinary = async (data: Blob | ArrayBuffer) => {
//           const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
//           playAudioData(buffer);
//         };
//         handleBinary(event.data);
//         return;
//       }

//       try {
//         const msg = JSON.parse(event.data);
//         const msgType = msg.type || "";

//         if (msgType === "seg_start") {
//           currentResponseRef.current = "";
//           firstTokenReceivedRef.current = false;
//           lastMessageTimeRef.current = Date.now(); // Record time when new segment starts

//           // Reset audio scheduling for the new response so it plays immediately
//           if (playbackContextRef.current) {
//             nextPlayTimeRef.current = playbackContextRef.current.currentTime;
//           }

//           addAssistantMessage();
//           setIsStreaming(true);
//           setStatusText("AI is responding...");
//         } else if (msgType === "token") {
//           const token = msg.text || "";

//           // Calculate TTFT on first token of this segment
//           if (
//             !firstTokenReceivedRef.current &&
//             lastMessageTimeRef.current > 0
//           ) {
//             firstTokenReceivedRef.current = true;
//             const ttft = Date.now() - lastMessageTimeRef.current;
//             currentResponseRef.current += token;
//             updateCurrentAssistant(currentResponseRef.current, ttft);
//           } else {
//             currentResponseRef.current += token;
//             updateCurrentAssistant(currentResponseRef.current);
//           }
//         } else if (msgType === "seg_end") {
//           const finalText = msg.text || currentResponseRef.current;
//           updateCurrentAssistant(finalText);
//           currentResponseRef.current = "";
//           currentAssistantIndexRef.current = null;
//           setIsStreaming(false);
//           setStatusText("Listening...");
//         } else if (msgType === "error") {
//           currentAssistantIndexRef.current = null;
//           setStatusText(`Error: ${msg.message || "Unknown"}`);
//           setIsStreaming(false);
//         } else if (msgType === "cancelled") {
//           currentAssistantIndexRef.current = null;
//           setIsStreaming(false);
//           setStatusText("Cancelled");
//         } else if (msgType === "done") {
//           currentAssistantIndexRef.current = null;
//           setIsStreaming(false);
//           setStatusText("Done");
//         }
//       } catch {
//         // Non-JSON message, ignore
//       }
//     },
//     [addAssistantMessage, updateCurrentAssistant, playAudioData],
//   );

//   const startCall = useCallback(async () => {
//     try {
//       // Get microphone
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: {
//           sampleRate: 48000,
//           channelCount: 1,
//           echoCancellation: true,
//           noiseSuppression: true,
//         },
//       });
//       streamRef.current = stream;

//       // Audio context for resampling
//       const audioCtx = new AudioContext({ sampleRate: 48000 });
//       audioContextRef.current = audioCtx;

//       const source = audioCtx.createMediaStreamSource(stream);
//       sourceRef.current = source;

//       // ScriptProcessor to capture raw PCM
//       const processor = audioCtx.createScriptProcessor(4096, 1, 1);
//       processorRef.current = processor;

//       // Connect WebSocket
//       const ws = new WebSocket(wsUrl);
//       ws.binaryType = "arraybuffer";
//       wsRef.current = ws;

//       ws.onopen = () => {
//         setIsConnected(true);
//         setIsInCall(true);
//         setStatusText("Connected — Listening...");

//         // Start processing audio
//         source.connect(processor);
//         processor.connect(audioCtx.destination);
//       };

//       ws.onmessage = handleWsMessage;

//       ws.onclose = () => {
//         setIsConnected(false);
//         setStatusText("Disconnected");
//       };

//       ws.onerror = () => {
//         setStatusText("Connection error");
//         setIsConnected(false);
//       };

//       // Resample 48kHz -> 16kHz and send
//       const ratio = 48000 / SAMPLE_RATE; // 3
//       let sendBuffer = new Float32Array(0);
//       let hasStartedSending = false;

//       processor.onaudioprocess = (e) => {
//         if (isMutedRef.current) return;

//         const input = e.inputBuffer.getChannelData(0);

//         // Simple downsample by picking every nth sample
//         const downsampled = new Float32Array(Math.floor(input.length / ratio));
//         for (let i = 0; i < downsampled.length; i++) {
//           downsampled[i] = input[Math.floor(i * ratio)];
//         }

//         // Accumulate and send in chunks
//         const merged = new Float32Array(sendBuffer.length + downsampled.length);
//         merged.set(sendBuffer);
//         merged.set(downsampled, sendBuffer.length);
//         sendBuffer = merged;

//         while (sendBuffer.length >= CHUNK_SAMPLES) {
//           const chunk = sendBuffer.slice(0, CHUNK_SAMPLES);
//           sendBuffer = sendBuffer.slice(CHUNK_SAMPLES);

//           // Convert to PCM16
//           const pcm16 = new Int16Array(chunk.length);
//           for (let i = 0; i < chunk.length; i++) {
//             const s = Math.max(-1, Math.min(1, chunk[i]));
//             pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
//           }

//           if (ws.readyState === WebSocket.OPEN) {
//             // Track first audio chunk sent to measure TTFT
//             if (!hasStartedSending) {
//               hasStartedSending = true;
//               lastMessageTimeRef.current = Date.now();
//               firstTokenReceivedRef.current = false;
//               addMessage("user", "🎤 Speaking...");
//             }
//             ws.send(pcm16.buffer);
//           }
//         }
//       };
//     } catch (err) {
//       console.error("Failed to start call:", err);
//       setStatusText("Mic access denied");
//     }
//   }, [wsUrl, handleWsMessage, addMessage]);

//   const endCall = useCallback(() => {
//     // Send EOF + cancel
//     if (wsRef.current?.readyState === WebSocket.OPEN) {
//       wsRef.current.send("EOF");
//       wsRef.current.send("CANCEL");
//       wsRef.current.close();
//     }

//     // Stop audio
//     processorRef.current?.disconnect();
//     sourceRef.current?.disconnect();
//     audioContextRef.current?.close();
//     streamRef.current?.getTracks().forEach((t) => t.stop());

//     wsRef.current = null;
//     audioContextRef.current = null;
//     streamRef.current = null;
//     processorRef.current = null;
//     sourceRef.current = null;
//     currentAssistantIndexRef.current = null;

//     setIsInCall(false);
//     setIsConnected(false);
//     setIsStreaming(false);
//     setStatusText("Call ended");
//     // Keep messages for persistent history
//   }, []);

//   const toggleMute = useCallback(() => {
//     setIsMuted((prev) => {
//       isMutedRef.current = !prev;
//       return !prev;
//     });
//   }, []);

//   const clearHistory = useCallback(() => {
//     setMessages([]);
//     currentAssistantIndexRef.current = null;
//     localStorage.removeItem(STORAGE_KEY);
//   }, []);

//   return {
//     isConnected,
//     isInCall,
//     isMuted,
//     isStreaming,
//     messages,
//     statusText,
//     startCall,
//     endCall,
//     toggleMute,
//     clearHistory,
//   };
// }


import { useRef, useState, useCallback, useEffect } from "react";

const SAMPLE_RATE = 16000;
const CHUNK_DURATION_MS = 100;
const CHUNK_SAMPLES = Math.floor((SAMPLE_RATE * CHUNK_DURATION_MS) / 1000);
const STORAGE_KEY = "voice_chat_history";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  ttft?: number; // Time To First Token in milliseconds
}

export function useWebSocketVoice(wsUrl: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Load from localStorage on mount and convert timestamp strings to Date objects
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp:
            typeof msg.timestamp === "string"
              ? new Date(msg.timestamp)
              : msg.timestamp,
        }));
      }
      return [];
    } catch {
      return [];
    }
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [statusText, setStatusText] = useState("Idle");

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isMutedRef = useRef(false);
  const currentResponseRef = useRef("");
  const playbackContextRef = useRef<AudioContext | null>(null);
  const lastMessageTimeRef = useRef<number>(0); // Track when last segment started (for TTFT)
  const firstTokenReceivedRef = useRef(false); // Track if we got first token for current segment
  const currentAssistantIndexRef = useRef<number | null>(null);

  // Track audio scheduling time to prevent overlapping playback chunks
  const nextPlayTimeRef = useRef<number>(0);
  // NEW: Track active audio nodes so we can stop them if the AI is interrupted
  const activeAudioNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const autoDisconnectTimeoutRef = useRef<number | null>(null);
  const gracefulEndCallRef = useRef<() => void>(() => {});
  const pendingAutoDisconnectRef = useRef(false);
  const userSpeakingTimeoutRef = useRef<number | null>(null);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string, ttft?: number) => {
      setMessages((prev) => [
        ...prev,
        { role, content, timestamp: new Date(), ttft },
      ]);
    },
    [],
  );

  const addAssistantMessage = useCallback((content = "") => {
    setMessages((prev) => {
      currentAssistantIndexRef.current = prev.length;
      return [...prev, { role: "assistant", content, timestamp: new Date() }];
    });
  }, []);

  const updateCurrentAssistant = useCallback(
    (content: string, ttft?: number) => {
      setMessages((prev) => {
        const index = currentAssistantIndexRef.current;

        if (
          index === null ||
          !prev[index] ||
          prev[index].role !== "assistant"
        ) {
          currentAssistantIndexRef.current = prev.length;
          return [
            ...prev,
            { role: "assistant", content, timestamp: new Date(), ttft },
          ];
        }

        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          content,
          ...(ttft !== undefined && { ttft }),
        };
        return copy;
      });
    },
    [],
  );

  const shouldAutoDisconnect = useCallback((text: string) => {
    return /\bgood\s*bye\b/i.test(text);
  }, []);

  const clearAutoDisconnectTimeout = useCallback(() => {
    if (autoDisconnectTimeoutRef.current !== null) {
      window.clearTimeout(autoDisconnectTimeoutRef.current);
      autoDisconnectTimeoutRef.current = null;
    }
  }, []);

  const markUserSpeaking = useCallback(() => {
    setIsUserSpeaking(true);
    if (userSpeakingTimeoutRef.current !== null) {
      window.clearTimeout(userSpeakingTimeoutRef.current);
    }
    userSpeakingTimeoutRef.current = window.setTimeout(() => {
      setIsUserSpeaking(false);
      userSpeakingTimeoutRef.current = null;
    }, 220);
  }, []);

  const stopCaptureAndSocket = useCallback((sendCancel: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send("EOF");
      if (sendCancel) {
        wsRef.current.send("CANCEL");
      }
      wsRef.current.close();
    }

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (userSpeakingTimeoutRef.current !== null) {
      window.clearTimeout(userSpeakingTimeoutRef.current);
      userSpeakingTimeoutRef.current = null;
    }
    setIsUserSpeaking(false);

    wsRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;
    currentAssistantIndexRef.current = null;
  }, []);

  const finalizeEndedCall = useCallback((stopPlayback: boolean) => {
    if (stopPlayback) {
      activeAudioNodesRef.current.forEach((node) => {
        try {
          node.stop();
        } catch (e) {}
      });
      activeAudioNodesRef.current = [];
    }

    setIsInCall(false);
    setIsConnected(false);
    setIsStreaming(false);
    setStatusText("Call ended");
  }, []);

  // Properly schedule audio playback and track nodes for interruption
  const playAudioData = useCallback((audioBytes: ArrayBuffer) => {
    try {
      if (!playbackContextRef.current) {
        playbackContextRef.current = new AudioContext();
        // Initialize the play time to the current context time
        nextPlayTimeRef.current = playbackContextRef.current.currentTime;
      }
      const ctx = playbackContextRef.current;

      // Ensure the byte length is a multiple of 2 (Int16 is 2 bytes)
      const validByteLength = Math.floor(audioBytes.byteLength / 2) * 2;
      const cleanBytes = audioBytes.slice(0, validByteLength);

      // Convert PCM16 to Float32
      const pcm16 = new Int16Array(cleanBytes);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      // --- NEW TRACKING LOGIC ---
      // Clean up the node from our array when it finishes playing natively
      source.onended = () => {
        activeAudioNodesRef.current = activeAudioNodesRef.current.filter(
          (n) => n !== source,
        );
      };
      // Store the node so we can stop it later if interrupted
      activeAudioNodesRef.current.push(source);
      // --------------------------

      // SCHEDULE PLAYBACK:
      // Start at current time if we've fallen behind, otherwise append to the end of the scheduled track
      const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
      source.start(startTime);

      // Advance the pointer for the next incoming chunk
      nextPlayTimeRef.current = startTime + buffer.duration;
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  }, []);

  // Handle incoming websocket messages and clear audio on interruptions
  const handleWsMessage = useCallback(
    (event: MessageEvent) => {
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
          firstTokenReceivedRef.current = false;
          lastMessageTimeRef.current = Date.now(); // Record time when new segment starts

          // --- NEW STOP LOGIC ---
          // Stop all currently scheduled audio nodes from the previous turn
          activeAudioNodesRef.current.forEach((node) => {
            try {
              node.stop();
            } catch (e) {
              // Ignore errors if the node already finished
            }
          });
          activeAudioNodesRef.current = []; // Clear the array
          // ----------------------

          // Reset audio scheduling for the new response so it plays immediately
          if (playbackContextRef.current) {
            nextPlayTimeRef.current = playbackContextRef.current.currentTime;
          }

          addAssistantMessage();
          setIsStreaming(true);
          setStatusText("AI is responding...");
        } else if (msgType === "token") {
          const token = msg.text || "";
          if (!firstTokenReceivedRef.current && lastMessageTimeRef.current > 0) {
            firstTokenReceivedRef.current = true;
            // 1. TEXT TTFT: Use the exact number the Python backend calculated!
            // (Fallback to frontend math just in case)
            const textTtft = msg.client_ttft_ms || (Date.now() - lastMessageTimeRef.current);
            currentResponseRef.current += token;
            updateCurrentAssistant(currentResponseRef.current, textTtft);
          } else {
            currentResponseRef.current += token;
            updateCurrentAssistant(currentResponseRef.current);
          }
        }
        // 2. AUDIO TTFT: Catch the Azure latency message sent by Python
        // } else if (msgType === "tts_ttft") {
        //    const audioTtft = msg.tts_ttft_ms; 
        //    // Append a little badge to the text so you can see it in the UI!
        //    currentResponseRef.current += ` [🔊 Audio TTFT: ${audioTtft}ms]`;
        //    updateCurrentAssistant(currentResponseRef.current);
        // } 
        else if (msgType === "seg_end") {
          const finalText = msg.text || currentResponseRef.current;
          updateCurrentAssistant(finalText);
          currentResponseRef.current = "";
          currentAssistantIndexRef.current = null;
          setIsStreaming(false);
          if (shouldAutoDisconnect(finalText)) {
            pendingAutoDisconnectRef.current = true;
            setStatusText("Finishing response...");
          } else {
            pendingAutoDisconnectRef.current = false;
            setStatusText("Listening...");
          }
        } else if (msgType === "error") {
          pendingAutoDisconnectRef.current = false;
          currentAssistantIndexRef.current = null;
          setStatusText(`Error: ${msg.message || "Unknown"}`);
          setIsStreaming(false);
        } else if (msgType === "cancelled") {
          pendingAutoDisconnectRef.current = false;
          currentAssistantIndexRef.current = null;
          setIsStreaming(false);
          setStatusText("Cancelled");
        } else if (msgType === "done") {
          currentAssistantIndexRef.current = null;
          setIsStreaming(false);
          if (pendingAutoDisconnectRef.current) {
            pendingAutoDisconnectRef.current = false;
            setStatusText("Ending call...");
            const remainingPlaybackMs = playbackContextRef.current
              ? Math.max(
                  0,
                  (nextPlayTimeRef.current - playbackContextRef.current.currentTime) *
                    1000,
                )
              : 0;

            clearAutoDisconnectTimeout();

            gracefulEndCallRef.current();

            autoDisconnectTimeoutRef.current = window.setTimeout(() => {
              finalizeEndedCall(false);
              clearAutoDisconnectTimeout();
            }, remainingPlaybackMs + 250);
          } else {
            setStatusText("Done");
          }
        }
      } catch {
        // Non-JSON message, ignore
      }
    },
    [
      addAssistantMessage,
      updateCurrentAssistant,
      playAudioData,
      shouldAutoDisconnect,
      clearAutoDisconnectTimeout,
      finalizeEndedCall,
    ],
  );

  const startCall = useCallback(async () => {
    try {
      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
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
      let hasStartedSending = false;

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
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          if (ws.readyState === WebSocket.OPEN) {
            markUserSpeaking();
            // Track first audio chunk sent to measure TTFT
            if (!hasStartedSending) {
              hasStartedSending = true;
              lastMessageTimeRef.current = Date.now();
              firstTokenReceivedRef.current = false;
              addMessage("user", "🎤 Speaking...");
            }
            ws.send(pcm16.buffer);
          }
        }
      };
    } catch (err) {
      console.error("Failed to start call:", err);
      setStatusText("Mic access denied");
    }
  }, [wsUrl, handleWsMessage, addMessage, markUserSpeaking]);

  const endCall = useCallback(() => {
    clearAutoDisconnectTimeout();
    stopCaptureAndSocket(true);
    finalizeEndedCall(true);
    // Keep messages for persistent history
  }, [clearAutoDisconnectTimeout, stopCaptureAndSocket, finalizeEndedCall]);

  const gracefulEndCall = useCallback(() => {
    stopCaptureAndSocket(false);
    setIsInCall(false);
    setIsConnected(false);
    setIsStreaming(false);
  }, [stopCaptureAndSocket]);

  useEffect(() => {
    gracefulEndCallRef.current = gracefulEndCall;
  }, [gracefulEndCall]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      isMutedRef.current = !prev;
      if (!prev && userSpeakingTimeoutRef.current !== null) {
        window.clearTimeout(userSpeakingTimeoutRef.current);
        userSpeakingTimeoutRef.current = null;
        setIsUserSpeaking(false);
      }
      return !prev;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    currentAssistantIndexRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    isConnected,
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
  };
}
