import { describe, expect, it } from 'vitest';
import { initialTalk, talkReducer } from './talk-state';

const snap = { redacted: false as const, botId: 'a', name: 'A', label: 'Dev', state: 'idle' as const, prs: [], needs: [], at: 1 };

describe('talkReducer', () => {
  it('ignores snapshots of another bot', () => {
    const s = talkReducer(initialTalk, { t: 'open', botId: 'a' });
    expect(talkReducer(s, { t: 'snapshot', talk: { ...snap, botId: 'b' } })).toBe(s);
    expect(talkReducer(s, { t: 'snapshot', talk: snap }).snapshot).toBe(snap);
  });
  it('streams a reply and finishes', () => {
    let s = talkReducer(initialTalk, { t: 'open', botId: 'a' });
    s = talkReducer(s, { t: 'sent', msgId: 'm1' });
    s = talkReducer(s, { t: 'chunk', botId: 'a', chunk: { kind: 'delta', text: 'Oi ' } });
    s = talkReducer(s, { t: 'chunk', botId: 'a', chunk: { kind: 'delta', text: 'tudo' } });
    expect(s.reply).toBe('Oi tudo');
    s = talkReducer(s, { t: 'chunk', botId: 'a', chunk: { kind: 'done' } });
    expect(s.sending).toBe(false);
  });
  it('allows a single message in flight', () => {
    let s = talkReducer(initialTalk, { t: 'open', botId: 'a' });
    s = talkReducer(s, { t: 'sent', msgId: 'm1' });
    expect(talkReducer(s, { t: 'sent', msgId: 'm2' }).msgId).toBe('m1');
  });
  it('never shows redacted deltas and reports refusals', () => {
    let s = talkReducer(initialTalk, { t: 'open', botId: 'a' });
    s = talkReducer(s, { t: 'sent', msgId: 'm1' });
    expect(talkReducer(s, { t: 'chunk', botId: 'a', chunk: { kind: 'delta', redacted: true, chars: 9 } }).reply).toBe('');
    const r = talkReducer(s, { t: 'chunk', botId: 'a', msgId: 'm1', chunk: { kind: 'refused', reason: 'no-session' } });
    expect(r.sending).toBe(false);
    expect(r.notice).toContain('sessão');
  });
  it('drops chunks of a closed dialog', () => {
    const s = talkReducer(talkReducer(initialTalk, { t: 'open', botId: 'a' }), { t: 'close' });
    expect(talkReducer(s, { t: 'chunk', botId: 'a', chunk: { kind: 'delta', text: 'x' } })).toBe(s);
  });
});
