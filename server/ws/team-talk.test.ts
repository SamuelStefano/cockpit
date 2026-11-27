import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { WebSocket } from 'ws';

const m = vi.hoisted(() => ({
  send: vi.fn(),
  taps: new Set<(msg: unknown) => void>(),
  team: [] as Record<string, unknown>[],
  paused: false,
  drop: null as null | ((msg: unknown) => boolean),
  recording: new Set<unknown>(),
}));
vi.mock('../team-log', () => ({ isTeamPaused: () => m.paused }));
vi.mock('./broadcast', () => ({
  send: m.send, broadcast: vi.fn(),
  addBroadcastTap: (fn: (msg: unknown) => void) => { m.taps.add(fn); return () => m.taps.delete(fn); },
  setRecordingDrop: (fn: ((msg: unknown) => boolean) | null) => { m.drop = fn; },
  setSocketRecording: (ws: unknown, on: boolean) => { if (on) m.recording.add(ws); else m.recording.delete(ws); },
}));
vi.mock('../team', () => ({ getTeam: async () => m.team }));
vi.mock('./team-state-frames', () => ({
  teamStateSnapshot: async () => ({ bots: [{ id: 'ana1', name: 'Ana', status: 'working', task: 'SECRET task' }] }),
}));
vi.mock('../team-pending', () => ({
  readPendingQuestions: () => [{ botId: 'ana1', sessionKey: 'k', at: 1, questions: [{ question: 'SECRET need' }] }],
}));
vi.mock('../github/prs', () => ({
  getPrsSnapshot: async () => ({
    fetchedAt: 1, merged: [], review: [], mergedSinceDays: 30, mergedTruncated: false,
    mine: [{ url: 'https://github.com/o/secret/pull/1', number: 1, title: 'SECRET pr', repo: 'o/secret', headRef: 'ana1/b', state: 'open', checks: 'success', review: 'none', mergeable: 'ok' }],
  }),
}));

import { _resetTalkForTests, sendTalk, sendTalkMessage } from './team-talk';
import { threads, type Thread } from './threads';

const sock = () => new EventEmitter() as unknown as WebSocket;
const bot = (extra = {}) => ({ id: 'ana1', name: 'Ana', label: 'dev', ...extra });
const frames = () => m.send.mock.calls.map((c) => c[1] as { t: string; [k: string]: unknown });
const emit = (msg: unknown) => { for (const t of m.taps) t(msg); };

beforeEach(() => { vi.clearAllMocks(); m.taps.clear(); m.paused = false; m.drop = null; m.recording.clear(); m.team = [bot({ sessionId: 'sess-1' })]; threads.clear(); });
afterEach(() => { _resetTalkForTests(); });

