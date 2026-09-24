import { describe, it, expect } from 'vitest';
import { shownMessages } from './useShownMessages';
import type { Message, CompactMessage } from '../../data/types';

const pr = (n: number): CompactMessage => ({ id: `pr${n}`, role: 'compact', kind: 'pr', label: `PR#${n}`, url: `https://github.com/o/r/pull/${n}` });
const toolOnly = (id: string): Message => ({
  id, role: 'assistant',
  blocks: [{ type: 'tool', tool: { id: `${id}-t`, name: 'Bash', status: 'done', command: 'gh pr create' } as never }],
});

describe('shownMessages', () => {
  it('joins PR dividers that only had tool calls between them (tools visible)', () => {
    const messages: Message[] = [
      { id: 'u', role: 'user', text: 'abre as PRs' },
      toolOnly('a1'), pr(1), toolOnly('a2'), pr(2), toolOnly('a3'), pr(3),
      { id: 'end', role: 'assistant', blocks: [{ type: 'text', text: 'pronto' }] },
    ];
    const out = shownMessages(messages, true, false);
    const dividers = out.filter((m) => m.role === 'compact') as CompactMessage[];
    expect(dividers).toHaveLength(1);
    expect(dividers[0].prs?.map((p) => p.label)).toEqual(['PR#1', 'PR#2', 'PR#3']);
  });
});
