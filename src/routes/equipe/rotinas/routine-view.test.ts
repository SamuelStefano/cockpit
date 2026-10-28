import { describe, it, expect } from 'vitest';
import type { Cron, TeamBot } from '../../../../shared/protocol';
import { canToggleOn, dayLabel, failureCard, fmtUntil, historyOf, lastRunState, nameFromPrompt, nextCard, routineSub, stamp, weekCard, whenLabel } from './routine-view';

const brt = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h + 3, mi);
const NOW = brt(2026, 10, 28, 12);
const bot = (id: string, name: string): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0 });
const BOTS = [bot('g', 'Growth'), bot('l', 'Lia')];
const cron = (over: Partial<Cron>): Cron => ({
  id: 'c', name: 'Fechar o dia', prompt: 'resume tudo', schedule: { kind: 'daily', atMinute: 1080, weekdays: [1, 2, 3, 4, 5] }, enabled: true, createdAt: brt(2026, 10, 1, 0), botId: 'g', ...over,
});

describe('labels', () => {
  it('day words in Brasília', () => {
    expect(dayLabel(brt(2026, 10, 28, 9), NOW)).toBe('hoje');
    expect(dayLabel(brt(2026, 10, 27, 18), NOW)).toBe('ontem');
    expect(dayLabel(brt(2026, 10, 29, 9), NOW)).toBe('amanhã');
    expect(dayLabel(brt(2026, 10, 25, 9), NOW)).toBe('dom');
    expect(dayLabel(brt(2026, 11, 3, 9), NOW)).toBe('3 nov');
    expect(stamp(brt(2026, 10, 27, 18), NOW)).toBe('ontem 18:00');
  });
  it('countdown', () => {
    expect(fmtUntil(NOW + 6 * 3_600_000 + 12 * 60_000, NOW)).toBe('em 6 h 12 min');
    expect(fmtUntil(NOW + 5 * 60_000, NOW)).toBe('em 5 min');
    expect(fmtUntil(NOW + 2 * 3_600_000, NOW)).toBe('em 2 h');
    expect(fmtUntil(NOW - 1, NOW)).toBe('agora');
    expect(fmtUntil(NOW + 50 * 3_600_000, NOW)).toBe('em 2 d 2 h');
  });
  it('when in words, capitalised', () => {
    expect(whenLabel(cron({}))).toBe('Todo dia útil às 18h');
  });
  it('last run state', () => {
    expect(lastRunState(cron({}), NOW)).toEqual({ tone: 'muted', text: 'ainda não rodou' });
    expect(lastRunState(cron({ lastRun: brt(2026, 10, 28, 9), lastFire: 'started' }), NOW)).toEqual({ tone: 'ok', text: 'hoje 09:00 · ok' });
    expect(lastRunState(cron({ lastRun: brt(2026, 10, 27, 18), lastFire: 'bot-busy' }), NOW)).toEqual({ tone: 'err', text: 'ontem 18:00 · falhou' });
  });
  it('sub names the agent and what it does', () => {
    expect(routineSub(cron({}), BOTS)).toBe('Growth · resume tudo');
    expect(routineSub(cron({ botId: 'zz' }), BOTS)).toBe('Agente removido · resume tudo');
    expect(routineSub(cron({ botId: undefined }), BOTS)).toBe('Sem agente · resume tudo');
  });
  it('derives a short name from the prompt', () => {
    expect(nameFromPrompt('Revisar o calendário. Depois sugerir posts.')).toBe('Revisar o calendário');
    expect(nameFromPrompt('a'.repeat(30) + ' ' + 'b'.repeat(30))).toMatch(/…$/);
    expect(nameFromPrompt('   ')).toBe('Rotina');
  });
});

describe('summary cards', () => {
  it('next: soonest active routine, today shows the hour only', () => {
    const a = cron({ id: 'a', name: 'Cedo', schedule: { kind: 'daily', atMinute: 13 * 60 } });
    const b = cron({ id: 'b', name: 'Tarde', schedule: { kind: 'daily', atMinute: 18 * 60 } });
    expect(nextCard([b, a], BOTS, NOW)).toEqual({ title: 'Próxima: Cedo · 13:00', sub: 'Growth · em 1 h' });
  });
  it('next ignores paused routines and handles none', () => {
    expect(nextCard([cron({ enabled: false })], BOTS, NOW).title).toBe('Nada agendado');
  });
  it('failures', () => {
    expect(failureCard([cron({})], NOW).title).toBe('Nenhuma falha');
    const f = cron({ lastRun: brt(2026, 10, 27, 18), lastFire: 'bot-busy', retryAt: brt(2026, 10, 28, 19) });
    expect(failureCard([f], NOW)).toEqual({ title: '1 falha ontem', sub: 'Fechar o dia · o agente estava ocupado · tenta de novo hoje 19:00', tone: 'err' });
    expect(failureCard([f, { ...f, id: 'd' }], NOW).title).toBe('2 falhas');
  });
  it('week counts routines that ran in the last 7 days', () => {
    const ok = cron({ id: '1', lastRun: brt(2026, 10, 27, 9), lastFire: 'started' });
    const bad = cron({ id: '2', lastRun: brt(2026, 10, 26, 9), lastFire: 'skipped' });
    const old = cron({ id: '3', lastRun: brt(2026, 10, 1, 9) });
    expect(weekCard([ok, bad, old], NOW).sub).toBe('2 rotinas rodaram · 1 ok');
    expect(weekCard([], NOW).sub).toBe('Nenhuma execução ainda');
  });
});

describe('history and toggles', () => {
  it('newest first, failure explained', () => {
    const a = cron({ id: 'a', name: 'A', lastRun: brt(2026, 10, 28, 9), lastFire: 'started' });
    const b = cron({ id: 'b', name: 'B', lastRun: brt(2026, 10, 27, 18), lastFire: 'blocked' });
    const h = historyOf([b, a, cron({ id: 'never' })], NOW);
    expect(h.map((x) => x.id)).toEqual(['a', 'b']);
    expect(h[1]).toMatchObject({ when: 'ontem 18:00', failed: true, result: { tone: 'err', text: 'falhou · bloqueada até liberar a vaga' } });
  });
  it('a past one-shot cannot be turned back on', () => {
    const past = cron({ enabled: false, schedule: { kind: 'once', atMs: NOW - 1 } });
    expect(canToggleOn(past, NOW)).toBe(false);
    expect(canToggleOn({ ...past, enabled: true }, NOW)).toBe(true);
    expect(canToggleOn({ ...past, schedule: { kind: 'once', atMs: NOW + 1 } }, NOW)).toBe(true);
  });
});
