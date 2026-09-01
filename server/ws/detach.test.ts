import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { WebSocketServer, WebSocket } from 'ws';
import { setWss } from './broadcast';
import { detach } from './detach';

const OPEN = 1;

type FakeClient = { readyState: number; OPEN: number; bufferedAmount: number; sent: string[]; send: (s: string) => void };

function client(): FakeClient {
  const sent: string[] = [];
  return { readyState: OPEN, OPEN, bufferedAmount: 0, sent, send: (s) => sent.push(s) };
}

function parse(c: FakeClient) {
  return c.sent.map((s) => JSON.parse(s) as { t: string; message?: string; sessionKey?: string });
}

// Uma rejeição não capturada neste processo derruba o backend inteiro (o
// unhandledRejection do index.ts chama shutdown(1) e mata todos os runs), então o
// contrato aqui é: NUNCA deixar a rejeição escapar.
describe('detach', () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (r: unknown) => unhandled.push(r);

  beforeEach(() => {
    unhandled.length = 0;
    setWss(null);
    process.on('unhandledRejection', onUnhandled);
  });
  afterEach(() => { process.off('unhandledRejection', onUnhandled); });

  it('não deixa a rejeição virar unhandledRejection', async () => {
    const c = client();
    detach(c as unknown as WebSocket, Promise.reject(new Error('boom')));
    await new Promise((r) => setImmediate(r));
    expect(unhandled).toHaveLength(0);
  });

  it('reporta o erro no socket que pediu', async () => {
    const c = client();
    detach(c as unknown as WebSocket, Promise.reject(new Error('boom')));
    await new Promise((r) => setImmediate(r));
    expect(parse(c)).toEqual([{ t: 'error', message: 'boom' }]);
  });

  it('carimba a sessão quando o pedido tem uma', async () => {
    const c = client();
    detach(c as unknown as WebSocket, Promise.reject(new Error('boom')), 'sess-1');
    await new Promise((r) => setImmediate(r));
    expect(parse(c)[0].sessionKey).toBe('sess-1');
  });

  it('cai em broadcast quando o pedido não tem dono', async () => {
    const c = client();
    setWss({ clients: new Set([c]) } as unknown as WebSocketServer);
    detach(null, Promise.reject(new Error('boom')));
    await new Promise((r) => setImmediate(r));
    expect(parse(c)[0].t).toBe('error');
  });

  it('não emite nada quando a promessa resolve', async () => {
    const c = client();
    detach(c as unknown as WebSocket, Promise.resolve('ok'));
    await new Promise((r) => setImmediate(r));
    expect(c.sent).toHaveLength(0);
  });

  it('sobrevive a uma rejeição sem Error (string crua)', async () => {
    const c = client();
    detach(c as unknown as WebSocket, Promise.reject('cru'));
    await new Promise((r) => setImmediate(r));
    expect(parse(c)[0].message).toBe('cru');
    expect(unhandled).toHaveLength(0);
  });
});
