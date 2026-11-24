const SIZE = 16;
const DIGITS: Record<string, string[]> = {
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000'],
};

export function badgeGlyph(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? '+' : String(count);
}

// Windows overlay icons are bitmaps, and the main process has no canvas.
export function renderBadge(glyph: string): Buffer {
  const out = Buffer.alloc(SIZE * SIZE * 4);
  const rows = DIGITS[glyph];
  const c = (SIZE - 1) / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if ((x - c) ** 2 + (y - c) ** 2 > 7.8 ** 2) continue;
      const px = x - 5;
      const py = y - 3;
      const col = px >= 0 && px < 6 ? Math.floor(px / 2) : -1;
      const row = py >= 0 && py < 10 ? Math.floor(py / 2) : -1;
      const lit = col >= 0 && row >= 0 && rows[row][col] === '1';
      out[i] = lit ? 255 : 60;
      out[i + 1] = lit ? 255 : 60;
      out[i + 2] = lit ? 255 : 230;
      out[i + 3] = 255;
    }
  }
  return out;
}
