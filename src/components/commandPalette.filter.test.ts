import { describe, it, expect } from 'vitest';
import { filterCommands, groupByOrder } from './commandPalette.filter';

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
