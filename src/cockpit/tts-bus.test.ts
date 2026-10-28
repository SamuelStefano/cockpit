import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClientMsg } from '../../shared/protocol';
import { handleTtsMsg, requestTts, setTtsSender } from './tts-bus';

afterEach(() => { setTtsSender(null); vi.useRealTimers(); });

function wire() {
  const sent: ClientMsg[] = [];
  setTtsSender((m) => { sent.push(m); return true; });
  return sent;
}

describe('tts bus', () => {
  it('sends a tts frame and resolves with the decoded audio for the matching reqId', async () => {
    const sent = wire();
    const p = requestTts('Olá', new AbortController().signal);
    const frame = sent[0] as Extract<ClientMsg, { t: 'tts' }>;
    expect(frame).toMatchObject({ t: 'tts', text: 'Olá' });
    expect(handleTtsMsg({ t: 'tts-audio', reqId: frame.reqId, audio: btoa('abc') })).toBe(true);
    const blob = await p;
    expect(blob.size).toBe(3);
    expect(blob.type).toBe('audio/mpeg');
  });

  it('ignores replies for ids it did not issue and leaves other frames alone', () => {
    wire();
    expect(handleTtsMsg({ t: 'tts-audio', reqId: 'other', audio: btoa('abc') })).toBe(true);
    expect(handleTtsMsg({ t: 'pong' } as never)).toBe(false);
  });

  it('rejects on tts-error, on abort, on timeout and when the socket is closed', async () => {
    const sent = wire();
    const p1 = requestTts('a', new AbortController().signal);
    handleTtsMsg({ t: 'tts-error', reqId: (sent[0] as { reqId: string }).reqId });
    await expect(p1).rejects.toThrow();

    const ctrl = new AbortController();
    const p2 = requestTts('b', ctrl.signal);
    ctrl.abort();
    await expect(p2).rejects.toThrow();

    vi.useFakeTimers();
    const p3 = requestTts('c', new AbortController().signal);
    const assertion = expect(p3).rejects.toThrow(/timeout/);
    await vi.advanceTimersByTimeAsync(20001);
    await assertion;

    setTtsSender(() => false);
    await expect(requestTts('d', new AbortController().signal)).rejects.toThrow();
  });
});
