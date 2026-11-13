import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PrDiffFile } from '../../../shared/prs';
import { filterFiles, parsePatch, startsCollapsed, type DiffRow } from './diff-parse';
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
    return parsed.filter((p) => keep.has(p.file.path)).map(({ file, rows }) => {
      const seen = isViewed(file);
      return { file, rows, viewed: seen, open: manual[file.path] ?? !(seen || startsCollapsed(file, rows.length)) };
    });
  }, [parsed, query, manual, isViewed]);

  const toggleOpen = useCallback((path: string, open: boolean) => setManual((m) => ({ ...m, [path]: open })), []);
  const setAll = useCallback((open: boolean) => setManual(Object.fromEntries(parsed.map((p) => [p.file.path, open]))), [parsed]);
  const toggleViewed = useCallback((file: PrDiffFile) => {
    // Marking as read folds the file, like turning a page.
    setManual((m) => ({ ...m, [file.path]: isViewed(file) }));
    viewed.toggle(file);
  }, [viewed, isViewed]);
  const retry = useCallback(() => { requestPrDiff(url); }, [url]);

  return {
    diff, files, loading: !diff && !entry?.error, error: entry?.error, total: parsed.length,
    viewedCount: parsed.filter((p) => isViewed(p.file)).length, anyOpen: files.some((f) => f.open),
    query, setQuery, wrap, setWrap, toggleOpen, setAll, toggleViewed, retry,
  };
}
