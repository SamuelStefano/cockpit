import { describe, it, expect } from 'vitest';
import { countPrs, prCountLabel } from './pr-count';
import type { Message } from '../../data/types';

const pr = (id: string, url?: string, prs?: { label: string; url: string }[]) => ({ id, role: 'compact', kind: 'pr', url, label: 'PR #1', prs }) as unknown as Message;

describe('countPrs', () => {
  it('counts unique urls, including grouped markers', () => {
    const msgs = [pr('1', 'https://x/pull/1'), pr('2', 'https://x/pull/1'), pr('3', undefined, [{ label: '#2', url: 'https://x/pull/2' }, { label: '#3', url: 'https://x/pull/3' }])];
    expect(countPrs(msgs)).toBe(3);
  });

  it('ignores other messages and markers without a url', () => {
    expect(countPrs([{ id: 'a', role: 'user', text: 'oi' } as unknown as Message, pr('1')])).toBe(0);
  });

  it('pluralises the label', () => {
    expect(prCountLabel(1)).toBe('1 PR nesta conversa');
    expect(prCountLabel(3)).toBe('3 PRs nesta conversa');
  });
});
