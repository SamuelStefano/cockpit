import type { BotView } from './team-view';

export interface OrgBranch {
  view: BotView;
  children: OrgBranch[];
}

export function buildOrgTree(views: BotView[]): OrgBranch[] {
  const ids = new Set(views.map((v) => v.bot.id));
  const kids = new Map<string, BotView[]>();
  const roots: BotView[] = [];
  for (const v of views) {
    const p = v.bot.parentId;
    if (p && p !== v.bot.id && ids.has(p)) kids.set(p, [...(kids.get(p) ?? []), v]);
    else roots.push(v);
  }
  const seen = new Set<string>();
  const grow = (v: BotView): OrgBranch => {
    seen.add(v.bot.id);
    return { view: v, children: (kids.get(v.bot.id) ?? []).filter((c) => !seen.has(c.bot.id)).map(grow) };
  };
  const tree = roots.map(grow);
  for (const v of views) if (!seen.has(v.bot.id)) tree.push(grow(v));
  return tree;
}

export interface TodayCounts {
  working: number;
  waiting: number;
  costUsd?: number;
}

export function todayCounts(views: BotView[], series?: { day: number; cost: number }[], now = Date.now()): TodayCounts {
  const working = views.filter((v) => v.state === 'thinking' || v.state === 'working').length;
  const waiting = views.filter((v) => v.state === 'waiting' || !!v.pending).length;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const today = series?.find((d) => d.day === start.getTime());
  return { working, waiting, costUsd: today?.cost };
}
