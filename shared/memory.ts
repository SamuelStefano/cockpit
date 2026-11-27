import type { Memory } from './protocol';

export const MAX_PROMPT_MEMORY_BYTES = 8 * 1024;
export const MAX_MEMORY_BODY_BYTES = 200 * 1024;
export const MEMORY_CUT_NOTICE = '[memória cortada: limite de 8 KB]';

const enc = new TextEncoder();
const dec = new TextDecoder();
const byteLen = (s: string) => enc.encode(s).length;

export function readersOf(memories: Memory[], botId: string): Memory[] {
  return memories.filter((m) => m.agents.includes(botId)).sort((a, b) => b.updatedAt - a.updatedAt);
}

function section(m: Memory): string {
  return `## ${m.title}\n${m.body.trim()}`;
}

export function memoryBytesFor(memories: Memory[], botId: string): number {
  return readersOf(memories, botId).reduce((n, m) => n + byteLen(section(m)) + 2, 0);
}

export function buildMemoryBlock(memories: Memory[] | undefined, botId: string): string {
  if (!memories?.length) return '';
  const mine = readersOf(memories, botId);
  if (!mine.length) return '';
  const head = 'Memória da equipe (o que você já sabe antes de a conversa começar):';
  let out = head;
  let used = byteLen(head);
  let cut = false;
  for (const m of mine) {
    const piece = `\n\n${section(m)}`;
    const size = byteLen(piece);
    if (used + size <= MAX_PROMPT_MEMORY_BYTES) { out += piece; used += size; continue; }
    const room = MAX_PROMPT_MEMORY_BYTES - used - byteLen(MEMORY_CUT_NOTICE) - 2;
    if (room > 200) out += dec.decode(enc.encode(piece).slice(0, room)).replace(/�+$/, '');
    cut = true;
    break;
  }
  if (!cut) return out;
  const budget = MAX_PROMPT_MEMORY_BYTES - byteLen(MEMORY_CUT_NOTICE) - 1;
  const bytes = enc.encode(out);
  const kept = bytes.length > budget ? dec.decode(bytes.slice(0, budget)).replace(/\uFFFD+$/, '') : out;
  return `${kept}\n${MEMORY_CUT_NOTICE}`;
}
