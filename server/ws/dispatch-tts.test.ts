import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';

const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
vi.mock('./broadcast', () => bc);
const tts = vi.hoisted(() => ({ synthesize: vi.fn(async (_t: string) => Buffer.from([1, 2, 3])) }));
vi.mock('../tts', async (orig) => ({ ...(await orig<typeof import('../tts')>()), synthesize: tts.synthesize }));

import { handle } from './dispatch';

const ws = {} as WebSocket;

beforeEach(() => { vi.clearAllMocks(); });

describe('tts frame', () => {
  it('replies only to the requester with base64 audio and the same reqId', async () => {
    await handle(ws, { t: 'tts', reqId: 'r1', text: ' Olá. ' }, 'student');
    expect(tts.synthesize).toHaveBeenCalledWith('Olá.');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'tts-audio', reqId: 'r1', audio: Buffer.from([1, 2, 3]).toString('base64') });
    expect(bc.broadcast).not.toHaveBeenCalled();
  });

  it('answers tts-error for empty or oversized text without synthesizing', async () => {
    await handle(ws, { t: 'tts', reqId: 'r2', text: '  ' }, 'admin');
    await handle(ws, { t: 'tts', reqId: 'r3', text: 'a'.repeat(601) }, 'admin');
    expect(tts.synthesize).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'tts-error', reqId: 'r2' });
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'tts-error', reqId: 'r3' });
  });

  it('answers tts-error when the provider fails', async () => {
    tts.synthesize.mockRejectedValueOnce(new Error('boom'));
    await handle(ws, { t: 'tts', reqId: 'r4', text: 'oi' }, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'tts-error', reqId: 'r4' });
  });
});
