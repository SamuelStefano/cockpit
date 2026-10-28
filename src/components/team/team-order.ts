import type { BotView } from '../../routes/equipe/team-view';

export interface TeamEntry { view: BotView; depth: number }

// Chief first, then each lead followed by its own workers; orphans keep their order.
export function orderTeam(views: BotView[]): TeamEntry[] {
  const ids = new Set(views.map((v) => v.bot.id));
  const kids = new Map<string, BotView[]>();
  const roots: BotView[] = [];
  for (const v of views) {
    const p = v.bot.parentId;
    if (p && ids.has(p) && p !== v.bot.id) kids.set(p, [...(kids.get(p) ?? []), v]);
    else roots.push(v);
  }
  roots.sort((a, b) => Number(!!b.bot.primary) - Number(!!a.bot.primary));
  const out: TeamEntry[] = [];
  const seen = new Set<string>();
  const walk = (v: BotView, depth: number) => {
    if (seen.has(v.bot.id)) return;
    seen.add(v.bot.id);
    out.push({ view: v, depth });
    for (const k of kids.get(v.bot.id) ?? []) walk(k, depth + 1);
  };
  for (const r of roots) walk(r, 0);
  for (const v of views) walk(v, 0);
  return out;
}

export const waitingCount = (views: BotView[]) => views.filter((v) => !!v.pending).length;
export const workingCount = (views: BotView[]) => views.filter((v) => v.state === 'thinking' || v.state === 'working').length;
