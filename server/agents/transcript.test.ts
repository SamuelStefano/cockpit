import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { priorConversation } from './transcript';

const file = (lines: unknown[]) => {
  const p = join(mkdtempSync(join(tmpdir(), 'prior-')), 's.jsonl');
  writeFileSync(p, lines.map((l) => JSON.stringify(l)).join('\n') + '\n{torn');
  return p;
};

describe('priorConversation', () => {
  it('keeps only the text the person and the model said', () => {
    const p = file([
      { type: 'user', message: { content: 'fix the bug' } },
      { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'found it' }, { type: 'tool_use', name: 'Bash' }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', content: 'SECRET-OUTPUT' }] } },
      { type: 'user', isSidechain: true, message: { content: 'subagent brief' } },
      { type: 'summary', summary: 's' },
    ]);
    expect(priorConversation(p)).toBe('Person: fix the bug\n\nAssistant: found it');
  });

  it('keeps the newest part of a long chat and tolerates a missing file', () => {
    const p = file([{ type: 'user', message: { content: 'old' } }, { type: 'assistant', message: { content: 'newest' } }]);
    expect(priorConversation(p, 6)).toBe('newest');
    expect(priorConversation('/nope/x.jsonl')).toBe('');
  });
});
