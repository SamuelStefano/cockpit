import type { DflDraft, DraftOp } from '../../../shared/dfl-drafts';
import { Badge, InlineEdit } from '../../components/primitives';
import { relPast } from '../../../shared/format';
import { useDraftEpic, type AskDispatch } from './useDraftEpic';
import { EpicHeader } from './EpicHeader';
import { CapMeter } from './CapMeter';
import { DraftEpicActions } from './DraftEpicActions';
import { OverCapNotice } from './OverCapNotice';
import { DraftDeliverySection } from './DraftDeliverySection';
import { TaskSelectionBar } from './TaskSelectionBar';
import { brl, fmtPts } from './money';

interface Props {
  draft: DflDraft;
  pointValue: number;
  op: (o: DraftOp) => void;
  ask: AskDispatch;
}

const PROGRESS = {
  draft: { tone: 'neutral', text: 'rascunho' },
  partial: { tone: 'orange', text: 'parte enviada' },
  dispatched: { tone: 'orange', text: 'enviado ao agente' },
  created: { tone: 'green', text: 'criado no DFL' },
} as const;

// Épico → deliveries → tasks of a draft staged in the Deck, editable in place,
// with the agent actions at every level (epic, delivery, selection).
export function DraftEpicDetail({ draft, pointValue, op, ask }: Props) {
  const e = useDraftEpic({ draft, pointValue, op, ask });
  const st = PROGRESS[e.progress];
  const n = draft.deliveries.length;
  return (
    <div>
      <EpicHeader
        eyebrow={<>
          <span>rascunho no deck</span><span className="text-neutral-700">/</span><Badge tone={st.tone}>{st.text}</Badge>
          {draft.dispatchedAt && e.progress !== 'draft' && <span className="normal-case text-neutral-600">{relPast(draft.dispatchedAt, Date.now())}</span>}
        </>}
        title={<InlineEdit label="título do épico" hint={false} value={draft.title} onSave={(title) => op({ op: 'update-epic', id: draft.id, title })}
          className="text-[17px] font-semibold text-neutral-50" inputClassName="w-full text-[15px]" />}
        figure={brl(e.cap.valueCents)}
        facts={`${fmtPts(e.cap.points)} pt · ${draft.tasks.length} tasks · ${n} ${n === 1 ? 'delivery' : 'deliveries'}`}
        meter={<CapMeter valueCents={e.cap.valueCents} capCents={e.cap.capCents} over={e.cap.over} />}
        actions={<DraftEpicActions e={e} onAddDelivery={() => op({ op: 'add-delivery', epicId: draft.id })} />}
        notice={e.cap.over && <OverCapNotice overCents={e.cap.overCents} capCents={e.cap.capCents} canSplit={e.canAutoSplit} onSplit={e.autoSplit} moving={e.splitPreview} />}
      />
      <div className="flex flex-col gap-2.5">
        {draft.deliveries.map((dl) => (
          <DraftDeliverySection key={dl.id} draft={draft} delivery={dl} pointValue={pointValue} selected={e.selected}
            onToggle={e.toggle} onSetMany={e.setMany} onDrop={e.drop} onCreate={e.createDelivery} onOp={op} />
        ))}
      </div>
      {e.selection.count > 0 && <TaskSelectionBar draft={draft} e={e} />}
    </div>
  );
}
