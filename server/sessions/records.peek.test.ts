import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRecords, readPeekRecords } from './records';
import { peekFromRecords } from './peek';

const dir = mkdtempSync(join(tmpdir(), 'deck-peek-lean-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const line = (o: unknown) => JSON.stringify(o);

describe('readPeekRecords', () => {
  it('gives the drawer exactly what the full scan gave it', async () => {
    const f = join(dir, 's.jsonl');
    writeFileSync(f, [
      line({ type: 'user', uuid: 'u1', timestamp: '2026-09-24T10:00:00Z', message: { role: 'user', content: 'faz o deploy' } }),
      line({ type: 'assistant', uuid: 'a1', timestamp: '2026-09-24T10:01:00Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }] } }),
      line({ type: 'user', uuid: 'u2', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'https://tool.output/ignored ' + 'x'.repeat(5000) }] } }),
      line({ type: 'pr-link', prUrl: 'https://github.com/o/r/pull/7', prNumber: 7, prRepository: 'o/r', timestamp: '2026-09-24T10:02:00Z' }),
      line({ type: 'assistant', uuid: 'a2', timestamp: '2026-09-24T10:03:00Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Pronto: https://deck.example/x e https://github.com/o/r/pull/8.' }] } }),
      'not json',
      '',
    ].join('\n'));
    const full = await readRecords(f);
    const lean = await readPeekRecords(f);
    expect(peekFromRecords(lean.msgs, lean.markers)).toEqual(peekFromRecords(full.msgs, full.markers));
    expect(lean.msgs).toHaveLength(1); // only the assistant record that has text
  });
});
