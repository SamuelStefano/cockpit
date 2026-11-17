import { useEffect, useRef, useState } from 'react';
import { mergedDiff, type MergedCounts } from './world-celebrate';

const NONE: string[] = [];

// Ids whose merged count rose since the last snapshot. The array identity changes only on a new celebration.
export function useCelebrate(merged: MergedCounts | undefined): string[] {
  const prev = useRef<MergedCounts | undefined>(undefined);
  const [ids, setIds] = useState<string[]>(NONE);
  useEffect(() => {
    if (!merged) return;
    const diff = mergedDiff(prev.current, merged);
    prev.current = merged;
    if (diff.length > 0) setIds(diff);
  }, [merged]);
  return ids;
}
