export type Eyes = 'open' | 'happy' | 'closed' | 'cross' | 'sad' | 'wide' | 'sneaky';

const EYES: Record<string, Eyes> = { working: 'open', thinking: 'sneaky', blocked: 'wide', silent: 'cross', paused: 'closed', waiting: 'open', finished: 'happy', reviewing: 'sneaky', cheer: 'happy', asleep: 'closed', walking: 'open', nap: 'closed', dance: 'happy', wave: 'happy', stretch: 'closed', look: 'open', sip: 'happy' };
export const eyesFor = (s: string): Eyes => EYES[s] ?? 'open';

// Draws the same eye vocabulary as BitFace: glowing on a dark screen for a Bit, ink on the body for a mascot.
export function paintFace(g: CanvasRenderingContext2D, eyes: Eyes, bit: boolean, look: number, typing: boolean) {
  const S = 128, color = bit ? (eyes === 'sad' || eyes === 'cross' ? '#fca5a5' : '#fed7aa') : '#0b0b0c';
  g.clearRect(0, 0, S, S);
  if (bit) { g.fillStyle = '#140b05'; g.beginPath(); g.roundRect(6, 14, S - 12, S - 28, 22); g.fill(); }
  const cy = 58, gap = bit ? 25 : 30, L = S / 2 - gap + look, R = S / 2 + gap + look;
  g.fillStyle = g.strokeStyle = color; g.lineWidth = 8; g.lineCap = 'round';
  const line = (d: (x: number) => void) => { for (const x of [L, R]) { g.beginPath(); d(x); g.stroke(); } };
  if (eyes === 'happy') line((x) => { g.moveTo(x - 12, cy + 5); g.quadraticCurveTo(x, cy - 14, x + 12, cy + 5); });
  else if (eyes === 'closed') line((x) => { g.moveTo(x - 12, cy); g.quadraticCurveTo(x, cy + 8, x + 12, cy); });
  else if (eyes === 'cross') line((x) => { g.moveTo(x - 9, cy - 9); g.lineTo(x + 9, cy + 9); g.moveTo(x + 9, cy - 9); g.lineTo(x - 9, cy + 9); });
  else if (eyes === 'sneaky') { line((x) => { g.moveTo(x - 12, cy - 6); g.lineTo(x + 12, cy - 6); }); for (const x of [L, R]) { g.beginPath(); g.roundRect(x - 8, cy - 4, 16, 13, 6); g.fill(); } }
  else if (eyes === 'wide') { g.lineWidth = 6; line((x) => { g.arc(x, cy, 13, 0, Math.PI * 2); }); for (const x of [L, R]) { g.beginPath(); g.arc(x, cy, 5, 0, Math.PI * 2); g.fill(); } }
  else for (const x of [L, R]) { g.beginPath(); g.roundRect(x - 9, cy - 13, 18, 26, 9); g.fill(); }
  if (bit && typing) { g.fillStyle = '#fdba74'; g.fillRect(S / 2 - 12, 88, 24, 7); }
}
