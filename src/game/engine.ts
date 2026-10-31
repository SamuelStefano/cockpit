import type { GameEvent, GameState, Reward } from './types';
import { ACHIEVEMENTS } from './achievements';
import { questsForDay, QUEST_BONUS_XP } from './quests';
import { isProgrammersDay } from './eggs';

export const XP = { turnDone: 25, turnError: 2, message: 3, session: 5, route: 3, fish: 2, rareFish: 20, egg: 40, achievement: 25, programmersDay: 100, prMerged: 60, taskDone: 40 } as const;
// Anti-farming: a merge or a card toggled back and forth pays at most this many times a day.
export const REAL_XP_DAILY_CAP = 5;
export const LIGHT_XP_DAILY_CAP = 20;

const TITLES: { from: number; title: string }[] = [
  { from: 1, title: 'Estagiário de Prompt' },
  { from: 5, title: 'Dev Júnior' },
  { from: 10, title: 'Pleno Confiante' },
  { from: 17, title: 'Sênior de Terminal' },
  { from: 25, title: 'Staff do Caos' },
  { from: 35, title: 'Arquiteto de Agentes' },
  { from: 50, title: 'Lenda do Deck' },
];

export const xpForLevel = (lvl: number): number => (lvl <= 1 ? 0 : Math.round(40 * Math.pow(lvl - 1, 1.7)));

export const titleForLevel = (lvl: number): string => [...TITLES].reverse().find((t) => lvl >= t.from)!.title;

export interface LevelInfo { level: number; title: string; floor: number; next: number; pct: number }

export function level(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= safe) lvl++;
  const floor = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);
  return { level: lvl, title: titleForLevel(lvl), floor, next, pct: Math.min(1, (safe - floor) / (next - floor)) };
}

const pad = (n: number) => String(n).padStart(2, '0');

// The user's LOCAL day: the streak must flip at their midnight, not UTC's.
export const dayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function emptyState(): GameState {
  return {
    v: 1, xp: 0, totals: {}, streak: { current: 0, best: 0, lastDay: '' }, unlocked: {},
    daily: { day: '', progress: {}, done: [], bonus: false, msgXp: 0 },
    eggs: [], routes: [], lastError: false, once: {},
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
function numMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) out[k] = num(x);
  return out;
}
function strMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (typeof x === 'string') out[k] = x;
  return out;
}

// Anything stored (corrupt, older shape, hand-edited) is coerced field by field:
// a bad blob must degrade to "start over", never throw into the app.
export function loadState(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') return emptyState();
  const r = raw as Record<string, unknown>;
  const streak = (r.streak ?? {}) as Record<string, unknown>;
  const daily = (r.daily ?? {}) as Record<string, unknown>;
  return {
    v: 1,
    xp: num(r.xp),
    totals: numMap(r.totals),
    streak: { current: num(streak.current), best: num(streak.best), lastDay: str(streak.lastDay) },
    unlocked: strMap(r.unlocked),
    daily: { day: str(daily.day), progress: numMap(daily.progress), done: strs(daily.done), bonus: daily.bonus === true, msgXp: num(daily.msgXp) },
    eggs: strs(r.eggs),
    routes: strs(r.routes),
    lastError: r.lastError === true,
    once: strMap(r.once),
  };
}

// True the first time `stamp` differs from what is stored for `key` (a day or a
// year), so a once-a-day / once-a-year effect cannot repeat.
export function claimOnce(state: GameState, key: string, stamp: string): { state: GameState; claimed: boolean } {
  if (state.once[key] === stamp) return { state, claimed: false };
  return { state: { ...state, once: { ...state.once, [key]: stamp } }, claimed: true };
}

