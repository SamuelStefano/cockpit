import { describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import type { AddressInfo } from 'node:net';
import {
  parseFlags, flagStr, flagNum, fmtBrt, shortId, oneLine, matchByPrefix, newCardIdLocal, findCard,
  scoreSession, isNeverPurgeSession, newTranscriptScan, feedTranscriptLine, type TriageInput, Client,
} from './deckctl.mts';
import type { CanvasCard } from '../shared/canvas';
import type { ServerMsg } from '../shared/protocol';

describe('parseFlags', () => {
  it('splits positional args from --flags', () => {
    const { positional, flags } = parseFlags(['sessions', '--all', '--limit', '5']);
    expect(positional).toEqual(['sessions']);
    expect(flags).toEqual({ all: true, limit: '5' });
  });

  it('treats a flag followed by another flag as a boolean', () => {
    const { flags } = parseFlags(['--json', '--all']);
    expect(flags).toEqual({ json: true, all: true });
  });

  it('treats a trailing flag with no value as boolean', () => {
    const { flags } = parseFlags(['--json']);
    expect(flags).toEqual({ json: true });
  });

  it('keeps quoted text with spaces as one positional', () => {
    const { positional } = parseFlags(['send', 'abcd1234', 'reply with OK']);
    expect(positional).toEqual(['send', 'abcd1234', 'reply with OK']);
  });
});

describe('flagStr / flagNum', () => {
  it('reads a string flag', () => {
    expect(flagStr({ model: 'haiku' }, 'model')).toBe('haiku');
  });

  it('returns undefined for a boolean flag', () => {
    expect(flagStr({ all: true }, 'all')).toBeUndefined();
  });

  it('parses a numeric flag', () => {
    expect(flagNum({ limit: '5' }, 'limit')).toBe(5);
  });

  it('returns undefined for a non-numeric value', () => {
    expect(flagNum({ limit: 'abc' }, 'limit')).toBeUndefined();
  });

  it('returns undefined when the flag is absent', () => {
    expect(flagNum({}, 'limit')).toBeUndefined();
  });
});

describe('fmtBrt', () => {
  it('renders a fixed instant in America/Sao_Paulo time', () => {
    // 2026-09-23T23:19:00Z = 20:19 in BRT (UTC-3).
    const ms = Date.UTC(2026, 8, 23, 23, 19, 0);
    expect(fmtBrt(ms)).toBe('23/09, 20:19 BRT');
  });
});

describe('shortId', () => {
  it('truncates a uuid to 8 chars', () => {
    expect(shortId('faf5b231-c2d7-419b-9765-3f277670564e')).toBe('faf5b231');
  });

  it('leaves a short id untouched', () => {
    expect(shortId('abc')).toBe('abc');
  });
});

describe('oneLine', () => {
  it('collapses newlines and whitespace runs', () => {
    expect(oneLine('a\n\nb   c\t d')).toBe('a b c d');
  });

  it('caps length and adds an ellipsis', () => {
    const s = 'x'.repeat(100);
    const out = oneLine(s, 10);
    expect(out).toBe('xxxxxxxxx…');
    expect(out.length).toBe(10);
  });

  it('leaves short text untouched', () => {
    expect(oneLine('hello', 70)).toBe('hello');
  });
});

describe('matchByPrefix', () => {
  const ids = ['faf5b231-aaaa', 'faf5b231-bbbb', '6f9ed1d0-cccc'];

  it('resolves an unambiguous prefix', () => {
    expect(matchByPrefix(ids, '6f9ed1d0')).toEqual({ kind: 'ok', id: '6f9ed1d0-cccc' });
  });

  it('prefers an exact match over a prefix collision', () => {
    expect(matchByPrefix(ids, 'faf5b231-aaaa')).toEqual({ kind: 'ok', id: 'faf5b231-aaaa' });
  });

  it('flags an ambiguous prefix with all matches', () => {
    expect(matchByPrefix(ids, 'faf5b231')).toEqual({ kind: 'ambiguous', matches: ['faf5b231-aaaa', 'faf5b231-bbbb'] });
  });

  it('reports none when nothing matches', () => {
    expect(matchByPrefix(ids, 'zzzz')).toEqual({ kind: 'none' });
  });
});

describe('newCardIdLocal', () => {
  it('produces an id matching CARD_ID_RE shape (lowercase, digits, hyphens)', () => {
    const id = newCardIdLocal('Fix the Canvas Kanban!');
    expect(id).toMatch(/^[a-z0-9-]{4,40}$/);
    expect(id).toContain('fix-the-canvas-kanban');
  });

  it('falls back to a plain random id for an all-punctuation title', () => {
    const id = newCardIdLocal('!!!');
    expect(id).toMatch(/^[a-z0-9-]{4,40}$/);
  });
});

// server/ws/serve-connection.ts sends the 'busy' bootstrap frame SYNCHRONOUSLY
// in the server's 'connection' handler — before this Client's caller has any
// chance to register a matching waitFor(). Reproduced deterministically here
// (not by racing real timing, which would be flaky): a message is allowed to
// fully arrive with ZERO handlers registered, THEN waitFor is called for that
// same predicate — only the history buffer (scripts/deckctl.mts) can satisfy
// it at that point.
describe('Client — waitFor sees a frame that already arrived', () => {
  const isBusy = (m: ServerMsg): m is Extract<ServerMsg, { t: 'busy' }> => m.t === 'busy';

  it('resolves from history instead of timing out', async () => {
    const wss = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) => wss.once('listening', resolve));
    const { port } = wss.address() as AddressInfo;
    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ t: 'busy', keys: ['s1'], startedAt: { s1: 1 } }));
    });
    const client = new Client('tok', `ws://127.0.0.1:${port}/ws?token=tok`);
    try {
      await client.ready();
      // Give the frame time to fully arrive and be dispatched to ZERO live
      // handlers (none registered yet) — on loopback this is generous, not
      // flaky. Without the history buffer this message is gone for good the
      // instant it's dispatched; waitFor below can only succeed by reading it
      // back from history, never from a listener.
      await new Promise((resolve) => setTimeout(resolve, 100));
      const busy = await client.waitFor(isBusy, 200);
      expect(busy?.keys).toEqual(['s1']);
    } finally {
      client.close();
      wss.close();
    }
  });

  it('still works for a frame that has not arrived yet (live listener path)', async () => {
    const wss = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) => wss.once('listening', resolve));
    const { port } = wss.address() as AddressInfo;
    wss.on('connection', (ws) => {
      setTimeout(() => ws.send(JSON.stringify({ t: 'busy', keys: ['s2'], startedAt: { s2: 1 } })), 20);
    });
    const client = new Client('tok', `ws://127.0.0.1:${port}/ws?token=tok`);
    try {
      await client.ready();
      const busy = await client.waitFor(isBusy, 500);
      expect(busy?.keys).toEqual(['s2']);
    } finally {
      client.close();
      wss.close();
    }
  });
});

