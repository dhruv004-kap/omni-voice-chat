
## Voice Bot Demo UI

### Overview
A dark-themed, demo-ready voice bot interface inspired by the reference image. Connects to the Qwen3 Omni model via WebSocket, sends microphone audio, and displays text responses while playing back any audio the server returns.

### Pages & Components

**Main Page (Index)**
- Full-screen dark UI with centered call interface
- Top section: App title/branding area with subtle glow effect (like the reference)
- Description text: "Have a conversation with our AI voice agent powered by Qwen3 Omni"
- Three circular action buttons in a row:
  - **Transcript** — toggles a slide-up transcript panel showing the conversation history
  - **Start/End Call** — large green call button (toggles to red when active), starts/stops the WebSocket session and microphone
  - **Mute** — toggles microphone mute
- Connection status indicator (dot + text)
- Configurable WS URL via a small settings icon/gear that reveals an input field

**Transcript Panel**
- Slides up from bottom when toggled
- Shows conversation messages (user audio indicators + assistant text responses)
- Auto-scrolls to latest message
- Streaming text tokens appear in real-time

### WebSocket Integration
- Captures microphone audio using Web Audio API (MediaRecorder or ScriptProcessorNode)
- Resamples to 16kHz mono PCM16 before sending
- Sends audio in chunks, then sends `EOF` control message
- Receives JSON messages: `seg_start`, `token` (streaming text), `seg_end`, `error`
- If server sends audio data, plays it back via AudioContext
- Supports `CANCEL` control message

### Visual Design
- Dark background (#0a0a0a / near-black)
- Teal/green accent for the call button (matching reference)
- Subtle animated glow/pulse when call is active
- Clean, minimal typography
- Responsive layout
