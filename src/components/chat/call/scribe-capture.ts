import { requestSttToken } from '../../../cockpit/tts-bus';
import { ScribeTranscript, toPcm16 } from './scribe-transcript';
import { normalizeDictation } from '../speech-normalize';
import type { Heard } from './useCallRecognizer';

const SCRIBE_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
const SAMPLE_RATE = 16000;
const FRAME_SIZE = 4096;
const MAX_RECONNECTS = 3;

export interface ScribeSession { stop(): void; reset(): void }

interface Handlers {
  onHeard: (heard: Heard) => void;
  onFatal: (message: string) => void;
  onUnavailable: () => void;
}

type AudioCtor = typeof AudioContext;
let sharedContext: AudioContext | null = null;

function audioCtor(): AudioCtor | undefined {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
}

export function scribeSupported(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!audioCtor() && typeof WebSocket !== 'undefined';
}

// iOS only starts an AudioContext from a user gesture; the mic opens after an async
// token fetch, so this has to run inside the "Ligar" tap.
export function primeScribeAudio() {
  if (!scribeSupported()) return;
  const Ctor = audioCtor()!;
  sharedContext ??= new Ctor();
  void sharedContext.resume().catch(() => {});
}

function base64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function scribeUrl(token: string): string {
  const q = new URLSearchParams({
    model_id: 'scribe_v2_realtime', token, audio_format: 'pcm_16000', language_code: 'por', commit_strategy: 'vad',
  });
  return `${SCRIBE_URL}?${q}`;
}

export function startScribe({ onHeard, onFatal, onUnavailable }: Handlers): ScribeSession {
  const transcript = new ScribeTranscript();
  let alive = true;
  let ws: WebSocket | null = null;
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let reconnects = 0;

  const report = (text: string, isFinal: boolean) => {
    const clean = normalizeDictation(text);
    if (clean) onHeard({ text: clean, isFinal, confidence: 0 });
  };

  const connect = async () => {
    const token = await requestSttToken();
    if (!alive) return;
    if (!token) { if (reconnects === 0) { release(); onUnavailable(); } else fail(); return; }
    const sock = new WebSocket(scribeUrl(token));
    ws = sock;
    sock.onmessage = (e) => {
      const msg = JSON.parse(String(e.data)) as { message_type?: string; text?: string };
      if (msg.message_type === 'session_started') reconnects = 0;
      else if (msg.message_type === 'partial_transcript') report(transcript.onPartial(msg.text ?? ''), false);
      else if (msg.message_type === 'committed_transcript') report(transcript.onCommit(msg.text ?? ''), true);
    };
    sock.onclose = () => {
      if (!alive || ws !== sock) return;
      ws = null;
      if (++reconnects > MAX_RECONNECTS) { fail(); return; }
      void connect();
    };
  };

  const fail = () => {
    release();
    onFatal('A conexão de voz caiu. Ligue de novo.');
  };

  const release = () => {
    alive = false;
    if (processor) processor.onaudioprocess = null;
    processor?.disconnect();
    source?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    const sock = ws;
    ws = null;
    if (sock) { sock.onclose = null; sock.onmessage = null; try { sock.close(); } catch { /* already closed */ } }
  };

  const open = async () => {
    primeScribeAudio();
    const ctx = sharedContext!;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      if (alive) { release(); onFatal('Sem acesso ao microfone. Libere a permissão e ligue de novo.'); }
      return;
    }
    if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
    // iOS can suspend the context while the permission prompt is up.
    void ctx.resume().catch(() => {});
    await connect();
    if (!alive) return;
    source = ctx.createMediaStreamSource(stream);
    processor = ctx.createScriptProcessor(FRAME_SIZE, 1, 1);
    processor.onaudioprocess = (e) => {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: base64(toPcm16(e.inputBuffer.getChannelData(0), ctx.sampleRate, SAMPLE_RATE)),
        commit: false,
        sample_rate: SAMPLE_RATE,
      }));
    };
    source.connect(processor);
    // Some engines only fire onaudioprocess when the node reaches the destination; its output stays silent.
    processor.connect(ctx.destination);
  };

  void open();
  return { stop: release, reset: () => transcript.reset() };
}
