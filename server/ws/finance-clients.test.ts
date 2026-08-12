import { describe, it, expect, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { registerFinanceClient, emitFinance, hasFinanceClients, _resetFinanceClients } from './finance-clients';

// Socket falso: registra os payloads enviados e chama o handler de 'close'.
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

describe('finance-clients (push owner-only)', () => {
  beforeEach(() => _resetFinanceClients());

  it('emitFinance envia só pros sockets registrados', () => {
    const a = fakeWs(); const b = fakeWs();
    registerFinanceClient(a.ws);
    emitFinance(null);
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(0); // b nunca registrou → nunca recebe financeiro
  });

  it('registro é idempotente', () => {
    const a = fakeWs();
    registerFinanceClient(a.ws); registerFinanceClient(a.ws);
    emitFinance(null);
    expect(a.sent).toHaveLength(1);
  });

  it('desregistra no close', () => {
    const a = fakeWs();
    registerFinanceClient(a.ws);
    expect(hasFinanceClients()).toBe(true);
    a.close();
    expect(hasFinanceClients()).toBe(false);
    emitFinance(null);
    expect(a.sent).toHaveLength(0);
  });
});
