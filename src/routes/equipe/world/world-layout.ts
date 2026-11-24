import { buildingById, isBlocked, plazaSlots, seatTile, type Face, type HouseDef, type Point } from './world-map';
import { stationOf, type NpcView, type Station } from './world-state';

export interface Spot { station: Station; tile: Point; face: Face; seated: boolean }

const doorInside = (h: HouseDef, d: Point): Point => (h.door === 'east' ? { x: d.x - 1, y: d.y } : h.door === 'west' ? { x: d.x + 1, y: d.y } : { x: d.x, y: d.y - 1 });

// Free floor of a room, wall-side first, never on a seat or within one tile of a door.
export function roomEdgeTiles(h: HouseDef, blocked: (x: number, y: number) => boolean = isBlocked): Point[] {
  const seats = new Set(h.seats.map((s) => `${h.x + s.x},${h.y + s.y}`));
  const doors = h.doors.map((d) => doorInside(h, d));
  const out: { p: Point; edge: number }[] = [];
  for (let y = h.y + 1; y < h.y + h.h - 1; y++) {
    for (let x = h.x + 1; x < h.x + h.w - 1; x++) {
      if (blocked(x, y) || seats.has(`${x},${y}`)) continue;
      if (doors.some((d) => Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 1)) continue;
      out.push({ p: { x, y }, edge: Math.min(x - h.x, h.x + h.w - 1 - x, y - h.y, h.y + h.h - 1 - y) });
    }
  }
  return out.sort((a, b) => a.edge - b.edge || a.p.y - b.p.y || a.p.x - b.p.x).map((o) => o.p);
}

// Seats are given out in the order of the bots, per building. A bot whose building has no
// free desk stands on a free tile inside the same building; only a building with no free
// tile at all sends it to the plaza.
export function assignSpots(npcs: NpcView[]): Map<string, Spot> {
  const out = new Map<string, Spot>();
  const used = new Map<string, Set<number>>();
  // The preferred desk when it exists and is free, else the lowest free one.
  const take = (b: HouseDef, want?: number): Spot | null => {
    let taken = used.get(b.id);
    if (!taken) { taken = new Set(); used.set(b.id, taken); }
    let i = want !== undefined && want < b.seats.length && !taken.has(want) ? want : -1;
    if (i < 0) { i = 0; while (taken.has(i)) i++; }
    const seat = b.seats[i];
    if (!seat) return null;
    taken.add(i);
    const t = seatTile(b, seat);
    return { station: b.id, tile: t, face: seat.face, seated: true };
  };
  const plaza: NpcView[] = [];
  const edges = new Map<string, { tiles: Point[]; used: number }>();
  const edgeSpot = (b: HouseDef): Spot | null => {
    let e = edges.get(b.id);
    if (!e) { e = { tiles: roomEdgeTiles(b), used: 0 }; edges.set(b.id, e); }
    const tile = e.tiles[e.used];
    if (!tile) return null;
    e.used++;
    return { station: b.id, tile, face: 'down', seated: false };
  };
  const ordered = [...npcs.filter((n) => n.moderator && n.meeting), ...npcs.filter((n) => !(n.moderator && n.meeting))];
  // Bots with a preferred desk claim it first, so a bot without one never takes it.
  const stations = new Map(ordered.map((n) => [n.id, stationOf(n)]));
  for (const n of ordered) {
    const st = stations.get(n.id)!;
    if (st === 'plaza' || st !== n.home || n.homeSeat === undefined) continue;
    const spot = take(buildingById(st), n.homeSeat);
    if (spot) out.set(n.id, spot);
  }
  for (const n of ordered) {
    if (out.has(n.id)) continue;
    const st = stations.get(n.id)!;
    if (st === 'plaza') { plaza.push(n); continue; }
    const b = buildingById(st);
    const spot = take(b) ?? edgeSpot(b);
    if (spot) out.set(n.id, spot);
    else plaza.push(n);
  }
  const slots = plazaSlots(plaza.length);
  plaza.forEach((n, i) => out.set(n.id, { station: 'plaza', tile: slots[i]!, face: 'down', seated: false }));
  for (const s of out.values()) if (isBlocked(s.tile.x, s.tile.y)) throw new Error(`blocked spot ${s.tile.x},${s.tile.y}`);
  return out;
}
