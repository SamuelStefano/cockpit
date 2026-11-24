import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = vi.hoisted(() => `${process.env.TMPDIR ?? '/tmp'}/deck-handoff-${process.pid}`);
vi.mock('./config', async (orig) => {
  const mod = await orig<typeof import('./config')>();
  return { ...mod, CONFIG: { ...mod.CONFIG, memoryDir: dir } };
});
vi.mock('./sessions/parse', () => ({
  parseSession: vi.fn(async () => ({ messages: [{ id: 'u1', role: 'user', text: 'ship the relay fix', ts: 1 }] })),
}));
vi.mock('./sessions/index', () => ({ metaForId: vi.fn(async () => ({ title: 'relay' })) }));
vi.mock('./store', () => ({ hideSession: vi.fn(async () => {}) }));
vi.mock('./harness/plan-run', () => ({ runOnPlan: vi.fn() }));
vi.mock('./summary', async (orig) => ({ ...(await orig<typeof import('./summary')>()), apiKey: vi.fn(() => null) }));

import { handoffSession } from './handoff';
import { runOnPlan } from './harness/plan-run';

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('handoffSession twice on the same day', () => {
  beforeEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('keeps the first briefing and writes the second under a new name', async () => {
    vi.mocked(runOnPlan).mockResolvedValueOnce({ status: 'done', resultText: '## Contexto\nfirst', inputTokens: 1, outputTokens: 1 });
    const a = await handoffSession('abcdef12-0000-4000-8000-000000000000');
    vi.mocked(runOnPlan).mockResolvedValueOnce({ status: 'done', resultText: '## Contexto\nsecond', inputTokens: 1, outputTokens: 1 });
    const b = await handoffSession('abcdef12-0000-4000-8000-000000000000');
    if ('error' in a || 'error' in b) throw new Error('handoff failed');
    expect(b.contextId).toBe(`${a.contextId}-2`);
    expect(readFileSync(join(dir, `${a.contextId}.md`), 'utf8')).toContain('first');
    expect(readFileSync(join(dir, `${b.contextId}.md`), 'utf8')).toContain('second');
  });
});
