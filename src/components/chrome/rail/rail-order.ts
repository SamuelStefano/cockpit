import type { BotView } from '../../../routes/equipe/team-view';
import type { AvatarStatus, AvatarTone } from '../../primitives/Avatar';
import type { NavRole } from '../nav-routes';
import { navFor } from '../nav-routes';
import type { Route } from '../../../useRoute';

export const RAIL_MAX_AGENTS = 7;

const TONES: readonly AvatarTone[] = ['orange', 'blue', 'pink', 'green', 'yellow', 'purple', 'cyan'];

export function railTone(id: string): AvatarTone {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function railStatus(v: BotView): AvatarStatus | undefined {
  if (v.state === 'error') return 'err';
  if (v.pending || v.state === 'waiting') return 'warn';
  if (v.state === 'thinking' || v.state === 'working') return 'ok';
  if (v.unread) return 'info';
  return undefined;
}

const isLive = (v: BotView) => v.state === 'thinking' || v.state === 'working' || v.state === 'waiting' || !!v.pending || v.unread;

// Working or waiting agents first, then the rest by their last activity; the selected
// agent always keeps a seat so its pip never hides behind "+N", and a shown sub-agent
// always has its chief right before it.
export function railAgents(views: BotView[], selectedId: string | null, max = RAIL_MAX_AGENTS): { shown: BotView[]; hidden: number } {
  const recent = (v: BotView) => v.endedAt ?? v.startedAt ?? 0;
  const sorted = [...views].sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || recent(b) - recent(a));
  const shown = sorted.slice(0, max);
  const selected = selectedId ? sorted.find((v) => v.bot.id === selectedId) : undefined;
  if (selected && !shown.includes(selected) && shown.length > 0) shown[shown.length - 1] = selected;
  const byId = new Map(views.map((v) => [v.bot.id, v]));
  for (const child of [...shown]) {
    const parent = child.bot.parentId ? byId.get(child.bot.parentId) : undefined;
    if (!parent || shown.includes(parent)) continue;
    const family = (v: BotView) => v === child || v === selected || v.bot.parentId === parent.bot.id || shown.some((c) => c.bot.parentId === v.bot.id);
    const seat = shown.map(family).lastIndexOf(false);
    if (seat >= 0) shown[seat] = parent;
  }
  const ordered: BotView[] = [];
  const place = (v: BotView) => {
    if (ordered.includes(v)) return;
    ordered.push(v);
    for (const c of shown) if (c.bot.parentId === v.bot.id) place(c);
  };
  for (const v of shown) if (!(v.bot.parentId && shown.some((p) => p.bot.id === v.bot.parentId))) place(v);
  for (const v of shown) place(v);
  shown.splice(0, shown.length, ...ordered);
  return { shown, hidden: views.length - shown.length };
}

const WORK_ROUTES: readonly Route[] = ['/canvas', '/prs', '/pontos'];

export function workRoute(role: NavRole): Route | null {
  const allowed = new Set(navFor(role).map((n) => n.to));
  return WORK_ROUTES.find((r) => allowed.has(r)) ?? null;
}

export const isWorkRoute = (route: Route) => WORK_ROUTES.includes(route);

export function canOpen(role: NavRole, route: Route): boolean {
  return navFor(role).some((n) => n.to === route);
}
