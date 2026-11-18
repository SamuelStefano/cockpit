import { describe, it, expect } from 'vitest';
import type { TeamBot } from '../../../../shared/protocol';
import type { DepartmentId } from '../../../../shared/departments';
import { buildTeamState } from '../../../../shared/team-state';
import homes from '../../../../scripts/team-homes.json';
import { assignSpots } from './world-layout';
import { deriveWorld } from './world-state';
import { breakPlace, BREAK_AFTER_MS } from './world-break';
import { buildingById } from './world-map';

const MIN = 60_000;
const NOW = 1_800_000_000_000;

// Shaped like the real roster: [name, department, project].
const ROSTER: [string, DepartmentId | undefined, string | undefined][] = [
  ['Íris', 'direction', undefined], ['Otto', 'engineering', undefined], ['Luffy', 'engineering', 'itera'], ['Zoro', 'engineering', 'dfl'],
  ['Raquel', 'engineering', undefined], ['Anderson', 'engineering', 'dfl'], ['Lara', 'engineering', undefined], ['Lorena', 'engineering', undefined],
  ['Arthur', 'growth', undefined], ['Mari', 'growth', undefined], ['Usopp', 'growth', undefined], ['Malu', 'growth', 'itera'],
  ['Robin', 'finance', undefined], ['Bulma', 'finance', 'dfl'], ['Ada', 'operations', undefined], ['Goku', 'engineering', 'deck'],
  ['Nami', 'engineering', 'deck'], ['Naruto', 'growth', undefined], ['Sasuke', 'engineering', undefined], ['Hinata', 'growth', undefined],
  ['Vegeta', 'engineering', 'deck'], ['maria-e2e', undefined, undefined], ['joao-e2e', undefined, undefined],
];

const team = (withHomes: boolean): TeamBot[] => ROSTER.map(([name, department, project]) => ({
  id: name.toLowerCase().replace('í', 'i'), name, label: 'x', instructions: '', mascot: { shape: 'drop', color: '#112233' }, profile: 'full', createdAt: 0, updatedAt: 0,
  ...(department ? { department } : {}), ...(project ? { project } : {}),
  ...(withHomes && (homes as Record<string, string>)[name] ? { home: (homes as Record<string, string>)[name] } : {}),
}));

const world = (withHomes: boolean, idleMs: number) => {
  const now = NOW;
  const state = buildTeamState({
    team: team(withHomes), tasks: [], log: [], running: new Set(), waiting: new Set(),
    lastTurnEnd: new Map(team(withHomes).map((b) => [b.id, NOW - idleMs])), now,
  });
  const view = deriveWorld(state, { now });
  return { view, spots: assignSpots(view.npcs) };
};
const onPlaza = (w: ReturnType<typeof world>): string[] => [...w.spots].filter(([, s]) => s.station === 'plaza').map(([id]) => id);

describe('real roster', () => {
  it('maps every roster name in scripts/team-homes.json', () => {
    expect(Object.keys(homes).sort()).toEqual(ROSTER.map(([n]) => n).filter((n) => !n.endsWith('-e2e')).sort());
  });

  it('keeps every bot off the plaza when all are idle for 5 minutes', () => {
    expect(onPlaza(world(true, 5 * MIN))).toEqual([]);
    expect(onPlaza(world(false, 5 * MIN))).toEqual([]);
  });

  it('keeps working and waiting bots at home too', () => {
    const state = buildTeamState({ team: team(true), tasks: [], log: [], running: new Set(['otto']), waiting: new Set(['lara']), now: NOW });
    const view = deriveWorld(state, { now: NOW + 3 * 60 * MIN });
    const spots = assignSpots(view.npcs);
    expect(spots.get('otto')?.station).toBe('deck');
    expect(spots.get('lara')?.station).toBe('deck');
  });

  it('puts a bot on the plaza only during its stroll window after 30 minutes idle', () => {
    const id = 'zoro';
    const secondsOnPlaza: number[] = [];
    for (let s = 0; s <= 120; s++) {
      const idleMs = BREAK_AFTER_MS + s * 1000;
      const state = buildTeamState({ team: team(true), tasks: [], log: [], running: new Set(), waiting: new Set(), lastTurnEnd: new Map([[id, NOW - idleMs]]), now: NOW });
      if (assignSpots(deriveWorld(state, { now: NOW }).npcs).get(id)?.station === 'plaza') secondsOnPlaza.push(s);
    }
    expect(secondsOnPlaza.length).toBeGreaterThanOrEqual(20);
    expect(secondsOnPlaza.length).toBeLessThanOrEqual(40);
    expect(secondsOnPlaza[secondsOnPlaza.length - 1]! - secondsOnPlaza[0]! + 1).toBe(secondsOnPlaza.length);
    expect(breakPlace(NOW, NOW - 29 * MIN, id)).toBe('desk');
  });

  it('stands the extras of a full house inside it', () => {
    const w = world(true, 5 * MIN);
    const deck = buildingById('deck');
    const inDeck = [...w.spots].filter(([, s]) => s.station === 'deck');
    expect(inDeck.length).toBe(5);
    expect(inDeck.filter(([, s]) => s.seated).length).toBe(deck.seats.length);
    for (const [, s] of inDeck.filter(([, x]) => !x.seated)) {
      expect(s.tile.x > deck.x && s.tile.x < deck.x + deck.w - 1 && s.tile.y > deck.y && s.tile.y < deck.y + deck.h - 1).toBe(true);
    }
  });
});
