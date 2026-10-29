import { useCallback, useMemo, useState } from 'react';
import type { DflEpicNode, DflProjectNode } from '../../../shared/protocol';
import type { DflDraft } from '../../../shared/dfl-drafts';
import { usePontosControls } from './pontosControls';
import { buildNav, navKey, type NavRow } from './nav-model';
import type { TreeFilter } from './treeFilter';

export type PontosView = 'faturas' | 'ledger';

const KEY = 'deck:pontos:selected';
const load = (): string => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };

export interface Selection {
  key: string;
  draft?: DflDraft;
  dfl?: { epic: DflEpicNode; project: DflProjectNode };
  view?: PontosView;
  row?: NavRow;
}

// Navigator ↔ detail: what is listed (grouped, filtered, searched) and what is
// open on the right. The choice survives reloads; if it no longer exists (epic
// split, deleted, synced away) it falls back to the first pending draft, then the
// first DFL epic with open work, then the invoices.
export function useWorkspace(drafts: DflDraft[], projects: DflProjectNode[]) {
  const { pointValue, excluded } = usePontosControls();
  const [filter, setFilter] = useState<TreeFilter>('all');
  const [query, setQuery] = useState('');
  const [stored, setStored] = useState(load);
  const [drawer, setDrawer] = useState(false);

  const nav = useMemo(() => buildNav(drafts, projects, { pointValue, excluded, filter, query }), [drafts, projects, pointValue, excluded, filter, query]);

  const selection = useMemo((): Selection => {
    const find = (key: string): Selection | null => {
      const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      const row = [...nav.drafts, ...nav.open, ...nav.billed].find((r) => r.key === key);
      if (kind === 'view' && (id === 'faturas' || id === 'ledger')) return { key, view: id };
      if (kind === 'draft') { const draft = drafts.find((d) => d.id === id); return draft ? { key, draft, row } : null; }
      if (kind === 'dfl') {
        for (const project of projects) { const epic = project.epics.find((e) => e.id === id); if (epic) return { key, dfl: { epic, project }, row }; }
      }
      return null;
    };
    const pending = drafts.find((d) => d.status === 'draft');
    const fallback = pending ? navKey('draft', pending.id) : nav.open[0]?.key ?? navKey('view', 'faturas');
    return find(stored) ?? find(fallback) ?? { key: navKey('view', 'faturas'), view: 'faturas' };
  }, [stored, nav, drafts, projects]);

  const select = useCallback((key: string) => {
    setStored(key);
    setDrawer(false);
    try { localStorage.setItem(KEY, key); } catch { /* private mode */ }
  }, []);

  return { nav, filter, setFilter, query, setQuery, selection, select, drawer, setDrawer };
}
