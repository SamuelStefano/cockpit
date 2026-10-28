import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export const TTS_MAX_CHARS = 600;
const DEFAULT_VOICE = 'pt-BR-AntonioNeural';
const ELEVENLABS_MODEL = 'eleven_flash_v2_5';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';
const UPSTREAM_TIMEOUT_MS = 20000;

export class TtsError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function parseTtsText(text: unknown): string {
  if (typeof text !== 'string' || !text.trim()) throw new TtsError(400, 'text required');
  const trimmed = text.trim();
  if (trimmed.length > TTS_MAX_CHARS) throw new TtsError(400, `text too long (max ${TTS_MAX_CHARS})`);
  return trimmed;
}

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

export interface TtsEnv { COCKPIT_TTS_VOICE?: string; COCKPIT_ELEVENLABS_API_KEY?: string; COCKPIT_ELEVENLABS_VOICE_ID?: string }

// Literal process.env reads: env-example.test.ts scans for them.
function readTtsEnv(): TtsEnv {
  return {
    COCKPIT_TTS_VOICE: process.env.COCKPIT_TTS_VOICE,
    COCKPIT_ELEVENLABS_API_KEY: process.env.COCKPIT_ELEVENLABS_API_KEY,
    COCKPIT_ELEVENLABS_VOICE_ID: process.env.COCKPIT_ELEVENLABS_VOICE_ID,
  };
}

export function edgeVoice(env: TtsEnv): string {
  return env.COCKPIT_TTS_VOICE?.trim() || DEFAULT_VOICE;
}

export async function synthesizeEdge(text: string, voice: string): Promise<Buffer> {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: UPSTREAM_TIMEOUT_MS, synthesisTimeoutMs: UPSTREAM_TIMEOUT_MS });
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(text));
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (d: Buffer) => chunks.push(d));
      audioStream.on('end', () => resolve());
      audioStream.on('error', reject);
    });
    const out = Buffer.concat(chunks);
    if (out.length === 0) throw new TtsError(502, 'empty audio');
    return out;
  } finally {
    tts.close();
  }
}

export async function synthesizeElevenLabs(
  text: string, apiKey: string, voiceId: string, fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  const res = await fetchImpl(`${ELEVENLABS_BASE}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) throw new TtsError(502, `elevenlabs ${res.status}`);
  const out = Buffer.from(await res.arrayBuffer());
  if (out.length === 0) throw new TtsError(502, 'empty audio');
  return out;
}

export function synthesize(text: string, env: TtsEnv = readTtsEnv()): Promise<Buffer> {
  const key = env.COCKPIT_ELEVENLABS_API_KEY?.trim();
  const voiceId = env.COCKPIT_ELEVENLABS_VOICE_ID?.trim();
  if (key && voiceId) return synthesizeElevenLabs(text, key, voiceId);
  return synthesizeEdge(text, edgeVoice(env));
}