describe('findCard', () => {
  const base = { title: 't', prompt: '', status: 'todo' as const, kind: 'task' as const, contextIds: [], sessionIds: [], createdAt: 0, updatedAt: 0 };
  const cards: CanvasCard[] = [
    { ...base, id: 'card-abcd1234' },
    { ...base, id: 'card-abcd5678' },
  ];

  it('resolves an unambiguous prefix to the full card', () => {
    expect(findCard(cards, 'card-abcd1234').id).toBe('card-abcd1234');
  });

  it('resolves a shorter unique prefix', () => {
    // 'card-abcd1234' vs 'card-abcd5678' both share 'card-abcd' — use a fully
    // distinguishing prefix so this asserts the SUCCESS path, not ambiguity.
    expect(findCard(cards, 'card-abcd12').id).toBe('card-abcd1234');
  });
});

describe('isNeverPurgeSession', () => {
  const ids = new Set(['9d039e27-0ee5-4293-be44-f98454a42d8a', '7671f68f-bd1b-4a8d-ab24-a122583c2286']);

  it('matches a hardcoded orchestrator id', () => {
    expect(isNeverPurgeSession({ id: '9d039e27-0ee5-4293-be44-f98454a42d8a' }, ids)).toBe(true);
  });

  it('matches a cockpit-term-* title regardless of id', () => {
    expect(isNeverPurgeSession({ id: 'unrelated-id', title: 'cockpit-term-jmbp6v' }, ids)).toBe(true);
  });

  it('matches a "main" title regardless of id', () => {
    expect(isNeverPurgeSession({ id: 'unrelated-id', title: 'Main' }, ids)).toBe(true);
  });

  it('is false for an unrelated id/title', () => {
    expect(isNeverPurgeSession({ id: 'unrelated-id', title: 'some feature work' }, ids)).toBe(false);
  });
});

