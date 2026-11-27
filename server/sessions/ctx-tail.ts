import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG } from '../config';
import { lastUsageOf } from '../db';
import { ctxTokens } from './records';

const TAIL_BYTES = 512 * 1024;

type Usage = { ctxTokens: number; model: string | null; requestedModel: string | null };

// Last assistant usage found in a JSONL tail. Pure so it is testable without disk.
export function ctxFromJsonlTail(text: string): Usage | null {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.includes('"usage"')) continue;
    try {
      const rec = JSON.parse(line);
      const m = rec?.message;
      if (rec?.type !== 'assistant' || !m?.usage) continue;
      const tokens = ctxTokens(m.usage);
      if (tokens > 0) return { ctxTokens: tokens, model: typeof m.model === 'string' ? m.model : null, requestedModel: null };
    } catch { /* partial first line of the tail */ }
  }
  return null;
}

// deckctl ctx/status call this for every session at once (Promise.all over ~400
// transcripts): unbounded, that was ~400 open files and up to ~200 MB of tail
// buffers in one run on a 3.7 GB box. Reads queue behind a small limit, and the
// last usage line is almost always in the first 64 KB of tail.
const MAX_CONCURRENT_READS = 8;
const FIRST_TAIL_BYTES = 64 * 1024;
let reading = 0;
const waiting: (() => void)[] = [];

async function withReadSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (reading >= MAX_CONCURRENT_READS) await new Promise<void>((r) => waiting.push(r));
  reading++;
  try { return await fn(); } finally {
    reading--;
    waiting.shift()?.();
  }
}

async function readTail(path: string, bytes: number): Promise<{ text: string; whole: boolean }> {
  const fh = await open(path, 'r');
  try {
    const { size } = await fh.stat();
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    await fh.read(buf, 0, buf.length, start);
    return { text: buf.toString('utf8'), whole: start === 0 };
  } finally { await fh.close(); }
}

// usage_sample is only written by relay-spawned runs, so a session running in a
// tmux pane has no sample: fall back to the transcript itself.
export async function sessionUsage(sessionId: string): Promise<Usage | null> {
  const sample = lastUsageOf(sessionId);
  if (sample && sample.ctxTokens > 0) return sample;
  const path = join(CONFIG.projectsDir, `${sessionId}.jsonl`);
  try {
    return await withReadSlot(async () => {
      const first = await readTail(path, FIRST_TAIL_BYTES);
      const hit = ctxFromJsonlTail(first.text);
      if (hit || first.whole) return hit;
      return ctxFromJsonlTail((await readTail(path, TAIL_BYTES)).text);
    });
  } catch { return null; }
}
