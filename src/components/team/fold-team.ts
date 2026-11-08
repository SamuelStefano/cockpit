import type { TeamEntry } from './team-order';

export interface TeamFold {
  counts: Record<string, number>;
  visible: TeamEntry[];
}

// Entries come in walk order (a lead, then its descendants), so a lead's subtree is
// the run of following entries that are deeper than it.
export function foldTeam(entries: TeamEntry[], open: ReadonlySet<string>): TeamFold {
  const counts: Record<string, number> = {};
  const visible: TeamEntry[] = [];
  let hiddenBelow: number | null = null;
  entries.forEach((e, i) => {
    if (hiddenBelow !== null && e.depth > hiddenBelow) return;
    hiddenBelow = null;
    visible.push(e);
    let n = 0;
    while (entries[i + 1 + n] && entries[i + 1 + n].depth > e.depth) n++;
    if (n === 0) return;
    counts[e.view.bot.id] = n;
    if (!open.has(e.view.bot.id)) hiddenBelow = e.depth;
  });
  return { counts, visible };
}

// Collapsed, the sidebar keeps only the agents worth a glance: the open one, the
// ones working and the ones with an unread reply. Flat, since their leads may be hidden.
export function glanceEntries(entries: TeamEntry[], activeId: string | null): TeamEntry[] {
  return entries
    .filter(({ view }) => view.bot.id === activeId || view.unread || view.state === 'thinking' || view.state === 'working')
    .map((e) => ({ ...e, depth: 0 }));
}
