import type { Mission } from '../missions';

// Pure layout math for the Mission Room wall. No three.js, no canvas.
export const WALL = { cx: 88, z: -14.55, cols: 6, rows: 2, pitchX: 7, screenW: 6.4, screenH: 3.4, row0Y: 2.8, pitchY: 3.9 };
export const MAX_SLOTS = WALL.cols * WALL.rows;

export type WallEntry =
  | { key: string; kind: 'mission'; mission: Mission; x: number; y: number; w: number; h: number }
  | { key: string; kind: 'more'; count: number; x: number; y: number; w: number; h: number }
  | { key: string; kind: 'idle'; x: number; y: number; w: number; h: number };

export const MORE_KEY = '__more';
export const IDLE_KEY = '__idle';

// World x/y (wall-local height) of grid slot `i`; slot 0 is the top-left screen.
export function slotCenter(i: number): { x: number; y: number } {
  const col = i % WALL.cols, row = Math.floor(i / WALL.cols);
  return { x: WALL.cx + (col - (WALL.cols - 1) / 2) * WALL.pitchX, y: WALL.row0Y + (WALL.rows - 1 - row) * WALL.pitchY };
}

// Keeps the caller's order so screens do not shuffle; the suggested mission is always pulled into view.
export function pickVisible(missions: Mission[]): { shown: Mission[]; more: number } {
  if (missions.length <= MAX_SLOTS) return { shown: missions, more: 0 };
  const cap = MAX_SLOTS - 1;
  const shown = missions.slice(0, cap);
  const suggested = missions.find((m) => m.suggested);
  if (suggested && !shown.includes(suggested)) shown[cap - 1] = suggested;
  return { shown, more: missions.length - cap };
}

export function layoutWall(missions: Mission[]): WallEntry[] {
  if (!missions.length) {
    const c = slotCenter(0), d = slotCenter(1);
    return [{ key: IDLE_KEY, kind: 'idle', x: (c.x + d.x) / 2, y: WALL.row0Y + WALL.pitchY / 2, w: WALL.pitchX + WALL.screenW, h: WALL.screenH }];
  }
  const { shown, more } = pickVisible(missions);
  const out: WallEntry[] = shown.map((mission, i) => ({ key: mission.id, kind: 'mission', mission, ...slotCenter(i), w: WALL.screenW, h: WALL.screenH }));
  if (more > 0) out.push({ key: MORE_KEY, kind: 'more', count: more, ...slotCenter(shown.length), w: WALL.screenW, h: WALL.screenH });
  return out;
}

// Word wrap capped at `maxLines`; the last line ends in an ellipsis when text is cut.
export function wrapTitle(measure: (s: string) => number, text: string, maxWidth: number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = '';
  const fitChars = (word: string): string => {
    let s = word;
    while (s.length > 1 && measure(s) > maxWidth) s = s.slice(0, -1);
    return s;
  };
  for (let wi = 0; wi < words.length; wi++) {
    const next = line ? `${line} ${words[wi]}` : words[wi];
    if (measure(next) <= maxWidth) { line = next; continue; }
    if (line) {
      lines.push(line);
      line = '';
      wi--;
    } else {
      const head = fitChars(words[wi]);
      lines.push(head);
      const rest = words[wi].slice(head.length);
      if (rest) { words[wi] = rest; wi--; }
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const consumed = lines.join(' ').replace(/\s+/g, '');
  const truncated = consumed.length < words.join('').length || lines.length === maxLines && line !== '' && !lines.includes(line);
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines.slice(0, maxLines);
}
