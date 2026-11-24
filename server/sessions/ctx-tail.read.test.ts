import { describe, it, expect, vi, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'deck-ctx-tail-'));
vi.mock('../config', () => ({ CONFIG: { projectsDir: dir } }));
vi.mock('../db', () => ({ lastUsageOf: () => null }));

// Count file handles open at the same time.
const fsState = vi.hoisted(() => ({ open: 0, max: 0 }));
vi.mock('node:fs/promises', async (orig) => {
  const real = await orig<typeof import('node:fs/promises')>();
  return {
    ...real,
    open: async (...args: Parameters<typeof real.open>) => {
      const fh = await real.open(...args);
      fsState.open++; fsState.max = Math.max(fsState.max, fsState.open);
      await new Promise((r) => setTimeout(r, 5));
      const close = fh.close.bind(fh);
      fh.close = async () => { fsState.open--; return close(); };
      return fh;
    },
  };
});

const { sessionUsage } = await import('./ctx-tail');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const usageLine = (n: number) => JSON.stringify({ type: 'assistant', message: { model: 'm', usage: { input_tokens: n } } });

describe('sessionUsage from the transcript tail', () => {
  it('finds usage near the end with the small read, and further back with the big one', async () => {
    writeFileSync(join(dir, 'near.jsonl'), `${usageLine(7)}\n`);
    const filler = JSON.stringify({ type: 'user', message: { content: 'x'.repeat(200 * 1024) } });
    writeFileSync(join(dir, 'far.jsonl'), `${usageLine(9)}\n${filler}\n`);
    expect((await sessionUsage('near'))?.ctxTokens).toBe(7);
    expect((await sessionUsage('far'))?.ctxTokens).toBe(9);
  });

  it('never holds more than 8 transcripts open at once', async () => {
    for (let i = 0; i < 30; i++) writeFileSync(join(dir, `s${i}.jsonl`), `${usageLine(i + 1)}\n`);
    fsState.max = 0;
    const out = await Promise.all(Array.from({ length: 30 }, (_, i) => sessionUsage(`s${i}`)));
    expect(out.every((u) => u && u.ctxTokens > 0)).toBe(true);
    expect(fsState.max).toBeLessThanOrEqual(8);
  });
});
