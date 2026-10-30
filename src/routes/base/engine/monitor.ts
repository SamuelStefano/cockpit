import type { FloorAgent, MonitorData } from '../types';

export const STATE_LOOK: Record<string, { c: number; css: string; icon: string; text: string }> = {
  working: { c: 0x58c26a, css: '#58c26a', icon: '●', text: 'working' },
  thinking: { c: 0xf2c14e, css: '#f2c14e', icon: '◆', text: 'thinking' },
  blocked: { c: 0xe5432f, css: '#ff6a55', icon: '▲', text: 'blocked' },
  silent: { c: 0x8a5cf6, css: '#b79bff', icon: '?', text: 'silent' },
  paused: { c: 0x8d9299, css: '#b5bac0', icon: '❚❚', text: 'paused' },
  waiting: { c: 0x5a5a62, css: '#a7a39a', icon: '○', text: 'idle' },
  reviewing: { c: 0x5aa9e6, css: '#7cc0f2', icon: '◎', text: 'reviewing' },
  asleep: { c: 0x8d6a4a, css: '#d0a877', icon: 'z', text: 'out of quota' },
};

const DIFF: [string, string][] = [['+', 'export function joinRoom(id: string) {'], ['+', '  const room = rooms.get(id)'], ['-', '  // TODO: handle lost messages'], ['+', '  if (!room) throw new RoomNotFound(id)'], ['+', '  await queue.flush(room)'], ['+', '  return room.attach(session)'], ['+', '}'], ['', ''], ['+', "it('keeps pending messages', () => {"], ['+', '  queue.push(msg); restart()'], ['+', '  expect(queue.pending).toContain(msg)'], ['+', '})']];
export const W = 768;
export const H = 480;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function wrapLines(g: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, max: number, limit: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > max && line) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
  }
  return out.slice(-limit);
}

function chrome(g: CanvasRenderingContext2D, left: string, a: FloorAgent) {
  g.textAlign = 'left';
  g.fillStyle = '#17171c'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#26262e'; g.fillRect(0, 0, W, 38);
  g.fillStyle = '#d8d3c7'; g.font = '700 19px monospace'; g.fillText(left.slice(0, 50), 12, 26);
  const st = STATE_LOOK[a.state] ?? STATE_LOOK.waiting;
  g.fillStyle = st.css; g.textAlign = 'right'; g.fillText(st.text.toUpperCase(), W - 12, 26); g.textAlign = 'left';
}

function drawLive(g: CanvasRenderingContext2D, a: FloorAgent, m: Extract<MonitorData, { kind: 'live' }>) {
  chrome(g, m.title, a);
  g.font = '20px monospace';
  if (m.tail) {
    g.fillStyle = '#efeadd';
    wrapLines(g, m.tail, W - 28, 11).forEach((l, i) => g.fillText(l, 14, 70 + i * 28));
  } else { g.fillStyle = '#8d897f'; g.font = '700 26px sans-serif'; g.fillText('Transcript: unknown', 24, 110); }
  g.fillStyle = '#26262e'; g.fillRect(0, H - 76, W, 76);
  g.fillStyle = '#9b978d'; g.font = '700 16px monospace'; g.fillText('NOW', 12, H - 32);
  g.fillStyle = '#efeadd'; g.font = '700 22px sans-serif'; g.fillText(m.now.slice(0, 56), 76, H - 30);
}

