import { describe, expect, it } from 'vitest';
import { buildPastedSend, MAX_CHAT_HISTORY, pushChatHistory, stepChatHistory } from './orchestrator-chat-history';

describe('pushChatHistory', () => {
  it('appends trimmed text', () => {
    expect(pushChatHistory([], '  hi  ')).toEqual(['hi']);
  });

  it('ignores empty/whitespace-only text', () => {
    expect(pushChatHistory(['a'], '   ')).toEqual(['a']);
  });

  it('caps at MAX_CHAT_HISTORY, dropping the oldest', () => {
    const full = Array.from({ length: MAX_CHAT_HISTORY }, (_, i) => `m${i}`);
    const next = pushChatHistory(full, 'new');
    expect(next.length).toBe(MAX_CHAT_HISTORY);
    expect(next[0]).toBe('m1');
    expect(next[next.length - 1]).toBe('new');
  });

  it('collapses an immediate repeat instead of duplicating', () => {
    expect(pushChatHistory(['a', 'b'], 'b')).toEqual(['a', 'b']);
  });
});

describe('stepChatHistory', () => {
  it('stays at len (live draft) when history is empty', () => {
    expect(stepChatHistory(0, 0, -1)).toBe(0);
  });

  it('arrow-up from the live draft goes to the newest entry', () => {
    expect(stepChatHistory(3, 3, -1)).toBe(2);
  });

  it('arrow-up walks toward the oldest and clamps at 0', () => {
    expect(stepChatHistory(3, 0, -1)).toBe(0);
  });

  it('arrow-down walks back to the live draft and clamps there', () => {
    expect(stepChatHistory(3, 2, 1)).toBe(3);
    expect(stepChatHistory(3, 3, 1)).toBe(3);
  });
});

describe('buildPastedSend', () => {
  it('wraps text in bracketed paste and submits with a carriage return', () => {
    expect(buildPastedSend('line1\nline2')).toBe('\x1b[200~line1\nline2\x1b[201~\r');
  });
});
