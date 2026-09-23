import { describe, it, expect, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { registerCanvasClient, emitCanvasMsg, _resetCanvasClients } from './canvas-clients';

// Same fake-socket shape as finance-clients.test.ts: records sent payloads
// and lets the test fire the 'close' handler.
function fakeWs() {
  const sent: string[] = [];
  let onClose: (() => void) | null = null;
  const ws = {
    readyState: 1, OPEN: 1,
    send: (p: string) => sent.push(p),
    on: (ev: string, cb: () => void) => { if (ev === 'close') onClose = cb; },
  } as unknown as WebSocket;
  return { ws, sent, close: () => onClose?.() };
}

describe('canvas-clients (push admin-only, canvas-flow-failed etc.)', () => {
  beforeEach(() => _resetCanvasClients());

  it('emitCanvasMsg sends only to registered sockets', () => {
    const a = fakeWs(); const b = fakeWs();
    registerCanvasClient(a.ws);
    emitCanvasMsg({ t: 'canvas-flow-failed', flowId: 'x', message: 'falhou' });
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(0); // b never registered (never sent canvas-get) — never receives it
  });

  it('registration is idempotent', () => {
    const a = fakeWs();
    registerCanvasClient(a.ws); registerCanvasClient(a.ws);
    emitCanvasMsg({ t: 'canvas-flow-failed', flowId: 'x', message: 'falhou' });
    expect(a.sent).toHaveLength(1);
  });

  it('unregisters on close', () => {
    const a = fakeWs();
    registerCanvasClient(a.ws);
    a.close();
    emitCanvasMsg({ t: 'canvas-flow-failed', flowId: 'x', message: 'falhou' });
    expect(a.sent).toHaveLength(0);
  });
});
