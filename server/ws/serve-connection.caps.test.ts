import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { serveConnection } from './serve-connection';

function fakeSocket() {
  const sent: Array<{ t?: string; caps?: { clientVisibility?: boolean } }> = [];
  const ws = Object.assign(new EventEmitter(), { readyState: 1, OPEN: 1, bufferedAmount: 0, send: (d: string) => { sent.push(JSON.parse(d)); }, terminate() {}, close() {} });
  return { ws, sent };
}
const serve = (ws: unknown, opts: Parameters<typeof serveConnection>[1]) => serveConnection(ws as Parameters<typeof serveConnection>[0], opts);
const capsOf = (sent: ReturnType<typeof fakeSocket>['sent']) => sent.find((m) => m.t === 'caps')?.caps;

describe('client-visibility support', () => {
  it('reaches a sealed peer, the only caps a browser accepts behind the relay', () => {
    const { ws, sent } = fakeSocket();
    serve(ws, { role: 'admin', transport: 'sealed' });
    expect(capsOf(sent)?.clientVisibility).toBe(true);
    ws.emit('close');
  });

  it('is swallowed before authorize, so a student gets no "sem permissão"', () => {
    const { ws, sent } = fakeSocket();
    serve(ws, { role: 'student', transport: 'sealed' });
    const before = sent.length;
    ws.emit('message', Buffer.from('{"t":"client-visibility","hidden":true}'));
    expect(sent.slice(before).filter((m) => m.t === 'error')).toEqual([]);
    ws.emit('close');
  });
});
