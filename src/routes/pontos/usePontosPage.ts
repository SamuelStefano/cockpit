import type { DflPointsSnapshot } from '../../../shared/protocol';
import type { DflDraft, DraftOp } from '../../../shared/dfl-drafts';
import { usePontosControls } from './pontosControls';
import { recomputeTotals } from './pontosPrefs';
import { monthCap, currentMonthKey, type MonthCapState } from './month-cap';
import { pendingTotals } from './draft-cap';
import { marksByEpic } from './nav-model';
import { useWorkspace } from './useWorkspace';
import { useDrafts } from './useDrafts';
import { useToggle } from './useToggle';

interface Args {
  connected: boolean;
  now: number;
  snapshot: DflPointsSnapshot | null;
  drafts: DflDraft[];
  onDraftsGet: () => void;
  onDraftOp: (op: DraftOp) => boolean;
}

const STATE: Record<MonthCapState, { tone: 'green' | 'yellow' | 'red'; text: string }> = {
  ok: { tone: 'green', text: 'dentro do teto' },
  full: { tone: 'yellow', text: 'teto batido' },
  over: { tone: 'red', text: 'teto estourado' },
};

// Everything the /pontos workspace derives from the raw data: totals with the
// "off" deliveries taken out, the month-cap state, pending drafts, the
// navigator/selection and the dispatch flow.
export function usePontosPage({ connected, now, snapshot, drafts, onDraftsGet, onDraftOp }: Args) {
  const { excluded, pointValue, monthCapCents, selected } = usePontosControls();
  const projects = snapshot?.projects ?? [];
  const recomputed = snapshot ? recomputeTotals(projects, excluded, pointValue) : null;
  const totals = recomputed?.totals ?? snapshot?.totals;
  const cap = snapshot && totals ? monthCap(snapshot.invoices, totals.amountOpenCents, now, monthCapCents(currentMonthKey(now))) : null;
  const ws = useWorkspace(drafts, projects);
  const d = useDrafts({ connected, onDraftsGet, onDraftOp });
  const newEpic = useToggle(false);
  return {
    projects, totals,
    offPoints: recomputed?.offPoints ?? 0,
    offAmountCents: recomputed?.offAmountCents ?? 0,
    monthState: cap ? STATE[cap.state] : undefined,
    draftTotals: pendingTotals(drafts, pointValue),
    marks: marksByEpic(projects, selected),
    ws, d, newEpic,
  };
}
