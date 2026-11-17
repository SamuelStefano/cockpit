import { describe, it, expect } from 'vitest';
import { assignSpots, roomEdgeTiles } from './world-layout';
import { buildingById, seatTile } from './world-map';
import type { NpcView } from './world-state';

const npc = (id: string, over: Partial<NpcView> = {}): NpcView => ({ id, name: id, mode: 'idle', badge: null, project: 'escritorio', meeting: false, ...over });

describe('assignSpots', () => {
  it('keeps idle bots on distinct plaza tiles', () => {
    const spots = assignSpots(Array.from({ length: 11 }, (_, i) => npc(`b${i}`)));
    const tiles = [...spots.values()].map((s) => `${s.tile.x},${s.tile.y}`);
    expect(new Set(tiles).size).toBe(11);
    expect([...spots.values()].every((s) => s.station === 'plaza' && !s.seated)).toBe(true);
  });

  it('seats a working bot at a desk of its project', () => {
    const spots = assignSpots([npc('t', { mode: 'working', project: 'itera' }), npc('d', { mode: 'working', project: 'dfl' }), npc('i')]);
    const itera = buildingById('itera');
    expect(spots.get('t')).toMatchObject({ station: 'itera', seated: true, tile: seatTile(itera, itera.seats[0]!) });
    expect(spots.get('d')?.station).toBe('dfl');
    expect(spots.get('i')?.station).toBe('plaza');
  });

  it('overflows a full house to the shared office, then to the plaza', () => {
    const bots = Array.from({ length: 9 }, (_, i) => npc(`w${i}`, { mode: 'working', project: 'corte-radar' }));
    const stations = assignSpots(bots);
    const count = (s: string) => [...stations.values()].filter((x) => x.station === s).length;
    expect(count('corte-radar')).toBe(4);
    expect(count('escritorio')).toBe(4);
    expect(count('plaza')).toBe(1);
  });

  it('sends meeting participants to the meeting room, whatever they were doing', () => {
    const spots = assignSpots([npc('a', { meeting: true }), npc('b', { meeting: true, mode: 'working', project: 'dfl' }), npc('c')]);
    expect(spots.get('a')?.station).toBe('sala');
    expect(spots.get('b')?.station).toBe('sala');
    expect(spots.get('c')?.station).toBe('plaza');
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
