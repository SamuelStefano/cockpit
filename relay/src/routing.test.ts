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
    r.bindAgent('A', 'a1', agentA);
    r.bindAgent('B', 'b1', agentB);
    expect(r.toAgent('A', '', 'hi')).toBe(true);
    expect(agentA.sent).toEqual(['hi']);
    expect(agentB.sent).toEqual([]);
  });

  it('a box id of another account is offline, never routed', () => {
    const r = new Registry();
    const agentB = fakeSock();
    r.bindAgent('B', 'b1', agentB);
    expect(r.toAgent('A', 'b1', 'hi')).toBe(false);
    expect(r.resolve('A', 'b1')).toBeNull();
    expect(agentB.sent).toEqual([]);
  });

  it('returns false when the account has no agent online', () => {
    const r = new Registry();
    r.addBrowser('A', fakeSock());
    expect(r.toAgent('A', '', 'hi')).toBe(false);
  });

  it('fans an agent frame only to the same account browsers', () => {
    const r = new Registry();
    const a1 = fakeSock(), a2 = fakeSock(), b1 = fakeSock();
    r.bindAgent('A', 'a1', fakeSock()); r.bindAgent('B', 'b1', fakeSock());
    r.addBrowser('A', a1); r.addBrowser('A', a2); r.addBrowser('B', b1);
    expect(r.toBrowsers('A', 'a1', 'delta')).toBe(2);
    expect(a1.sent).toEqual(['delta']);
    expect(a2.sent).toEqual(['delta']);
    expect(b1.sent).toEqual([]);
  });

  it('eachBrowser visits only the same account open browsers', () => {
    const r = new Registry();
    const a1 = fakeSock(), a2 = fakeSock(), b1 = fakeSock(), closed = fakeSock(); closed.readyState = 3;
    r.addBrowser('A', a1); r.addBrowser('A', a2, 'a2'); r.addBrowser('A', closed); r.addBrowser('B', b1);
    const seen: Sock[] = [];
    r.eachBrowser('A', (s) => seen.push(s));
    expect(seen).toEqual([a1, a2]);
    r.eachBrowser('C', () => { throw new Error('no bucket, no iteration'); });
  });

  it('skips sockets that are not OPEN', () => {
    const r = new Registry();
    const open = fakeSock(), closed = fakeSock(); closed.readyState = 3;
    r.bindAgent('A', 'a1', fakeSock());
    r.addBrowser('A', open); r.addBrowser('A', closed);
    expect(r.toBrowsers('A', 'a1', 'x')).toBe(1);
    expect(closed.sent).toEqual([]);
  });

  it('unbinds agent and removes browser, GCing empty buckets', () => {
    const r = new Registry();
    const agent = fakeSock(), b = fakeSock();
    r.bindAgent('A', 'a1', agent); r.addBrowser('A', b);
    expect(r.hasAgent('A')).toBe(true);
    expect(r.unbindAgent('A', 'a1', agent)).toBe(true);
    expect(r.hasAgent('A')).toBe(false);
    r.removeBrowser('A', b);
    expect(r.stats().accounts).toBe(0);
  });

  it('unbindAgent ignores a stale socket (a newer one of the same agent replaced it)', () => {
    const r = new Registry();
    const oldA = fakeSock(), newA = fakeSock();
    r.bindAgent('A', 'a1', oldA);
    r.bindAgent('A', 'a1', newA);
    expect(r.unbindAgent('A', 'a1', oldA)).toBe(false);
    expect(r.toAgent('A', '', 'z')).toBe(true);
    expect(newA.sent).toEqual(['z']);
  });

  it('stats counts accounts, agents and browsers', () => {
    const r = new Registry();
    r.bindAgent('A', 'a1', fakeSock()); r.bindAgent('A', 'a2', fakeSock()); r.addBrowser('A', fakeSock());
    r.addBrowser('B', fakeSock());
    expect(r.stats()).toEqual({ accounts: 2, agents: 2, browsers: 2 });
  });

  it('bindAgent returns the previous socket of the SAME agent only', () => {
    const r = new Registry();
    const oldA = fakeSock(), newA = fakeSock(), other = fakeSock();
    expect(r.bindAgent('A', 'a1', oldA)).toBeNull();
    expect(r.bindAgent('A', 'a2', other)).toBeNull();
    expect(r.bindAgent('A', 'a1', newA)).toBe(oldA);
    expect(r.bindAgent('A', 'a1', newA)).toBeNull();
  });
});

