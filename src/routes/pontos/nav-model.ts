import type { DflProjectNode } from '../../../shared/protocol';
import type { DflDraft } from '../../../shared/dfl-drafts';
import { draftCap, draftProgress, sortDrafts, type DraftProgress } from './draft-cap';
import { epicCap } from './epic-cap';
import { filterProjects, type TreeFilter } from './treeFilter';

export type NavKind = 'draft' | 'dfl' | 'view';
export type NavTone = DraftProgress | 'open' | 'todo' | 'paid';

// One line of the epic navigator: enough to compare epics without opening them.
export interface NavRow {
  key: string;             // `${kind}:${id}` — also the selection key
  id: string;
  title: string;
  context?: string;        // DFL project, shown on hover and in the detail breadcrumb
  points: number;
  valueCents: number;
  capPct: number;          // 0..100+ of the R$ 5k per-epic cap
  over: boolean;
  tone: NavTone;
}

export interface NavGroups { drafts: NavRow[]; open: NavRow[]; billed: NavRow[] }

export interface NavOptions {
  pointValue: number;
  excluded: ReadonlySet<string>;
  filter: TreeFilter;
  query: string;
}

export const navKey = (kind: NavKind, id: string): string => `${kind}:${id}`;

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function draftRow(d: DflDraft, pointValue: number): NavRow {
  const c = draftCap(d, pointValue);
  return {
    key: navKey('draft', d.id), id: d.id, title: d.title, points: c.points, valueCents: c.valueCents,
    capPct: Math.round((c.valueCents / c.capCents) * 100), over: c.over, tone: draftProgress(d),
  };
}

// Drafts → DFL epics with work still open or to do → DFL epics fully invoiced.
// The status filter and the search narrow the lists; the cap is always computed
// on the WHOLE epic (a filter prunes tasks and would understate what is held).
export function buildNav(drafts: DflDraft[], projects: DflProjectNode[], o: NavOptions): NavGroups {
  const q = fold(o.query.trim());
  const hit = (title: string, ctx = '') => !q || fold(`${title} ${ctx}`).includes(q);
  const whole = new Map(projects.flatMap((p) => p.epics.map((ep) => [ep.id, ep] as const)));
  const out: NavGroups = { drafts: [], open: [], billed: [] };
  if (o.filter === 'all' || o.filter === 'todo') {
    out.drafts = sortDrafts(drafts).filter((d) => hit(d.title)).map((d) => draftRow(d, o.pointValue));
  }
  for (const p of filterProjects(projects, o.filter)) {
    for (const ep of p.epics) {
      if (!hit(ep.name, p.name)) continue;
      const full = whole.get(ep.id) ?? ep;
      const cap = epicCap(full, { pointValue: o.pointValue, excluded: o.excluded });
      const tasks = ep.deliveries.flatMap((d) => d.tasks);
      const open = tasks.some((t) => t.status === 'open');
      const todo = tasks.some((t) => t.status === 'todo');
      const row: NavRow = {
        key: navKey('dfl', ep.id), id: ep.id, title: ep.name, context: p.name, points: full.points, valueCents: full.amountCents,
        capPct: Math.round((cap.valueCents / cap.capCents) * 100), over: cap.state === 'held',
        tone: open ? 'open' : todo ? 'todo' : 'paid',
      };
      (open || todo ? out.open : out.billed).push(row);
    }
  }
  return out;
}

// Deliveries picked for invoicing, counted per epic, so the navigator shows where
// the running selection lives while you browse other epics.
export function marksByEpic(projects: DflProjectNode[], selected: ReadonlySet<string>): Map<string, number> {
  const out = new Map<string, number>();
  if (!selected.size) return out;
  for (const p of projects) for (const ep of p.epics) {
    const n = ep.deliveries.filter((d) => selected.has(d.id)).length;
    if (n) out.set(ep.id, n);
  }
  return out;
}
