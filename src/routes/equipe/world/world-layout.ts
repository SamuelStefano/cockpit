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

// Seats are given out in the order of the bots, per building. When a project house is
// full the bot goes to the shared Escritório, then to the plaza.
export function assignSpots(npcs: NpcView[]): Map<string, Spot> {
  const out = new Map<string, Spot>();
  const used = new Map<string, number>();
  const take = (b: HouseDef): Spot | null => {
    const i = used.get(b.id) ?? 0;
    const seat = b.seats[i];
    if (!seat) return null;
    used.set(b.id, i + 1);
    const t = seatTile(b, seat);
    return { station: b.id, tile: t, face: seat.face, seated: true };
  };
  const plaza: NpcView[] = [];
  let edgeTiles: Point[] | null = null;
  let edgeUsed = 0;
  const edgeSpot = (): Spot | null => {
    edgeTiles ??= roomEdgeTiles(buildingById('sala'));
    const tile = edgeTiles[edgeUsed];
    if (!tile) return null;
    edgeUsed++;
    return { station: 'sala', tile, face: 'down', seated: false };
  };
  for (const n of npcs) {
    const st = stationOf(n);
    if (st === 'plaza') { plaza.push(n); continue; }
    const spot = take(buildingById(st)) ?? (st !== 'sala' && st !== 'escritorio' ? take(buildingById('escritorio')) : null);
    if (spot) { out.set(n.id, spot); continue; }
    const edge = st === 'sala' ? edgeSpot() : null;
    if (edge) out.set(n.id, edge);
    else plaza.push(n);
  }
  const slots = plazaSlots(plaza.length);
  plaza.forEach((n, i) => out.set(n.id, { station: 'plaza', tile: slots[i]!, face: 'down', seated: false }));
  for (const s of out.values()) if (isBlocked(s.tile.x, s.tile.y)) throw new Error(`blocked spot ${s.tile.x},${s.tile.y}`);
  return out;
}
