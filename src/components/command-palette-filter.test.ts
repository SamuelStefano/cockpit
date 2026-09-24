import { describe, it, expect } from 'vitest';
import { capSessions, filterCommands, groupByOrder } from './command-palette-filter';

const cmds = [
  { label: 'Ir para Chat', group: 'Navegar' },
  { label: 'Nova sessão', group: 'Ações' },
  { label: 'Modo: Planejar', group: 'Modo' },
  { label: 'Ir para Skills', group: 'Navegar' },
];

describe('filterCommands', () => {
  it('returns everything when the query is blank', () => {
    expect(filterCommands(cmds, '   ')).toEqual(cmds);
  });

  it('matches on label, case-insensitive', () => {
    expect(filterCommands(cmds, 'nova').map((c) => c.label)).toEqual(['Nova sessão']);
  });

  it('matches on group too', () => {
    expect(filterCommands(cmds, 'navegar').map((c) => c.label)).toEqual(['Ir para Chat', 'Ir para Skills']);
  });

  it('returns [] when nothing matches', () => {
    expect(filterCommands(cmds, 'zzz')).toEqual([]);
  });
});

describe('groupByOrder', () => {
  it('groups by group name preserving first-appearance order', () => {
    const out = groupByOrder(cmds);
    expect(out.map((g) => g.name)).toEqual(['Navegar', 'Ações', 'Modo']);
    expect(out[0].items.map((c) => c.label)).toEqual(['Ir para Chat', 'Ir para Skills']);
  });

  it('returns [] for an empty list', () => {
    expect(groupByOrder([])).toEqual([]);
  });
});

describe('capSessions', () => {
  const sessions = Array.from({ length: 150 }, (_, i) => ({ label: `s${i}`, group: 'Sessões' }));
  const other = { label: 'Ir para Chat', group: 'Navegar' };

  it('shows only the recent 40 sessions with no query, keeps other groups', () => {
    const out = capSessions([other, ...sessions], '');
    expect(out.filter((c) => c.group === 'Sessões')).toHaveLength(40);
    expect(out).toContain(other);
  });

  it('lets a query reach sessions past the first 40', () => {
    const hits = filterCommands(sessions, 's120');
    expect(capSessions(hits, 's120').map((c) => c.label)).toEqual(['s120']);
  });
});