describe('team talk', () => {
  it('ignores a student on get and on send', async () => {
    const handle = vi.fn();
    await sendTalk(sock(), { t: 'team-talk-get', botId: 'ana1' }, 'student');
    await sendTalkMessage(sock(), { t: 'team-talk-send', botId: 'ana1', text: 'oi', msgId: 'x' }, 'student', handle);
    expect(m.send).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });

  it('a bot without a session answers no-session and never calls the send path', async () => {
    m.team = [bot()];
    const handle = vi.fn();
    const ws = sock();
    await sendTalkMessage(ws, { t: 'team-talk-send', botId: 'ana1', text: 'oi', msgId: 'x' }, 'admin', handle);
    expect(handle).not.toHaveBeenCalled();
    expect(frames()[0]).toMatchObject({ t: 'team-talk-chunk', chunk: { kind: 'refused', reason: 'no-session' } });
    await sendTalk(ws, { t: 'team-talk-get', botId: 'ana1' }, 'admin');
    expect(frames().at(-1)).toMatchObject({ t: 'team-talk', talk: { state: 'no-session' } });
  });

  it('rejects empty and oversized text', async () => {
    const handle = vi.fn();
    await sendTalkMessage(sock(), { t: 'team-talk-send', botId: 'ana1', text: '   ', msgId: 'x' }, 'admin', handle);
    await sendTalkMessage(sock(), { t: 'team-talk-send', botId: 'ana1', text: 'x'.repeat(4001), msgId: 'x' }, 'admin', handle);
    expect(frames().map((f) => (f.chunk as { reason: string }).reason)).toEqual(['empty', 'too-long']);
    expect(handle).not.toHaveBeenCalled();
  });

  it("sends through the normal 'send' path on the bot's own bound session", async () => {
    const handle = vi.fn(async () => {});
    await sendTalkMessage(sock(), { t: 'team-talk-send', botId: 'ana1', text: ' oi ', msgId: 'x1' }, 'admin', handle);
    expect(handle).toHaveBeenCalledWith(expect.anything(), { t: 'send', sessionKey: 'bot-ana1', sessionId: 'sess-1', text: 'oi', msgId: 'x1' }, 'admin');
  });

  it('streams the bot turn to the dialog and ignores other bots', async () => {
    const ws = sock();
    await sendTalk(ws, { t: 'team-talk-get', botId: 'ana1' }, 'admin');
    m.send.mockClear();
    emit({ t: 'delta', sessionKey: 'bot-ana1', text: 'olá mundo' });
    emit({ t: 'delta', sessionKey: 'bot-zzzz', text: 'other ' });
    emit({ t: 'done', sessionKey: 'bot-ana1', sessionId: 's' });
    expect(frames().slice(0, 3)).toEqual([
      { t: 'team-talk-chunk', botId: 'ana1', chunk: { kind: 'delta', text: 'olá ' } },
      { t: 'team-talk-chunk', botId: 'ana1', chunk: { kind: 'delta', text: 'mundo' } },
      { t: 'team-talk-chunk', botId: 'ana1', chunk: { kind: 'done' } },
    ]);
  });

  it('recording mode redacts snapshot and stream on the server', async () => {
    const ws = sock();
    await sendTalk(ws, { t: 'team-talk-get', botId: 'ana1', recording: true }, 'admin');
    emit({ t: 'delta', sessionKey: 'bot-ana1', text: 'SECRET reply' });
    const json = JSON.stringify(frames());
    expect(json).not.toContain('SECRET');
    expect(frames()[0]).toMatchObject({ talk: { redacted: true, state: 'working', openPrs: 1, needs: 1 } });
    expect(frames()[1]).toMatchObject({ chunk: { kind: 'delta', redacted: true, chars: 12 } });
  });

  it('a full snapshot carries task, PRs and state when not recording', async () => {
    await sendTalk(sock(), { t: 'team-talk-get', botId: 'ana1' }, 'admin');
    expect(frames()[0]).toMatchObject({ talk: { redacted: false, state: 'working', task: 'SECRET task', prs: [{ number: 1 }] } });
  });

  it('maps the stream through a live thread of that bot even under another key', async () => {
    threads.set('tab-key', { params: { botId: 'ana1' } } as unknown as Thread);
    const ws = sock();
    await sendTalk(ws, { t: 'team-talk-get', botId: 'ana1' }, 'admin');
    m.send.mockClear();
    emit({ t: 'delta', sessionKey: 'tab-key', text: 'x ' });
    expect(frames()).toHaveLength(1);
  });

  it('redacts secrets in deltas and in the snapshot even when not recording, also when split across deltas', async () => {
    const ws = sock();
    await sendTalk(ws, { t: 'team-talk-get', botId: 'ana1' }, 'admin');
    m.send.mockClear();
    emit({ t: 'delta', sessionKey: 'bot-ana1', text: 'key is ghp_abcdefgh' });
    emit({ t: 'delta', sessionKey: 'bot-ana1', text: 'ijklmnopqrst done ' });
    emit({ t: 'done', sessionKey: 'bot-ana1', sessionId: 's' });
    const text = frames().filter((f) => (f.chunk as { kind: string }).kind === 'delta').map((f) => (f.chunk as { text: string }).text).join('');
    expect(text).not.toContain('ghp_abcdefgh');
    expect(text).toContain('[secret]');
  });

  it('scrubs secrets from the snapshot task and PR titles', async () => {
    const { scrubTalkSnapshot } = await import('../../shared/team-talk');
    const s = scrubTalkSnapshot({ redacted: false, botId: 'a', name: 'A', label: '', state: 'idle', task: 'use token=abcd1234efgh5678', prs: [{ number: 1, title: 'ghp_abcdefghijklmnopqrstu', url: 'u', state: 'open' }], needs: ['password=hunter22222'], at: 1 });
    expect(JSON.stringify(s)).not.toMatch(/abcd1234efgh5678|ghp_abcdefghijklmnopqrstu|hunter22222/);
  });

  it('refuses while the team is paused, and keeps one message in flight per bot', async () => {
    const handle = vi.fn(async () => {});
    const ws = sock();
    m.paused = true;
    await sendTalkMessage(ws, { t: 'team-talk-send', botId: 'ana1', text: 'oi', msgId: 'a' }, 'admin', handle);
    expect(frames().at(-1)).toMatchObject({ chunk: { kind: 'refused', reason: 'paused' } });
    m.paused = false;
    await sendTalkMessage(ws, { t: 'team-talk-send', botId: 'ana1', text: 'oi', msgId: 'a' }, 'admin', handle);
    await sendTalkMessage(ws, { t: 'team-talk-send', botId: 'ana1', text: 'de novo', msgId: 'b' }, 'admin', handle);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(frames().at(-1)).toMatchObject({ chunk: { kind: 'refused', reason: 'busy' } });
    emit({ t: 'done', sessionKey: 'bot-ana1', sessionId: 's' });
    await sendTalkMessage(ws, { t: 'team-talk-send', botId: 'ana1', text: 'agora sim', msgId: 'c' }, 'admin', handle);
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it('a rejected send frees the bot', async () => {
    const handle = vi.fn(async () => {});
    const ws = sock();
    await sendTalkMessage(ws, { t: 'team-talk-send', botId: 'ana1', text: 'oi', msgId: 'a' }, 'admin', handle);
    emit({ t: 'send-reject', sessionKey: 'bot-ana1', reason: 'ctx-hard', text: 'oi', message: 'no' });
    await sendTalkMessage(ws, { t: 'team-talk-send', botId: 'ana1', text: 'de novo', msgId: 'b' }, 'admin', handle);
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it('marks the socket as recording and the drop filter cuts bot text from the normal fan-out', async () => {
    const ws = sock();
    await sendTalk(ws, { t: 'team-talk-get', botId: 'ana1', recording: true }, 'admin');
    expect(m.recording.has(ws)).toBe(true);
    const drop = m.drop!;
    expect(drop({ t: 'delta', sessionKey: 'bot-ana1', text: 'x' })).toBe(true);
    expect(drop({ t: 'tool', sessionKey: 'bot-ana1' })).toBe(true);
    expect(drop({ t: 'team-message', item: {} })).toBe(true);
    expect(drop({ t: 'done', sessionKey: 'bot-ana1' })).toBe(false);
    expect(drop({ t: 'delta', sessionKey: 'some-human-chat', text: 'x' })).toBe(false);
    await sendTalk(ws, { t: 'team-talk-get', botId: 'ana1' }, 'admin');
    expect(m.recording.has(ws)).toBe(false);
  });
});
