import { buildingById, isBlocked, plazaSlots, seatTile, type Face, type HouseDef, type Point } from './world-map';
import { stationOf, type NpcView, type Station } from './world-state';

export interface Spot { station: Station; tile: Point; face: Face; seated: boolean }

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
  for (const n of npcs) {
    const st = stationOf(n);
    if (st === 'plaza') { plaza.push(n); continue; }
    const spot = take(buildingById(st)) ?? (st !== 'sala' && st !== 'escritorio' ? take(buildingById('escritorio')) : null);
    if (spot) out.set(n.id, spot);
    else plaza.push(n);
  }
  const slots = plazaSlots(plaza.length);
  plaza.forEach((n, i) => out.set(n.id, { station: 'plaza', tile: slots[i]!, face: 'down', seated: false }));
  for (const s of out.values()) if (isBlocked(s.tile.x, s.tile.y)) throw new Error(`blocked spot ${s.tile.x},${s.tile.y}`);
  return out;
}
