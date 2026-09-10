import { describe, it, expect } from 'vitest';
import { staleSessions, idleLabel } from './stale';
import type { Session } from '../../data/types';

const NOW = Date.parse('2026-09-10T12:00:00Z');
const DAY = 86_400_000;
const s = (id: string, days: number, extra: Partial<Session> = {}): Session => ({
  id, title: id, relative: '', snippet: '', mtime: NOW - days * DAY, hasTerminal: false, active: false, ...extra,
});

const base = { now: NOW, idleDays: 7, pinned: new Set<string>() };

describe('staleSessions', () => {
  it('pega só o que passou do corte, da mais velha pra mais nova', () => {
    const out = staleSessions([s('nova', 1), s('velha', 30), s('media', 10)], base);
    expect(out.map((x) => x.id)).toEqual(['velha', 'media']);
  });

  it('protege favorita, aberta, rodando e aguardando resposta', () => {
    const list = [s('fav', 20), s('aberta', 20), s('rodando', 20), s('esperando', 20, { waiting: true }), s('ok', 20)];
    const out = staleSessions(list, {
      ...base, pinned: new Set(['fav']), activeId: 'aberta', running: new Set(['rodando']),
    });
    expect(out.map((x) => x.id)).toEqual(['ok']);
  });

  it('ignora sessão que ainda nem existe no servidor', () => {
    expect(staleSessions([s('new-123', 30)], base)).toEqual([]);
  });

  it('respeita o teto do lote', () => {
    const list = Array.from({ length: 40 }, (_, i) => s(`s${i}`, 10 + i));
    expect(staleSessions(list, base)).toHaveLength(20);
    expect(staleSessions(list, { ...base, max: 5 })).toHaveLength(5);
  });
});

describe('idleLabel', () => {
  it('vira meses depois de 30 dias', () => {
    expect(idleLabel(NOW - 9 * DAY, NOW)).toBe('9 d');
    expect(idleLabel(NOW - 70 * DAY, NOW)).toBe('2 m');
  });
});
