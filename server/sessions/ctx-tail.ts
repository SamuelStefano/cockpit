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

// usage_sample is only written by relay-spawned runs, so a session running in a
// tmux pane has no sample: fall back to the transcript itself.
export async function sessionUsage(sessionId: string): Promise<Usage | null> {
  const sample = lastUsageOf(sessionId);
  if (sample && sample.ctxTokens > 0) return sample;
  try {
    const fh = await open(join(CONFIG.projectsDir, `${sessionId}.jsonl`), 'r');
    try {
      const { size } = await fh.stat();
      const start = Math.max(0, size - TAIL_BYTES);
      const buf = Buffer.alloc(size - start);
      await fh.read(buf, 0, buf.length, start);
      return ctxFromJsonlTail(buf.toString('utf8'));
    } finally { await fh.close(); }
  } catch { return null; }
}
