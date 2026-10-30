import { W, H, GROUND, BIT, type RunState } from './runner-physics';

const ORANGE = '#f97316';
const ORANGE_DARK = '#c2410c';
const SCREEN = '#140b05';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawBit(c: CanvasRenderingContext2D, s: RunState, reduced: boolean): void {
  const x = BIT.x;
  const top = GROUND - s.y - BIT.h;
  const step = !reduced && s.y === 0 && !s.over ? Math.floor(s.time * 12) % 2 : 0;
  c.fillStyle = ORANGE_DARK;
  c.fillRect(x + 8, GROUND - s.y - 7 + (step ? -2 : 0), 6, 7);
  c.fillRect(x + BIT.w - 14, GROUND - s.y - 7 + (step ? 0 : -2), 6, 7);
  c.fillStyle = ORANGE;
  roundRect(c, x, top, BIT.w, BIT.h - 6, 9);
  c.fill();
  c.fillStyle = SCREEN;
  roundRect(c, x + 5, top + 6, BIT.w - 10, BIT.h - 18, 5);
  c.fill();
  c.fillStyle = s.over ? '#ef4444' : ORANGE;
  if (s.over) {
    c.font = `bold 10px ${MONO}`;
    c.fillText('x x', x + 9, top + 20);
  } else {
    c.fillRect(x + 11, top + 12, 4, 6);
    c.fillRect(x + BIT.w - 15, top + 12, 4, 6);
  }
  c.strokeStyle = ORANGE_DARK;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x + BIT.w / 2, top);
  c.lineTo(x + BIT.w / 2, top - 6);
  c.stroke();
  c.fillStyle = '#fdba74';
  c.beginPath();
  c.arc(x + BIT.w / 2, top - 8, 2.6, 0, Math.PI * 2);
  c.fill();
}

export function drawRun(c: CanvasRenderingContext2D, s: RunState, opts: { reduced: boolean; best: number; hint: string }): void {
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#0a0a0a';
  c.fillRect(0, 0, W, H);
  c.strokeStyle = '#262626';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, GROUND + 1);
  c.lineTo(W, GROUND + 1);
  c.stroke();
  c.fillStyle = '#1f1f1f';
  for (let i = 0; i < 12; i++) c.fillRect(((i * 97 - s.dist * 0.6) % (W + 40) + W + 40) % (W + 40) - 20, GROUND + 10 + (i % 3) * 8, 14, 2);

  c.textBaseline = 'alphabetic';
  for (const t of s.tokens) {
    c.font = '18px sans-serif';
    c.fillText('⚡', t.x, GROUND - t.y);
  }
  for (const o of s.obstacles) {
    if (o.kind === 'bug') {
      c.font = `${o.h}px sans-serif`;
      c.fillText('🐛', o.x - 2, GROUND);
    } else {
      c.fillStyle = '#3f1212';
      c.fillRect(o.x, GROUND - o.h, o.w, o.h);
      c.strokeStyle = '#ef4444';
      c.lineWidth = 1.5;
      c.strokeRect(o.x + 0.5, GROUND - o.h + 0.5, o.w - 1, o.h - 1);
      c.fillStyle = '#fca5a5';
      c.font = `8px ${MONO}`;
      c.fillText('<<<<<<<', o.x + 3, GROUND - o.h + 11);
      c.fillText('merge', o.x + 5, GROUND - o.h + 20);
      c.fillText('conflict', o.x + 3, GROUND - o.h + 28);
    }
  }
  drawBit(c, s, opts.reduced);

  c.fillStyle = '#a3a3a3';
  c.font = `12px ${MONO}`;
  c.textAlign = 'right';
  c.fillText(`HI ${String(opts.best).padStart(5, '0')}  ${String(Math.floor(s.dist / 8) + s.collected * 10).padStart(5, '0')}`, W - 12, 20);
  c.textAlign = 'left';
  if (opts.hint) {
    c.fillStyle = s.over ? '#fca5a5' : '#d4d4d4';
    c.font = `bold 14px ${MONO}`;
    c.textAlign = 'center';
    c.fillText(opts.hint, W / 2, 80);
    c.textAlign = 'left';
  }
}