function drawPractice(g: CanvasRenderingContext2D, a: FloorAgent, m: Extract<MonitorData, { kind: 'practice' }>, T: number) {
  chrome(g, m.hasJob ? `${m.file}  ·  wt/${m.key}` : 'no active worktree', a);
  const n = m.hasJob ? Math.floor(m.progress * DIFF.length) : 0;
  const diff = (X: number, w: number, max: number) => {
    g.font = '19px monospace';
    DIFF.slice(0, n).forEach(([s, l], i) => {
      const y = 46 + i * 28;
      if (s) { g.fillStyle = s === '+' ? 'rgba(88,194,106,.2)' : 'rgba(229,67,47,.22)'; g.fillRect(X, y, w, 27); }
      g.fillStyle = s === '+' ? '#a9e6b3' : s === '-' ? '#f5a99e' : '#888';
      g.fillText(`${s} ${l}`.slice(0, max), X + 8, y + 20);
    });
  };
  const preview = (X: number, Y: number, PW: number, PH: number) => {
    const q = m.hasJob ? m.progress : 0, sx = PW / 340, sy = PH / 300;
    g.fillStyle = '#f7f1e3'; g.fillRect(X, Y, PW, PH);
    g.fillStyle = '#d9cfba'; g.fillRect(X, Y, PW, 24);
    g.fillStyle = '#555'; g.font = '14px monospace'; g.fillText(`localhost:${m.preview}`, X + 8, Y + 17);
    if (q > 0.1) { g.fillStyle = '#c8603c'; g.fillRect(X + 14, Y + 38, 170 * sx * Math.min(1, q * 2), 20 * sy); }
    if (q > 0.3) { g.fillStyle = '#35343a'; for (let i = 0; i < 3; i++) g.fillRect(X + 14, Y + (72 + i * 22) * sy, PW - 90 - i * 40, 11); }
    if (q > 0.5) { g.fillStyle = '#2f7f79'; g.beginPath(); g.roundRect(X + 14, Y + 150 * sy, 130, 44, 8); g.fill(); g.fillStyle = '#fff'; g.font = '700 17px sans-serif'; g.fillText('Open table', X + 34, Y + 150 * sy + 28); }
    if (q > 0.7) { g.fillStyle = '#e2d7bf'; g.fillRect(X + 14, Y + 208 * sy, PW - 28, 74 * sy); }
  };
  if (m.hasJob && !n && (m.tab === 'split' || m.tab === 'diff')) { g.fillStyle = '#6d6a63'; g.font = '700 22px sans-serif'; g.fillText('Nothing written yet', 24, 90); }
  if (m.tab === 'split') { diff(0, 410, 36); preview(420, 46, 340, 300); }
  if (m.tab === 'diff') diff(0, W, 64);
  if (m.tab === 'preview') preview(8, 44, W - 16, 300);
  if (m.tab === 'terminal') {
    g.font = '19px monospace'; g.fillStyle = '#a9e6b3';
    m.term.forEach((l, i) => g.fillText(l.slice(0, 66), 12, 66 + i * 26));
    if (Math.sin(T * 8) > 0) g.fillRect(12, 60 + m.term.length * 26, 11, 20);
  }
  if (m.tab === 'trace') {
    g.font = '19px monospace';
    m.log.slice(-11).forEach((l, i) => { g.fillStyle = '#9b978d'; g.fillText(fmt(l.t), 12, 66 + i * 26); g.fillStyle = '#efeadd'; g.fillText(l.msg.slice(0, 54), 78, 66 + i * 26); });
  }
  g.fillStyle = '#26262e'; g.fillRect(0, H - 124, W, 124);
  g.fillStyle = '#9b978d'; g.font = '700 16px monospace'; g.fillText('NOW', 12, H - 96); g.fillText('NEXT', 12, H - 50);
  g.fillStyle = '#efeadd'; g.font = '700 22px sans-serif';
  g.fillText(m.now.slice(0, 56), 76, H - 94); g.fillText(m.next.slice(0, 56), 76, H - 48);
  g.fillStyle = '#3a3a44'; g.fillRect(0, H - 8, W, 8);
  g.fillStyle = '#58c26a'; g.fillRect(0, H - 8, W * (m.hasJob ? m.progress : 0), 8);
}

export function drawMonitor(g: CanvasRenderingContext2D, a: FloorAgent, T: number) {
  if (a.monitor.kind === 'live') drawLive(g, a, a.monitor);
  else drawPractice(g, a, a.monitor, T);
}
