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

  // Regression pin for the "multi-line⏎segunda linha arrived as
  // multi-linesegunda linha" report: embedded newlines must survive AS `\n`
  // (not get collapsed/converted) inside the paste block, one per Shift+Enter
  // in the composer, with a SINGLE trailing `\r` to submit. Verified live
  // against a real node-pty + tmux + `claude` CLI (throwaway session,
  // 2026-09-24): this exact wire format reproduces as two separate lines in
  // the transcript, not one concatenated line — the wire format itself isn't
  // where a newline gets lost, so watch inputTerm/stripReports (server/
  // terminals.ts) first if this regresses.
  it('preserves every embedded newline (multi-line paste), unconverted', () => {
    const sent = buildPastedSend('multi-line\nsegunda linha\nterceira linha');
    expect(sent).toBe('\x1b[200~multi-line\nsegunda linha\nterceira linha\x1b[201~\r');
    const inner = sent.slice('\x1b[200~'.length, sent.length - '\x1b[201~\r'.length);
    expect(inner.split('\n')).toEqual(['multi-line', 'segunda linha', 'terceira linha']);
    expect(sent.match(/\r/g)).toHaveLength(1); // exactly one Enter, at the end
  });
});
