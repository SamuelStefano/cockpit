import { useRef } from 'react';
import type { ActivityItem } from '../activity';
import type { FeedView } from '../activityView';

export interface FeedSnapshot { items: ActivityItem[]; view: FeedView }

// While the reader is looking at something (scrolled down, or a row open) the feed they see must not move.
// `fresh` counts what arrived behind the freeze, among the rows the current filter would show.
export function useFrozenFeed(live: FeedSnapshot, held: boolean): { shown: FeedSnapshot; fresh: number } {
  const snap = useRef<FeedSnapshot | null>(null);
  if (!held) snap.current = null;
  else if (!snap.current) snap.current = live;
  const shown = snap.current ?? live;
  if (!snap.current) return { shown, fresh: 0 };
  const known = new Set(snap.current.view.itemIds);
  return { shown, fresh: live.view.itemIds.filter((id) => !known.has(id)).length };
}
