import { describe, it, expect } from 'vitest';
import { groupByRecency, WAITING_WINDOW_MS } from './group-by-recency';
import { pruneDismissed } from './useWaitingDismissed';
import type { Session } from '../../data/types';

const DAY = 86_400_000;
const session = (id: string, mtime: number): Session => ({
  id, mtime, title: id, relative: '', snippet: '', hasTerminal: false, active: false,
});

// Boundaries are relative to the start of today, so anchor offsets off "now".
const now = Date.now();
const startOfToday = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
const opts = (extra: Partial<Parameters<typeof groupByRecency>[1]> = {}) => ({ now, pinned: new Set<string>(), ...extra });

describe('groupByRecency', () => {
  it('buckets sessions by mtime and drops empty buckets', () => {
    const groups = groupByRecency(
      [
        session('today', startOfToday + 1000),
        session('yest', startOfToday - DAY + 1000),
        session('week', startOfToday - 3 * DAY),
        session('month', startOfToday - 15 * DAY),
        session('old', startOfToday - 90 * DAY),
      ],
      opts(),
    );
    expect(groups.map((g) => g.label)).toEqual(['Hoje', 'Ontem', '7 dias', '30 dias', 'Anteriores']);
    expect(groups.map((g) => g.items.map((s) => s.id))).toEqual([['today'], ['yest'], ['week'], ['month'], ['old']]);
  });

  it('routes running sessions to the top bucket regardless of mtime', () => {
    const groups = groupByRecency(
      [session('r', startOfToday - 90 * DAY)],
      opts({ running: new Set(['r']) }),
    );
    expect(groups).toEqual([{ label: 'Trabalhando agora', items: [session('r', startOfToday - 90 * DAY)] }]);
  });

  it('puts pinned (non-running) sessions in the Fixadas bucket', () => {
    const groups = groupByRecency([session('p', startOfToday + 1000)], opts({ pinned: new Set(['p']) }));
    expect(groups.map((g) => g.label)).toEqual(['Fixadas']);
  });

  it('prefers running over pinned when a session is both', () => {
    const groups = groupByRecency(
      [session('x', startOfToday + 1000)],
      opts({ pinned: new Set(['x']), running: new Set(['x']) }),
    );
    expect(groups.map((g) => g.label)).toEqual(['Trabalhando agora']);
  });

  it('groups waiting sessions right below the running ones, ahead of recency', () => {
    const groups = groupByRecency(
      [
        session('hoje', startOfToday + 1000),
        { ...session('perguntou', now - 3600_000), waiting: true },
        session('rodando', startOfToday + 2000),
      ],
      opts({ running: new Set(['rodando']) }),
    );
    expect(groups.map((g) => g.label)).toEqual(['Trabalhando agora', 'Aguardando você', 'Hoje']);
    expect(groups[1].items.map((s) => s.id)).toEqual(['perguntou']);
  });

  it('prefers running over waiting when the session went back to work', () => {
    const groups = groupByRecency(
      [{ ...session('x', startOfToday + 1000), waiting: true }],
      opts({ running: new Set(['x']) }),
    );
    expect(groups.map((g) => g.label)).toEqual(['Trabalhando agora']);
  });

  it('prefers waiting over pinned', () => {
    const groups = groupByRecency(
      [{ ...session('p', startOfToday + 1000), waiting: true }],
      opts({ pinned: new Set(['p']) }),
    );
    expect(groups.map((g) => g.label)).toEqual(['Aguardando você']);
  });

  it('mantém a pergunta na fila enquanto está dentro das 48h', () => {
    const groups = groupByRecency(
      [{ ...session('recente', now - WAITING_WINDOW_MS + 60_000), waiting: true }],
      opts(),
    );
    expect(groups.map((g) => g.label)).toEqual(['Aguardando você']);
  });

  it('devolve a pergunta velha (>48h) ao balde cronológico', () => {
    const groups = groupByRecency(
      [{ ...session('velha', now - WAITING_WINDOW_MS - 60_000), waiting: true }],
      opts(),
    );
    expect(groups.map((g) => g.label)).toEqual(['7 dias']);
    expect(groups[0].items.map((s) => s.id)).toEqual(['velha']);
  });

  it('pergunta velha fixada volta a cair em Fixadas', () => {
    const groups = groupByRecency(
      [{ ...session('velha', now - 10 * DAY), waiting: true }],
      opts({ pinned: new Set(['velha']) }),
    );
    expect(groups.map((g) => g.label)).toEqual(['Fixadas']);
  });

  it('não agrupa a pergunta que o usuário mandou ignorar', () => {
    const groups = groupByRecency(
      [{ ...session('ignorada', now - 3600_000), waiting: true }],
      opts({ dismissed: new Set(['ignorada']) }),
    );
    expect(groups.map((g) => g.label)).toEqual(['Hoje']);
  });

  it('pergunta nova desfaz a dispensa e volta a agrupar', () => {
    const nova = { ...session('ignorada', now - 60_000), waiting: true };
    const map = pruneDismissed({ ignorada: now - 3 * DAY }, [nova]);
    const groups = groupByRecency([nova], opts({ dismissed: new Set(Object.keys(map)) }));
    expect(groups.map((g) => g.label)).toEqual(['Aguardando você']);
  });

  it('returns an empty array when there are no sessions', () => {
    expect(groupByRecency([], opts())).toEqual([]);
  });
});
