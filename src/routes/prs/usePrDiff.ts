import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PrDiffFile } from '../../../shared/prs';
import { filterFiles, OPEN_ROWS_BUDGET, parsePatch, startsCollapsed, type DiffRow } from './diff-parse';
import { getPrsState, requestPrDiff, subscribePrs } from './prs-bus';
import { useViewedFiles } from './useViewedFiles';

export interface DiffFileView { file: PrDiffFile; rows: DiffRow[]; open: boolean; viewed: boolean }

export function usePrDiff(url: string) {
  const entry = useSyncExternalStore(subscribePrs, () => getPrsState().diffs[url], () => undefined);
  const [query, setQuery] = useState('');
  const [wrap, setWrap] = useState(false);
  // Only what the reader flipped by hand; everything else follows the default.
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const viewed = useViewedFiles(url);

  useEffect(() => { requestPrDiff(url); }, [url]);

  const diff = entry?.diff ?? null;
  const parsed = useMemo(() => (diff?.files ?? []).map((file) => ({ file, rows: file.patch ? parsePatch(file.patch) : [] })), [diff]);
  const { isViewed } = viewed;

  const files: DiffFileView[] = useMemo(() => {
    const keep = new Set(filterFiles(parsed.map((p) => p.file), query).map((f) => f.path));
    let budget = OPEN_ROWS_BUDGET;
    return parsed.filter((p) => keep.has(p.file.path)).map(({ file, rows }) => {
      const seen = isViewed(file);
      const byDefault = !(seen || startsCollapsed(file, rows.length)) && budget >= rows.length;
      if (byDefault) budget -= rows.length;
      return { file, rows, viewed: seen, open: manual[file.path] ?? byDefault };
    });
  }, [parsed, query, manual, isViewed]);

  const toggleOpen = useCallback((path: string, open: boolean) => setManual((m) => ({ ...m, [path]: open })), []);
  const setAll = useCallback((open: boolean) => setManual(Object.fromEntries(parsed.map((p) => [p.file.path, open]))), [parsed]);
  const { toggle } = viewed;
  const isViewedRef = useRef(isViewed);
  isViewedRef.current = isViewed;
  // Stable identity: a new callback per mark would re-render every file card.
  const toggleViewed = useCallback((file: PrDiffFile) => {
    // Marking as read folds the file, like turning a page.
    const was = isViewedRef.current(file);
    setManual((m) => ({ ...m, [file.path]: was }));
    toggle(file);
  }, [toggle]);
  const retry = useCallback(() => { requestPrDiff(url); }, [url]);

  return {
    diff, files, loading: !diff && !entry?.error && entry?.loading !== false, error: entry?.error, total: parsed.length,
    viewedCount: parsed.filter((p) => isViewed(p.file)).length, anyOpen: files.some((f) => f.open),
    query, setQuery, wrap, setWrap, toggleOpen, setAll, toggleViewed, retry,
  };
}
