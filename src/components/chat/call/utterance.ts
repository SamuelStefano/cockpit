import type { Block } from '../../../data/types';

const MIN_UTTERANCE_CHARS = 3;
const MIN_BARGE_IN_WORDS = 2;
const SENTENCE_END = /[.!?…]["')\]]*$/;

export const SILENCE_AFTER_SENTENCE_MS = 900;
export const SILENCE_MID_SENTENCE_MS = 1500;
export const SPOKEN_MAX_CHARS = 420;
export const SPEECH_CHUNK_CHARS = 180;

export function endOfUtteranceDelay(text: string): number {
  return SENTENCE_END.test(text.trim()) ? SILENCE_AFTER_SENTENCE_MS : SILENCE_MID_SENTENCE_MS;
}

export function isSendable(text: string): boolean {
  return text.trim().length >= MIN_UTTERANCE_CHARS;
}

function words(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isEcho(heard: string, spoken: string): boolean {
  const h = words(heard);
  if (h.length === 0) return true;
  const s = ` ${normalize(spoken)} `;
  return s.includes(` ${h.join(' ')} `);
}

export function isBargeIn(heard: string, spoken: string): boolean {
  return words(heard).length >= MIN_BARGE_IN_WORDS && !isEcho(heard, spoken);
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentences(text: string): string[] {
  return text.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

export function finalTextBlocks(blocks: Block[]): string[] {
  const lastTool = blocks.findLastIndex((b) => b.type === 'tool');
  return blocks.slice(lastTool + 1).flatMap((b) => (b.type === 'text' ? [b.md] : []));
}

export function toSpokenSummary(blocks: Block[], maxChars = SPOKEN_MAX_CHARS): string {
  const text = stripMarkdown(finalTextBlocks(blocks).join('\n\n'));
  if (!text) return '';
  let out = '';
  for (const s of sentences(text)) {
    if (out && out.length + s.length + 1 > maxChars) break;
    out = out ? `${out} ${s}` : s;
  }
  return out.length > maxChars ? `${out.slice(0, maxChars - 1).trimEnd()}…` : out;
}

export function splitForSpeech(text: string, maxChars = SPEECH_CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences(text)) {
    if (cur && cur.length + s.length + 1 > maxChars) { chunks.push(cur); cur = ''; }
    cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) chunks.push(cur);
  return chunks;
}
