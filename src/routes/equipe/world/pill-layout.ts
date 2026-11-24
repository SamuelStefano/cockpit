export interface PillBox { id: string; x: number; y: number; w: number; h: number }

const GAP = 1;
const MAX_STEPS = 8;

const overlaps = (a: PillBox, b: PillBox, dy: number): boolean =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + GAP && Math.abs(a.y - dy - b.y) < (a.h + b.h) / 2 + GAP;

// Boxes are centred on (x, y). Each box is lifted one pill height at a time until it
// no longer touches the boxes already placed. Input order decides who stays put (the
// order is deterministic: left to right, then top to bottom), so the result is stable.
export function nudgePills(boxes: PillBox[]): Map<string, number> {
  const order = [...boxes].sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
  const placed: PillBox[] = [];
  const out = new Map<string, number>();
  for (const box of order) {
    let lift = 0;
    for (let i = 0; i < MAX_STEPS && placed.some((p) => overlaps(box, p, lift)); i++) lift += box.h + GAP;
    out.set(box.id, lift);
    placed.push({ ...box, y: box.y - lift });
  }
  return out;
}
