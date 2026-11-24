export interface ProbeModel {
  id: string;
  usable: boolean;
  reason?: string;
  vision: boolean;
  tools: boolean;
  longContext: boolean;
}

export type ProbeResult =
  | { ok: true; models: ProbeModel[] }
  | { ok: false; error: string };

export const PROBE_ENDPOINT_MAX = 512;
export const PROBE_KEY_MAX = 512;

const NOT_CHAT = /(whisper|embed|embedding|rerank|tts|text-to-speech|speech|transcri|moderation|dall-?e|stable-diffusion|sdxl|flux|imagen)/i;
const AUDIO_ONLY = /(whisper|tts|text-to-speech|speech|transcri)/i;
const VISION = /(vision|-vl\b|-vl-|\bvl\b|llava|pixtral|gpt-4o|gpt-4\.1|gpt-5|gemini|claude|grok|qwen3\.5|qwen3-vl|maverick|scout|multimodal)/i;
const LONG = /(128k|200k|256k|1m\b|long|maverick|scout|gemini|claude|gpt-4\.1|gpt-5|qwen3|deepseek-v[34])/i;

export function classifyProbeModel(id: string): ProbeModel {
  if (NOT_CHAT.test(id)) {
    return { id, usable: false, reason: AUDIO_ONLY.test(id) ? 'só áudio, não serve pra conversa' : 'não serve pra conversa', vision: false, tools: false, longContext: false };
  }
  return { id, usable: true, vision: VISION.test(id), tools: true, longContext: LONG.test(id) };
}

export function probeCapsLabel(m: ProbeModel): string {
  if (!m.usable) return m.reason ?? 'não serve pra conversa';
  const parts: string[] = [];
  if (m.vision) parts.push('vê imagens');
  if (m.tools) parts.push('usa ferramentas');
  if (m.longContext) parts.push('contexto longo');
  return parts.join(' · ');
}
