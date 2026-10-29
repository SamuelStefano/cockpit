import type { PointsEntry, DflPointsSnapshot } from '../../shared/protocol';
import type { DflDraft, DraftOp } from '../../shared/dfl-drafts';
import { usePontos } from './pontos/usePontos';
import { useDflPontos } from './pontos/useDflPontos';
import { usePontosControlsState, PontosControlsProvider, type DflWriteApi } from './pontos/pontosControls';
import { PontosWorkspace } from './pontos/PontosWorkspace';

interface Props {
  connected: boolean;
  points: PointsEntry[];
  total: number;
  loaded: boolean;
  onPointsGet: () => void;
  onPointsAdd: (title: string, points: number, description?: string) => boolean;
  onPointsCorrect: (entryId: string, points: number) => boolean;
  onPointsNote: (entryId: string, description: string) => boolean;
  onPointsDelete: (entryId: string) => boolean;
  dflSnapshot: DflPointsSnapshot | null;
  dflLoaded: boolean;
  dflSyncing: boolean;
  onDflGet: () => void;
  onDflSync: () => void;
  onDflChange: DflWriteApi['onDflChange'];
  onDflInvoice: DflWriteApi['onDflInvoice'];
  onPontosAgent: DflWriteApi['onPontosAgent'];
  drafts: DflDraft[];
  draftsLoaded: boolean;
  onDraftsGet: () => void;
  onDraftOp: (op: DraftOp) => boolean;
}

// The life of a point in one workspace: staged in the Deck → epic in DFL →
// invoice within the month cap. Data comes from the WS; the provider holds the
// knobs (R$/pt, month cap, off deliveries, invoice selection).
export function Pontos(props: Props) {
  const { connected, points, total, loaded, dflSnapshot, dflLoaded, onDflGet, onDflChange, onDflInvoice, onPontosAgent } = props;
  const p = usePontos(props);
  useDflPontos({ connected, onDflGet });
  const controls = usePontosControlsState({ onDflChange, onDflInvoice, onPontosAgent });
  return (
    <PontosControlsProvider value={controls}>
      <PontosWorkspace
        connected={connected} now={p.now} snapshot={dflSnapshot} waiting={!dflLoaded && connected}
        syncing={props.dflSyncing} onSync={props.onDflSync}
        drafts={props.drafts} onDraftsGet={props.onDraftsGet} onDraftOp={props.onDraftOp} points={points}
        ledger={{ connected, loaded, points, total, now: p.now, glowing: p.glowing, add: p.add, correct: p.correct, note: p.note, remove: p.remove }}
      />
    </PontosControlsProvider>
  );
}
