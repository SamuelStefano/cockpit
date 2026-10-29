import type { Session } from '../data/types';
import { groupByRecency } from '../components/sessions/group-by-recency';

interface SidebarOrderOpts {
  pinned: Set<string>;
  running?: Set<string>;
  dismissed?: Set<string>;
  now?: number;
}

// The sessions in the exact top-to-bottom order the sidebar renders them. `sessions`
// must already be without bot threads (the sidebar hides those).
export function sidebarOrder(sessions: Session[], { pinned, running, dismissed, now = Date.now() }: SidebarOrderOpts): Session[] {
  return groupByRecency(sessions, { now, pinned, running, dismissed }).flatMap((g) => g.items);
}
