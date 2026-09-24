import { describe, it, expect } from 'vitest';
import { Registry, HARD_BUFFER_BYTES, type Sock } from './routing';

function fakeSock(): Sock & { sent: string[] } {
  const sent: string[] = [];
  return { sent, readyState: 1, send: (d: string) => sent.push(d) };
}

describe('Registry routing (per-account scoping)', () => {
  it('routes a browser frame only to that account agent', () => {
    const r = new Registry();
    const agentA = fakeSock(), agentB = fakeSock();
    r.bindAgent('A', agentA);
    r.bindAgent('B', agentB);
    expect(r.toAgent('A', 'hi')).toBe(true);
    expect(agentA.sent).toEqual(['hi']);
    expect(agentB.sent).toEqual([]); // B never sees A's frame
  });

  it('returns false when the account has no agent online', () => {
    const r = new Registry();
    r.addBrowser('A', fakeSock());
    expect(r.toAgent('A', 'hi')).toBe(false);
  });

  it('fans an agent frame only to the same account browsers', () => {
    const r = new Registry();
    const a1 = fakeSock(), a2 = fakeSock(), b1 = fakeSock();
    r.addBrowser('A', a1); r.addBrowser('A', a2); r.addBrowser('B', b1);
    expect(r.toBrowsers('A', 'delta')).toBe(2);
    expect(a1.sent).toEqual(['delta']);
    expect(a2.sent).toEqual(['delta']);
    expect(b1.sent).toEqual([]); // account B isolated
  });

  // eachBrowser é a única outra iteração sobre abas (reemissão de caps no
  // agent-caps): precisa do mesmo escopo por conta que toBrowsers.
  it('eachBrowser visits only the same account open browsers', () => {
    const r = new Registry();
    const a1 = fakeSock(), a2 = fakeSock(), b1 = fakeSock(), closed = fakeSock(); closed.readyState = 3;
    r.addBrowser('A', a1); r.addBrowser('A', a2); r.addBrowser('A', closed); r.addBrowser('B', b1);
    const seen: Sock[] = [];
    r.eachBrowser('A', (s) => seen.push(s));
    expect(seen).toEqual([a1, a2]);
    r.eachBrowser('C', () => { throw new Error('conta sem bucket não itera'); });
  });

  it('skips sockets that are not OPEN', () => {
    const r = new Registry();
    const open = fakeSock(), closed = fakeSock(); closed.readyState = 3;
    r.addBrowser('A', open); r.addBrowser('A', closed);
    expect(r.toBrowsers('A', 'x')).toBe(1);
    expect(closed.sent).toEqual([]);
  });

  it('unbinds agent and removes browser, GCing empty buckets', () => {
    const r = new Registry();
    const agent = fakeSock(), b = fakeSock();
    r.bindAgent('A', agent); r.addBrowser('A', b);
    expect(r.hasAgent('A')).toBe(true);
    r.unbindAgent('A', agent);
    expect(r.hasAgent('A')).toBe(false);
    r.removeBrowser('A', b);
    expect(r.stats().accounts).toBe(0);
  });

  it('unbindAgent ignores a stale socket (a newer agent replaced it)', () => {
    const r = new Registry();
    const oldA = fakeSock(), newA = fakeSock();
    r.bindAgent('A', oldA);
    r.bindAgent('A', newA);       // reconnect replaced the socket
    r.unbindAgent('A', oldA);     // late close of the old one must not unbind the new
    expect(r.hasAgent('A')).toBe(true);
    expect(r.toAgent('A', 'z')).toBe(true);
    expect(newA.sent).toEqual(['z']);
  });

  it('stats counts accounts, agents and browsers', () => {
    const r = new Registry();
    r.bindAgent('A', fakeSock()); r.addBrowser('A', fakeSock());
    r.addBrowser('B', fakeSock());
    expect(r.stats()).toEqual({ accounts: 2, agents: 1, browsers: 2 });
  });

  it('addBrowser sinaliza transição 0→1 e removeBrowser 1→0 (presença pro agente)', () => {
    const r = new Registry();
    const b1 = fakeSock(), b2 = fakeSock();
    expect(r.addBrowser('A', b1)).toBe(true);   // primeira aba
    expect(r.addBrowser('A', b2)).toBe(false);  // já tinha aba
    expect(r.browserCount('A')).toBe(2);
    expect(r.removeBrowser('A', b1)).toBe(false); // ainda sobra b2
    expect(r.removeBrowser('A', b2)).toBe(true);  // última saiu
    expect(r.browserCount('A')).toBe(0);
  });

  it('bindAgent devolve o socket anterior pra terminar (sem fantasma)', () => {
    const r = new Registry();
    const oldA = fakeSock(), newA = fakeSock();
    expect(r.bindAgent('A', oldA)).toBeNull();   // não havia anterior
    expect(r.bindAgent('A', newA)).toBe(oldA);   // devolve o velho pra o caller matar
    expect(r.bindAgent('A', newA)).toBeNull();   // mesmo socket → nada a evictar
  });
});

describe('Registry hard buffer cap', () => {
  it('terminates a peer that stopped reading instead of buffering forever, both ways', () => {
    const r = new Registry();
    let agentCut = false, browserCut = false;
    const agent: Sock & { sent: string[] } = { sent: [], readyState: 1, bufferedAmount: HARD_BUFFER_BYTES + 1, send(d) { this.sent.push(d); }, terminate() { agentCut = true; } };
    const browser: Sock & { sent: string[] } = { sent: [], readyState: 1, bufferedAmount: HARD_BUFFER_BYTES + 1, send(d) { this.sent.push(d); }, terminate() { browserCut = true; } };
    r.bindAgent('A', agent);
    r.addBrowser('A', browser);
    expect(r.toAgent('A', '{"t":"send"}')).toBe(false);
    expect(r.toBrowsers('A', '{"t":"done"}')).toBe(0);
    expect(agentCut && browserCut).toBe(true);
    expect(agent.sent).toEqual([]);
    expect(browser.sent).toEqual([]);
  });
});
