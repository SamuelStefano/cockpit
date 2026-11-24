export type MergedCounts = Record<string, number>;

// Ids whose merged count went up since the previous snapshot. The first snapshot only seeds the baseline.
export function mergedDiff(prev: MergedCounts | null | undefined, next: MergedCounts | null | undefined): string[] {
  if (!prev || !next) return [];
  return Object.keys(next).filter((id) => (next[id] ?? 0) > (prev[id] ?? 0));
}
