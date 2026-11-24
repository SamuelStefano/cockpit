import type { Session } from '../../../data/types';

export const RAIL_MAX = 8;

// Collapsed rail: chats working right now first, then the most recent, capped to fit.
// The active chat is always kept so the open conversation never vanishes from the rail.
export function railChats(sessions: Session[], running: Set<string> | undefined, activeId: string, max = RAIL_MAX): Session[] {
  const busy = (s: Session) => !!running?.has(s.id);
  const sorted = [...sessions].sort((a, b) => Number(busy(b)) - Number(busy(a)) || b.mtime - a.mtime);
  const top = sorted.slice(0, max);
  if (top.some((s) => s.id === activeId)) return top;
  const active = sorted.find((s) => s.id === activeId);
  return active ? [...top.slice(0, max - 1), active] : top;
}

const HUES = [
  'bg-orange-500/20 text-orange-300', 'bg-sky-500/20 text-sky-300', 'bg-violet-500/20 text-violet-300',
  'bg-emerald-500/20 text-emerald-300', 'bg-pink-500/20 text-pink-300', 'bg-amber-500/20 text-amber-300',
];

export function railTint(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function railInitial(title: string): string {
  const m = title.trim().match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '·';
}