describe('Registry with several boxes per account', () => {
  function twoBoxes() {
    const r = new Registry();
    const box1 = fakeSock(), box2 = fakeSock();
    r.bindAgent('A', 'b1', box1);
    r.bindAgent('A', 'b2', box2);
    const on1 = fakeSock(), on2 = fakeSock(), unbound = fakeSock();
    r.addBrowser('A', on1, 'b1'); r.addBrowser('A', on2, 'b2'); r.addBrowser('A', unbound);
    return { r, box1, box2, on1, on2, unbound };
  }

  it('both boxes stay bound; the earliest is the primary', () => {
    const { r } = twoBoxes();
    expect(r.agentIds('A')).toEqual(['b1', 'b2']);
    expect(r.primary('A')).toBe('b1');
  });

  it('a tab reaches only its bound box; an unbound tab reaches the primary', () => {
    const { r, box1, box2 } = twoBoxes();
    expect(r.toAgent('A', 'b2', 'to2')).toBe(true);
    expect(r.toAgent('A', '', 'toPrimary')).toBe(true);
    expect(box1.sent).toEqual(['toPrimary']);
    expect(box2.sent).toEqual(['to2']);
  });

  it("a box's broadcast never reaches the other box's tabs", () => {
    const { r, on1, on2, unbound } = twoBoxes();
    expect(r.toBrowsers('A', 'b2', 'from2')).toBe(1);
    expect(on2.sent).toEqual(['from2']);
    expect(on1.sent).toEqual([]);
    expect(unbound.sent).toEqual([]);
    expect(r.toBrowsers('A', 'b1', 'from1')).toBe(2);
    expect(unbound.sent).toEqual(['from1']);
  });

  it('a directed frame is delivered only if the tab reaches the sender box', () => {
    const { r, on1, on2 } = twoBoxes();
    expect(r.toBrowser('A', 'b2', on1, 'x', false)).toBe(false);
    expect(r.toBrowser('A', 'b2', on2, 'y', false)).toBe(true);
    expect(r.toBrowser('B', 'b2', on2, 'z', false)).toBe(false);
    expect(on1.sent).toEqual([]);
    expect(on2.sent).toEqual(['y']);
  });

  it('tabsOf lists the tabs that reach a box, with their bound key', () => {
    const { r, on1, on2, unbound } = twoBoxes();
    expect(r.tabsOf('A', 'b1')).toEqual([[on1, 'b1'], [unbound, '']]);
    expect(r.tabsOf('A', 'b2')).toEqual([[on2, 'b2']]);
  });

  it('when the primary goes away the next box becomes primary', () => {
    const { r, box1, box2 } = twoBoxes();
    r.unbindAgent('A', 'b1', box1);
    expect(r.primary('A')).toBe('b2');
    expect(r.toAgent('A', '', 'z')).toBe(true);
    expect(box2.sent).toEqual(['z']);
    expect(r.toAgent('A', 'b1', 'gone')).toBe(false);
  });

  it('a tab bound to an offline box starts reaching it when it comes online', () => {
    const r = new Registry();
    const tab = fakeSock(), box = fakeSock();
    r.addBrowser('A', tab, 'b9');
    expect(r.hasAgent('A', 'b9')).toBe(false);
    r.bindAgent('A', 'b9', box);
    expect(r.toBrowsers('A', 'b9', 'hi')).toBe(1);
    expect(tab.sent).toEqual(['hi']);
  });

  it('counts tabs per bound box for the tab cap', () => {
    const { r } = twoBoxes();
    r.addBrowser('A', fakeSock(), 'b2');
    expect(r.browserCount('A', 'b2')).toBe(2);
    expect(r.browserCount('A', 'b1')).toBe(2);
    expect(r.browserCount('A')).toBe(2);
  });
});

