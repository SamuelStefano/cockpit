import { describe, it, expect } from 'vitest';
import { assignSpots, roomEdgeTiles } from './world-layout';
import { buildingById, seatTile } from './world-map';
import type { NpcView } from './world-state';

const npc = (id: string, over: Partial<NpcView> = {}): NpcView => ({ id, name: id, mode: 'idle', badge: null, home: 'escritorio', onBreak: false, meeting: false, ...over });

describe('assignSpots', () => {
  it('keeps idle bots at their home desks, never on the plaza', () => {
    const spots = assignSpots([npc('t', { home: 'itera' }), npc('d', { home: 'dfl' }), npc('i')]);
    const itera = buildingById('itera');
    expect(spots.get('t')).toMatchObject({ station: 'itera', seated: true, tile: seatTile(itera, itera.seats[0]!) });
    expect(spots.get('d')?.station).toBe('dfl');
    expect(spots.get('i')?.station).toBe('escritorio');
  });

  it('puts a bot on a break on distinct plaza tiles', () => {
    const spots = assignSpots(Array.from({ length: 6 }, (_, i) => npc(`b${i}`, { onBreak: true })));
    const tiles = [...spots.values()].map((s) => `${s.tile.x},${s.tile.y}`);
    expect(new Set(tiles).size).toBe(6);
    expect([...spots.values()].every((s) => s.station === 'plaza' && !s.seated)).toBe(true);
  });

  it('stands the overflow of a full house inside the same house, never on the plaza', () => {
    const deck = buildingById('deck');
    const bots = Array.from({ length: 4 }, (_, i) => npc(`d${i}`, { home: 'deck' }));
    const spots = [...assignSpots(bots).values()];
    expect(spots.every((s) => s.station === 'deck')).toBe(true);
    expect(spots.filter((s) => s.seated).length).toBe(deck.seats.length);
    expect(new Set(spots.map((s) => `${s.tile.x},${s.tile.y}`)).size).toBe(4);
    for (const s of spots.filter((x) => !x.seated)) {
      expect(s.tile.x > deck.x && s.tile.x < deck.x + deck.w - 1 && s.tile.y > deck.y && s.tile.y < deck.y + deck.h - 1).toBe(true);
    }
  });

  it('sends meeting participants to the meeting room, whatever they were doing', () => {
    const spots = assignSpots([npc('a', { meeting: true }), npc('b', { meeting: true, home: 'dfl' }), npc('c')]);
    expect(spots.get('a')?.station).toBe('sala');
    expect(spots.get('b')?.station).toBe('sala');
    expect(spots.get('c')?.station).toBe('escritorio');
  });
});

describe('meeting overflow', () => {
  it('seats up to the chairs and stands the rest at the room edge, never overlapping', () => {
    const sala = buildingById('sala');
    const ids = Array.from({ length: sala.seats.length + 3 }, (_, i) => `m${i}`);
    const spots = assignSpots(ids.map((id) => npc(id, { meeting: true })));
    const all = ids.map((id) => spots.get(id)!);
    expect(all.every((s) => s.station === 'sala')).toBe(true);
    expect(all.filter((s) => s.seated).length).toBe(sala.seats.length);
    expect(new Set(all.map((s) => `${s.tile.x},${s.tile.y}`)).size).toBe(ids.length);
    for (const s of all.filter((x) => !x.seated)) {
      expect(s.tile.x > sala.x && s.tile.x < sala.x + sala.w - 1 && s.tile.y > sala.y && s.tile.y < sala.y + sala.h - 1).toBe(true);
    }
  });
});

describe('roomEdgeTiles', () => {
  it('skips seats and door fronts', () => {
    const sala = buildingById('sala');
    const tiles = roomEdgeTiles(sala);
    const seats = new Set(sala.seats.map((s) => `${sala.x + s.x},${sala.y + s.y}`));
    expect(tiles.some((t) => seats.has(`${t.x},${t.y}`))).toBe(false);
    for (const d of sala.doors) expect(tiles.some((t) => Math.abs(t.x - (d.x + 1)) <= 1 && Math.abs(t.y - d.y) <= 1)).toBe(false);
  });
});

describe('meeting moderator', () => {
  const sala = buildingById('sala');
  const seat0 = seatTile(sala, sala.seats[0]!);
  const seat1 = seatTile(sala, sala.seats[1]!);

  it('seats the moderator at seat 0 whatever the bot order', () => {
    const spots = assignSpots([npc('a', { meeting: true }), npc('b', { meeting: true }), npc('m', { meeting: true, moderator: true })]);
    expect(spots.get('m')?.tile).toEqual(seat0);
    expect(spots.get('a')?.tile).toEqual(seat1);
  });

  it('keeps the bot order without a moderator', () => {
    const spots = assignSpots([npc('a', { meeting: true }), npc('b', { meeting: true })]);
    expect(spots.get('a')?.tile).toEqual(seat0);
    expect(spots.get('b')?.tile).toEqual(seat1);
  });

  it('ignores a moderator who is not in the room', () => {
    const spots = assignSpots([npc('a', { meeting: true }), npc('m', { moderator: true })]);
    expect(spots.get('a')?.tile).toEqual(seat0);
    expect(spots.get('m')?.station).toBe('escritorio');
  });
});
