import { describe, it, expect } from 'vitest';
import { causeMessage, connectionCause, formatSince, selectedBox, type CauseInput } from './connectionCause';

const BOX = { id: '3f2a9c1e-0000-4000-8000-000000000001', label: 'tainan-box', online: false, lastSeen: '2026-10-27T13:05:00Z' };
const base: CauseInput = { authRejected: false, online: true, relayAnswered: true, agentOnline: false, box: BOX, seal: 'connecting' };

describe('connectionCause', () => {
  it('login refused wins over everything', () => {
    expect(connectionCause({ ...base, authRejected: true, relayAnswered: false })).toBe('login-refused');
  });
  it('no relay answer: network down vs relay down', () => {
    expect(connectionCause({ ...base, relayAnswered: false })).toBe('relay-unreachable');
    expect(connectionCause({ ...base, relayAnswered: false, online: false })).toBe('no-internet');
  });
  it('relay answered and the box is offline', () => {
    expect(connectionCause(base)).toBe('box-offline');
    expect(connectionCause({ ...base, box: null })).toBe('box-offline');
  });
  it('relay answered, box online, no sealed channel', () => {
    expect(connectionCause({ ...base, box: { ...BOX, online: true } })).toBe('handshake-silent');
    expect(connectionCause({ ...base, box: null, agentOnline: true })).toBe('handshake-silent');
  });
});

describe('selectedBox', () => {
  const other = { ...BOX, id: '3f2a9c1e-0000-4000-8000-000000000002', label: 'old', lastSeen: '2026-10-01T00:00:00Z' };
  it('uses the saved box, else the only box, else the last seen when all are offline', () => {
    expect(selectedBox({ pref: other.id, frame: { t: 'boxes', box: null, primary: null, boxes: [BOX, other] } })).toBe(other);
    expect(selectedBox({ pref: null, frame: { t: 'boxes', box: null, primary: null, boxes: [BOX] } })).toBe(BOX);
    expect(selectedBox({ pref: null, frame: { t: 'boxes', box: null, primary: null, boxes: [other, BOX] } })).toBe(BOX);
    expect(selectedBox({ pref: null, frame: null })).toBeNull();
  });
});

describe('formatSince', () => {
  const now = new Date(2026, 9, 28, 15, 0);
  it('says today, yesterday or the date, in local time', () => {
    expect(formatSince(new Date(2026, 9, 28, 9, 7).toISOString(), now)).toBe('hoje às 09:07');
    expect(formatSince(new Date(2026, 9, 27, 22, 10).toISOString(), now)).toBe('ontem às 22:10');
    expect(formatSince(new Date(2026, 9, 20, 8, 0).toISOString(), now)).toBe('20/10 às 08:00');
    expect(formatSince(null, now)).toBeNull();
  });
});

describe('causeMessage', () => {
  it('names the box and since when for an offline box, with the agent commands', () => {
    const m = causeMessage('box-offline', { box: { ...BOX, lastSeen: new Date(2026, 9, 27, 10, 0).toISOString() }, host: 'relay.x', now: new Date(2026, 9, 28, 12, 0) });
    expect(m.title).toBe('A máquina tainan-box está offline');
    expect(m.body).toBe('Sem sinal dela desde ontem às 10:00.');
    expect(m.commands).toBe(true);
  });
  it('gives one next step per cause and never the old vague text', () => {
    for (const c of ['login-refused', 'no-internet', 'relay-unreachable', 'box-offline', 'handshake-silent'] as const) {
      const m = causeMessage(c, { box: BOX, host: 'relay.x' });
      expect(m.step.length).toBeGreaterThan(0);
      expect(m.title).not.toMatch(/Backend não acessível/);
    }
    expect(causeMessage('relay-unreachable', { box: null, host: 'relay.x' }).body).toContain('relay.x');
  });
});
