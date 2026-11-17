import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { WebSocket } from 'ws';

const m = vi.hoisted(() => ({
  send: vi.fn(),
  taps: new Set<(msg: unknown) => void>(),
  team: [] as Record<string, unknown>[],
}));
vi.mock('./broadcast', () => ({
  send: m.send, broadcast: vi.fn(),
  addBroadcastTap: (fn: (msg: unknown) => void) => { m.taps.add(fn); return () => m.taps.delete(fn); },
}));
vi.mock('../team', () => ({ getTeam: async () => m.team }));
vi.mock('./team-panel-frames', () => ({
  build: async () => ({
    redacted: false, at: 1, needsYou: [],
    sectors: [{ id: 'engineering', name: 'Engenharia', openPrs: [], mergedPrs: [], bots: [{
      id: 'ana1', name: 'Ana', status: 'working', task: 'SECRET task', needs: [{ kind: 'question', botName: 'Ana', text: 'SECRET need' }],
      openPrs: [{ url: 'https://github.com/o/secret/pull/1', number: 1, title: 'SECRET pr', repo: 'o/secret', branch: 'b', state: 'open' }], mergedPrs: [],
    }] }],
  }),
}));

import { _resetTalkForTests, sendTalk, sendTalkMessage } from './team-talk';
import { threads, type Thread } from './threads';

const sock = () => new EventEmitter() as unknown as WebSocket;
const bot = (extra = {}) => ({ id: 'ana1', name: 'Ana', label: 'dev', ...extra });
const frames = () => m.send.mock.calls.map((c) => c[1] as { t: string; [k: string]: unknown });
const emit = (msg: unknown) => { for (const t of m.taps) t(msg); };

beforeEach(() => { vi.clearAllMocks(); m.taps.clear(); m.team = [bot({ sessionId: 'sess-1' })]; threads.clear(); });
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
    emit({ t: 'delta', sessionKey: 'bot-ana1', text: 'olá' });
    emit({ t: 'delta', sessionKey: 'bot-zzzz', text: 'other' });
    expect(frames()).toEqual([{ t: 'team-talk-chunk', botId: 'ana1', chunk: { kind: 'delta', text: 'olá' } }]);
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
    emit({ t: 'delta', sessionKey: 'tab-key', text: 'x' });
    expect(frames()).toHaveLength(1);
  });
});
