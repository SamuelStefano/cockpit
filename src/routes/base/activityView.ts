import { filterActivity, turnSummaries, type ActivityFilter, type ActivityItem } from './activity';

export interface FileGroup {
  path: string;
  // Successful writes and edits only: a failed attempt is listed but never counted.
  edits: number;
  failed: number;
  // Every attempt, oldest first.
  items: ActivityItem[];
}

export interface FeedView {
  // Newest first. Empty when `groups` is set.
  rows: ActivityItem[];
  groups: FileGroup[] | null;
  turnLabels: Map<number, string>;
  // The oldest shown turn, when the row cap cut some of its rows.
  partialTurn: number | null;
  itemIds: string[];
}

export function groupFiles(items: ActivityItem[]): FileGroup[] {
  const map = new Map<string, { g: FileGroup; last: number }>();
  items.forEach((it, i) => {
    if (it.kind !== 'file') return;
    const path = it.target || '(unnamed)';
    const e = map.get(path) ?? { g: { path, edits: 0, failed: 0, items: [] }, last: i };
    if (it.status === 'error') e.g.failed++; else e.g.edits++;
    e.g.items.push(it);
    e.last = i;
    map.set(path, e);
  });
  return [...map.values()].sort((a, b) => b.last - a.last).map((e) => e.g);
}

export function buildView(items: ActivityItem[], filter: ActivityFilter, failedOnly: boolean, cap: number): FeedView {
  const turnLabels = turnSummaries(items);
  const filtered = filterActivity(items, filter, failedOnly);
  const itemIds = filtered.map((it) => it.id);
  if (filter === 'file' && !failedOnly) return { rows: [], groups: groupFiles(filtered), turnLabels, partialTurn: null, itemIds };
  const shown = filtered.slice(-cap);
  const cut = filtered.length - shown.length;
  const partialTurn = cut > 0 && shown.length && filtered[cut - 1].turn === shown[0].turn ? shown[0].turn : null;
  return { rows: shown.reverse(), groups: null, turnLabels, partialTurn, itemIds };
}