export function normalizeRoute(route: string): string {
  const path = route.split(/[?#]/)[0];
  if (path.startsWith('/configuracoes')) return '/configuracoes';
  if (path.startsWith('/skills')) return '/skills';
  if (path.startsWith('/c/')) return '/';
  if (path.startsWith('/agentes')) return '/agentes';
  return path || '/';
}

export function applyEvent(prev: GameState, event: GameEvent, now: Date): { state: GameState; rewards: Reward[] } {
  const day = dayKey(now);
  const s: GameState = {
    ...prev,
    totals: { ...prev.totals },
    streak: { ...prev.streak },
    unlocked: { ...prev.unlocked },
    daily: prev.daily.day === day ? { ...prev.daily, progress: { ...prev.daily.progress }, done: [...prev.daily.done] } : { day, progress: {}, done: [], bonus: false, msgXp: 0 },
    eggs: [...prev.eggs],
    routes: [...prev.routes],
    once: { ...prev.once },
  };
  const rewards: Reward[] = [];
  const startLevel = level(s.xp).level;
  const gain = (amount: number, source = event.type) => {
    if (amount <= 0) return;
    s.xp += amount;
    rewards.push({ kind: 'xp', amount, source });
  };
  const light = (amount: number) => {
    const room = Math.max(0, LIGHT_XP_DAILY_CAP - s.daily.msgXp);
    const n = Math.min(amount, room);
    s.daily.msgXp += n;
    gain(n);
  };
  const touchStreak = () => {
    const last = s.streak.lastDay;
    if (last === day) return;
    const gap = last ? daysBetween(last, day) : Infinity;
    if (gap < 0) return;
    s.streak.current = gap === 1 ? s.streak.current + 1 : 1;
    s.streak.lastDay = day;
    s.streak.best = Math.max(s.streak.best, s.streak.current);
    if (s.streak.current >= 2) rewards.push({ kind: 'streak', days: s.streak.current });
  };
  s.totals[event.type] = (s.totals[event.type] ?? 0) + 1;

  switch (event.type) {
    case 'turn_done': {
      touchStreak();
      const dow = now.getDay();
      if (dow === 0 || dow === 6) s.totals.weekend_turns = (s.totals.weekend_turns ?? 0) + 1;
      if (s.lastError) s.totals.comebacks = (s.totals.comebacks ?? 0) + 1;
      s.lastError = false;
      gain(XP.turnDone);
      if (isProgrammersDay(now) && s.once.programmers !== String(now.getFullYear())) {
        s.once.programmers = String(now.getFullYear());
        gain(XP.programmersDay);
      }
      break;
    }
    case 'turn_error':
      s.lastError = true;
      gain(XP.turnError);
      break;
    case 'message_sent':
      touchStreak();
      light(XP.message);
      break;
    case 'session_new':
      light(XP.session);
      break;
    case 'route_visit': {
      const r = normalizeRoute(event.route ?? '/');
      if (!s.routes.includes(r)) { s.routes.push(r); gain(XP.route); }
      break;
    }
    case 'fish_caught':
      s.totals.fish_rare = (s.totals.fish_rare ?? 0) + (event.rare ? 1 : 0);
      light(XP.fish);
      if (event.rare) gain(XP.rareFish);
      break;
    case 'pr_merged':
    case 'task_done': {
      const cap = `cap:${event.type}`;
      const paid = s.daily.progress[cap] ?? 0;
      if (paid >= REAL_XP_DAILY_CAP) break;
      s.daily.progress[cap] = paid + 1;
      gain(event.type === 'pr_merged' ? XP.prMerged : XP.taskDone);
      break;
    }
    case 'egg_found':
      if (event.egg && !s.eggs.includes(event.egg)) { s.eggs.push(event.egg); gain(XP.egg); }
      break;
    default:
      break;
  }

  const quests = questsForDay(day);
  for (const q of quests) {
    if (s.daily.done.includes(q.id)) continue;
    const step = q.step({ event, now });
    if (!step) continue;
    s.daily.progress[q.id] = Math.min(q.goal, (s.daily.progress[q.id] ?? 0) + step);
    if (s.daily.progress[q.id] >= q.goal) {
      s.daily.done.push(q.id);
      rewards.push({ kind: 'quest', id: q.id });
      s.xp += q.xp;
    }
  }
  if (!s.daily.bonus && quests.every((q) => s.daily.done.includes(q.id))) {
    s.daily.bonus = true;
    rewards.push({ kind: 'quest', id: 'bonus', bonus: true });
    s.xp += QUEST_BONUS_XP;
  }

  for (const a of ACHIEVEMENTS) {
    if (s.unlocked[a.id] || !a.test(s, { event, now })) continue;
    s.unlocked[a.id] = day;
    rewards.push({ kind: 'achievement', id: a.id });
    s.xp += XP.achievement;
  }

  const end = level(s.xp);
  if (end.level > startLevel) rewards.push({ kind: 'level', level: end.level, title: end.title });
  return { state: s, rewards };
}
