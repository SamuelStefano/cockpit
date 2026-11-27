export interface PillBox { id: string; x: number; y: number; w: number; h: number; fixed?: boolean }
export interface PillOffset { dx: number; dy: number; slot: number }

const GAP = 1;
const HYSTERESIS = 3;
const ROWS = 16;

const clear = (a: PillBox, b: PillBox, dx: number, dy: number, margin: number): boolean =>
  Math.abs(a.x + dx - b.x) >= (a.w + b.w) / 2 + margin || Math.abs(a.y + dy - b.y) >= (a.h + b.h) / 2 + margin;

// Candidate slots for one box: straight up first, then the same row shifted right/left.
// dy is negative (up). The slot index is stable, so it can be remembered between frames.
export function slotOffset(box: PillBox, slot: number): { dx: number; dy: number } {
  const row = Math.floor(slot / 3);
  const side = slot % 3;
  const shift = box.w + GAP;
  return { dx: side === 0 ? 0 : side === 1 ? shift : -shift, dy: row === 0 ? 0 : -row * (box.h + GAP) };
}

// Boxes are centred on (x, y). Fixed boxes (house and sign labels) never move and are placed
// first; the rest are placed in id order (not screen order, so the order never changes while
// bots walk). Each tries slots from the lowest up and takes the first that clears everything
// placed. `prev` holds last frame's slots: a pill only drops to a lower slot when it clears
// by a few extra pixels, so nothing flickers on the edge of an overlap.
export function nudgePills(boxes: PillBox[], prev: ReadonlyMap<string, number> = new Map()): Map<string, PillOffset> {
  const fixed = boxes.filter((b) => b.fixed);
  const movable = boxes.filter((b) => !b.fixed).sort((a, b) => a.id.localeCompare(b.id));
  const placed: PillBox[] = [...fixed];
  const out = new Map<string, PillOffset>();
  for (const b of fixed) out.set(b.id, { dx: 0, dy: 0, slot: 0 });
  for (const box of movable) {
    const was = prev.get(box.id) ?? 0;
    let chosen = -1;
    for (let s = 0; s < ROWS * 3; s++) {
      const { dx, dy } = slotOffset(box, s);
      const margin = GAP + (s < was ? HYSTERESIS : 0);
      if (placed.every((p) => clear(box, p, dx, dy, margin))) { chosen = s; break; }
    }
    if (chosen < 0) chosen = ROWS * 3 - 1;
    const { dx, dy } = slotOffset(box, chosen);
    out.set(box.id, { dx, dy, slot: chosen });
    placed.push({ ...box, x: box.x + dx, y: box.y + dy });
  }
  return out;
}
