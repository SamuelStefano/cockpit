import { useCallback, useState } from 'react';
import type { PrDiffFile } from '../../../shared/prs';

const KEY = 'deck.prs.viewed';
const MAX_PRS = 60;

type Store = Record<string, Record<string, string>>;

// The mark dies when the file changes again: a later push to the same path has to
// be read again, so the signature is the file's own size.
export const fileSignature = (f: Pick<PrDiffFile, 'additions' | 'deletions'>): string => `${f.additions}/${f.deletions}`;

function read(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store; } catch { return {}; }
}

function write(store: Store): void {
  const keys = Object.keys(store);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PRS))) delete store[k];
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage blocked: marks last for the visit */ }
}

export function useViewedFiles(url: string) {
  const [marks, setMarks] = useState<Record<string, string>>(() => read()[url] ?? {});

  const isViewed = useCallback((f: PrDiffFile) => marks[f.path] === fileSignature(f), [marks]);

  const toggle = useCallback((f: PrDiffFile) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (next[f.path] === fileSignature(f)) delete next[f.path];
      else next[f.path] = fileSignature(f);
      const store = read();
      delete store[url];
      if (Object.keys(next).length) store[url] = next;
      write(store);
      return next;
    });
  }, [url]);

  return { isViewed, toggle };
}