describe('Registry primary box and peeks', () => {
  it('the earliest-paired online box is primary, and gets it back after a blip', () => {
    const r = new Registry();
    const vps = fakeSock(), pc = fakeSock(), vps2 = fakeSock();
    r.bindAgent('A', 'pc', pc, 200);
    r.bindAgent('A', 'vps', vps, 100);
    expect(r.primary('A')).toBe('vps');
    r.unbindAgent('A', 'vps', vps);
    expect(r.primary('A')).toBe('pc');
    r.bindAgent('A', 'vps', vps2, 100);
    expect(r.primary('A')).toBe('vps');
  });

  it('counts unbound tabs and tabs naming the primary together for the cap', () => {
    const r = new Registry();
    r.bindAgent('A', 'b1', fakeSock(), 1);
    r.addBrowser('A', fakeSock()); r.addBrowser('A', fakeSock(), 'b1');
    expect(r.browserCount('A', 'b1')).toBe(2);
    expect(r.browserCount('A')).toBe(2);
    expect(r.browserCount('A', 'b9')).toBe(0);
  });

  it('tabs on offline or unknown boxes share one cap budget', () => {
    const r = new Registry();
    r.bindAgent('A', 'b1', fakeSock(), 1);
    r.addBrowser('A', fakeSock(), 'x1'); r.addBrowser('A', fakeSock(), 'x2');
    expect(r.browserCount('A', 'x3')).toBe(2);
    expect(r.browserCount('A', 'b1')).toBe(0);
  });

  it('peeks get the box frames but neither presence nor the tab cap', () => {
    const r = new Registry();
    const box = fakeSock(), peek = fakeSock();
    r.bindAgent('A', 'b2', box);
    r.addBrowser('A', peek, 'b2', true);
    expect(r.presenceChanges('A')).toEqual([['b2', box, false]]);
    expect(r.browserCount('A', 'b2')).toBe(0);
    expect(r.browserCount('A', 'b2', true)).toBe(1);
    expect(r.toBrowsers('A', 'b2', 'x')).toBe(1);
    expect(peek.sent).toEqual(['x']);
  });
});

describe('Registry presence per box', () => {
  it('reports the initial state of a freshly bound box and then only transitions', () => {
    const r = new Registry();
    const box1 = fakeSock(), box2 = fakeSock();
    r.bindAgent('A', 'b1', box1);
    r.bindAgent('A', 'b2', box2);
    expect(r.presenceChanges('A')).toEqual([['b1', box1, false], ['b2', box2, false]]);
    const t = fakeSock();
    r.addBrowser('A', t, 'b2');
    expect(r.presenceChanges('A')).toEqual([['b2', box2, true]]);
    r.addBrowser('A', fakeSock(), 'b2');
    expect(r.presenceChanges('A')).toEqual([]);
    r.removeBrowser('A', t);
    expect(r.presenceChanges('A')).toEqual([]);
  });

  it('unbound tabs make the primary present, and move with it', () => {
    const r = new Registry();
    const box1 = fakeSock(), box2 = fakeSock();
    r.bindAgent('A', 'b1', box1); r.bindAgent('A', 'b2', box2);
    r.addBrowser('A', fakeSock());
    expect(r.presenceChanges('A')).toEqual([['b1', box1, true], ['b2', box2, false]]);
    r.unbindAgent('A', 'b1', box1);
    expect(r.presenceChanges('A')).toEqual([['b2', box2, true]]);
  });

  it('a reconnecting box gets its state again', () => {
    const r = new Registry();
    const old = fakeSock(), fresh = fakeSock();
    r.bindAgent('A', 'b1', old); r.addBrowser('A', fakeSock());
    r.presenceChanges('A');
    r.bindAgent('A', 'b1', fresh);
    expect(r.presenceChanges('A')).toEqual([['b1', fresh, true]]);
  });
});

describe('Registry hard buffer cap', () => {
  it('terminates a peer that stopped reading instead of buffering forever, both ways', () => {
    const r = new Registry();
    let agentCut = false, browserCut = false;
    const agent: Sock & { sent: string[] } = { sent: [], readyState: 1, bufferedAmount: HARD_BUFFER_BYTES + 1, send(d) { this.sent.push(d); }, terminate() { agentCut = true; } };
    const browser: Sock & { sent: string[] } = { sent: [], readyState: 1, bufferedAmount: HARD_BUFFER_BYTES + 1, send(d) { this.sent.push(d); }, terminate() { browserCut = true; } };
    r.bindAgent('A', 'a1', agent);
    r.addBrowser('A', browser);
    expect(r.toAgent('A', '', '{"t":"send"}')).toBe(false);
    expect(r.toBrowsers('A', 'a1', '{"t":"done"}')).toBe(0);
    expect(agentCut && browserCut).toBe(true);
    expect(agent.sent).toEqual([]);
    expect(browser.sent).toEqual([]);
  });
});