describe('scoreSession', () => {
  const NOW = Date.UTC(2026, 8, 24, 12, 0, 0);
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  const base: TriageInput = {
    id: 'sess-1', title: 'some feature work', lastActivity: NOW - 10 * DAY, messageCount: 20, toolCallCount: 8,
    hasHandoff: false, hasMemoryLeaf: false, pendingAsk: false, hasPrMention: false,
    editCount: 0, commitCount: 0, hasCanvasRefs: false, unansweredRequest: false, neverPurge: false, now: NOW,
  };

  it('forces KEEP for a hardcoded never-purge session regardless of other signals', () => {
    const r = scoreSession({ ...base, neverPurge: true, messageCount: 0, toolCallCount: 0 });
    expect(r.verdict).toBe('KEEP');
  });

  it('scores a thin/empty session as PURGE', () => {
    const r = scoreSession({ ...base, messageCount: 1, toolCallCount: 0, lastActivity: NOW - 60 * DAY });
    expect(r.verdict).toBe('PURGE');
  });

  it('scores handoff + memory + old + no pending as the strongest PURGE case', () => {
    const r = scoreSession({
      ...base, hasHandoff: true, hasMemoryLeaf: true, lastActivity: NOW - 60 * DAY, pendingAsk: false,
    });
    expect(r.verdict).toBe('PURGE');
    expect(r.signals).toContain('fully-distilled-elsewhere');
  });

  it('never PURGEs a session with a pending question, even if otherwise thin and old', () => {
    const r = scoreSession({
      ...base, messageCount: 1, toolCallCount: 0, lastActivity: NOW - 60 * DAY, pendingAsk: true,
    });
    expect(r.verdict).not.toBe('PURGE');
  });

  it('never PURGEs a very recent session, even if otherwise thin', () => {
    const r = scoreSession({ ...base, messageCount: 1, toolCallCount: 0, lastActivity: NOW - 2 * HOUR });
    expect(r.verdict).not.toBe('PURGE');
  });

  it('does not purge a thin-message session that made edits', () => {
    const r = scoreSession({ ...base, messageCount: 2, toolCallCount: 0, editCount: 6, lastActivity: NOW - 60 * DAY });
    expect(r.verdict).not.toBe('PURGE');
  });

  it('counts canvas-refs as a keep signal', () => {
    const r = scoreSession({ ...base, hasCanvasRefs: true, hasPrMention: true, commitCount: 1 });
    expect(r.signals).toContain('canvas-refs');
    expect(r.verdict).toBe('KEEP');
  });

  it('never PURGEs a session whose last turn is an unanswered Samuel request', () => {
    const r = scoreSession({
      ...base, messageCount: 1, toolCallCount: 0, lastActivity: NOW - 60 * DAY, unansweredRequest: true,
    });
    expect(r.verdict).not.toBe('PURGE');
    expect(r.signals).toContain('unanswered-request');
  });
});

describe('feedTranscriptLine', () => {
  const feed = (lines: object[]) => {
    const s = newTranscriptScan();
    for (const l of lines) feedTranscriptLine(s, JSON.stringify(l));
    return s;
  };
  const user = (text: string) => ({ type: 'user', message: { content: text } });
  const asst = (...content: object[]) => ({ type: 'assistant', message: { content } });

  it('ignores loose "merged" chatter but matches a real PR URL', () => {
    expect(feed([user('it got merged yesterday, PR #12 was fine')]).prMention).toBe(false);
    expect(feed([user('see https://github.com/acme/repo/pull/42')]).prMention).toBe(true);
  });

  it('counts edits, commits and gh pr create as shipped work', () => {
    const s = feed([
      asst({ type: 'tool_use', name: 'Edit', input: { file_path: '/a' } }),
      asst({ type: 'tool_use', name: 'Bash', input: { command: 'git commit -m x' } }),
      asst({ type: 'tool_use', name: 'Bash', input: { command: 'gh pr create --fill' } }),
    ]);
    expect(s.editCount).toBe(1);
    expect(s.commitCount).toBe(2);
    expect(s.prMention).toBe(true);
    expect(s.toolCallCount).toBe(3);
  });

  it('tracks whether the last real turn is Samuel with no answer after it', () => {
    expect(feed([user('do X'), asst({ type: 'text', text: 'done' })]).lastRole).toBe('assistant');
    expect(feed([user('do X'), asst({ type: 'text', text: 'done' }), user('and Y?')]).lastRole).toBe('user');
  });
});
