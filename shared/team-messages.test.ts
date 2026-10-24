import { describe, it, expect } from 'vitest';
import { judgeTeamMessage, groupTeamTraffic, teamPrompt, teamPromptSender, trafficLine, coerceTeamMessage, MAX_TEAM_HOPS, MAX_TEAM_MSGS_PER_HOUR, type TeamMessage } from './team-messages';

const msg = (id: string, from: string, to: string, ts: number): TeamMessage => ({ id, from, to, text: id, ts, status: 'delivered', hop: 1 });

describe('judgeTeamMessage', () => {
  const ok = { paused: false, hop: 1, sentLastHour: 0 };
  it('lets a normal message through', () => {
    expect(judgeTeamMessage(ok)).toEqual({ ok: true });
  });
  it('cuts the chain at hop 6', () => {
    expect(judgeTeamMessage({ ...ok, hop: MAX_TEAM_HOPS - 1 }).ok).toBe(true);
    expect(judgeTeamMessage({ ...ok, hop: MAX_TEAM_HOPS })).toEqual({ ok: false, reason: expect.stringMatching(/cadeia/) });
  });
  it('caps a sender per hour', () => {
    expect(judgeTeamMessage({ ...ok, sentLastHour: MAX_TEAM_MSGS_PER_HOUR - 1 }).ok).toBe(true);
    expect(judgeTeamMessage({ ...ok, sentLastHour: MAX_TEAM_MSGS_PER_HOUR })).toEqual({ ok: false, reason: expect.stringMatching(/por hora/) });
  });
  it('blocks everything while the team is paused', () => {
    expect(judgeTeamMessage({ ...ok, paused: true })).toEqual({ ok: false, reason: 'equipe pausada' });
  });
});

describe('team prompt', () => {
  it('round-trips the sender name', () => {
    expect(teamPromptSender(teamPrompt('growth-lead', 'oi\nlinha 2'))).toBe('growth-lead');
    expect(teamPromptSender('[Mensagem de x] sem quebra')).toBeUndefined();
    expect(teamPromptSender('oi')).toBeUndefined();
  });
});

describe('groupTeamTraffic', () => {
  it('groups the runs that fall between the same two thread messages', () => {
    const log = [msg('a', 'lead', 'ativ', 110), msg('b', 'aqui', 'lead', 120), msg('c', 'lead', 'conv', 210), msg('x', 'ativ', 'aqui', 115)];
    const groups = groupTeamTraffic('lead', log, [100, 200, 300]);
    expect(groups.map((g) => g.items.map((m) => m.id))).toEqual([['a', 'b'], ['c']]);
    expect(groups[0]).toMatchObject({ key: 'a', ts: 110, peers: ['ativ', 'aqui'] });
    expect(groups[1].peers).toEqual(['conv']);
  });

  it('keeps one group when the thread has no messages', () => {
    const groups = groupTeamTraffic('lead', [msg('b', 'x', 'lead', 2), msg('a', 'lead', 'x', 1)], []);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((m) => m.id)).toEqual(['a', 'b']);
    expect(groups[0].peers).toEqual(['x']);
  });

  it('splits around a thread message even when the peer repeats', () => {
    const groups = groupTeamTraffic('lead', [msg('a', 'lead', 'x', 1), msg('b', 'lead', 'x', 3)], [2]);
    expect(groups).toHaveLength(2);
  });
});

describe('trafficLine', () => {
  const name = (id: string) => id.toUpperCase();
  it('speaks from the bot point of view', () => {
    expect(trafficLine('a', msg('1', 'a', 'b', 1), name)).toBe('Mandou para B: 1');
    expect(trafficLine('b', msg('1', 'a', 'b', 1), name)).toBe('Mensagem de A: 1');
  });
});

describe('coerceTeamMessage', () => {
  it('drops malformed lines', () => {
    expect(coerceTeamMessage({ id: 'm1', from: 'a', to: 'b', text: 'x', ts: 1, hop: 1, status: 'nope' })).toBeNull();
    expect(coerceTeamMessage({ id: 'm1', from: 'a', to: 'b', text: 'x', ts: 1, hop: 1, status: 'blocked', reason: 'r' })).toMatchObject({ reason: 'r' });
  });
});
