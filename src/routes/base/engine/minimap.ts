import { BELT } from '../sim-types';
import type { Floor, Point } from '../types';
import { STATE_LOOK } from './monitor';

const S = 1.9;
const OX = 130;
const OY = 40;
const P = (x: number, z: number): [number, number] => [OX + x * S, OY + z * S];
export const minimapWorldX = (px: number) => (px - OX) / S;

export function drawMinimap(c: HTMLCanvasElement, f: Floor, pings: { pos: Point; t: number }[]) {
  const g = c.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, 260, 90);
  g.fillStyle = '#d8c7a6'; g.fillRect(...P(-66, -15), 132 * S, 30 * S);
  g.fillStyle = '#3c3a3f'; g.fillRect(...P(BELT.x0, BELT.z - 1), (BELT.x1 - BELT.x0) * S, 4);
  for (const a of f.agents) { const [x, y] = P(a.x, a.z); g.fillStyle = (STATE_LOOK[a.state] ?? STATE_LOOK.waiting).css; g.fillRect(x - 4, y - 3, 8, 6); }
  for (const cr of f.crates) { const [x, y] = P(cr.x, cr.z); g.fillStyle = cr.star ? '#e2b23c' : cr.held ? '#e5432f' : '#a8744a'; g.fillRect(x - 2, y - 2, 4, 4); }
  for (const p of pings) { const [x, y] = P(p.pos.x, p.pos.z); g.strokeStyle = `rgba(229,67,47,${1 - p.t})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 3 + p.t * 13, 0, 7); g.stroke(); }
}
