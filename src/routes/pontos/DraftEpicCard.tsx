import type { DflDraft, DraftOp } from '../../../shared/dfl-drafts';
import { Badge, Button, InlineEdit, ProgressBar } from '../../components/primitives';
import { relPast } from '../../../shared/format';
import { draftCap } from './draft-cap';
import { useDraftEpicCard } from './useDraftEpicCard';
import { DraftTaskRow } from './DraftTaskRow';
import { brl, fmtPts } from './money';

interface Props {
  draft: DflDraft;
  pointValue: number;
  onOp: (op: DraftOp) => void;
  onDispatch: () => void;
}

const STATUS = {
  draft: { tone: 'neutral', text: 'rascunho' },
  dispatched: { tone: 'orange', text: 'enviado ao agente' },
  created: { tone: 'green', text: 'criado no DFL' },
} as const;

export function DraftEpicCard({ draft, pointValue, onOp, onDispatch }: Props) {
  const c = useDraftEpicCard(() => onOp({ op: 'delete-epic', id: draft.id }));
  const cap = draftCap(draft, pointValue);
  const st = STATUS[draft.status];
  const pending = draft.status === 'draft';
  const pct = Math.round((cap.valueCents / cap.capCents) * 100);

  return (
    <div className={`rounded-xl border bg-neutral-900/50 hairline ${cap.over && pending ? 'border-yellow-500/40' : 'border-neutral-800'}`}>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-2 px-2.5 py-2.5">
        <Button variant="ghost" size="sm" square icon={c.open ? 'chevronDown' : 'chevronRight'} onClick={c.toggle}
          title={c.open ? 'Esconder tasks' : 'Ver tasks'} aria-label={c.open ? 'Esconder tasks' : 'Ver tasks'} aria-expanded={c.open} />
        <div className={`min-w-0 flex-1 basis-56 pt-0.5 ${pending ? '' : 'opacity-70'}`}>
          <InlineEdit label="título do épico" hint={false} value={draft.title} onSave={(title) => onOp({ op: 'update-epic', id: draft.id, title })}
            className="text-[13.5px] font-semibold leading-snug text-neutral-100" inputClassName="w-full text-[13.5px]" />
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] tabular-nums text-neutral-400">
            <span className="font-semibold text-orange-300">{fmtPts(cap.points)} pt</span>
            <span>{brl(cap.valueCents)}</span>
            <span className="text-neutral-600">·</span>
            <button type="button" onClick={c.toggle} className="hover:text-neutral-200">{draft.tasks.length} {draft.tasks.length === 1 ? 'task' : 'tasks'}</button>
            <span className="text-neutral-600">·</span>
            <span className="flex items-center gap-1.5" title={`teto por épico: ${brl(cap.capCents)}`}>
              <span className="block w-12">
                <ProgressBar segments={[
                  { value: Math.min(cap.valueCents, cap.capCents), tone: cap.over ? 'yellow' : 'orange' },
                  { value: Math.max(0, cap.capCents - cap.valueCents), tone: 'track' },
                ]} />
              </span>
              <span className={cap.over ? 'text-yellow-300' : 'text-neutral-500'}>{pct}% do teto</span>
            </span>
            <Badge tone={st.tone}>{st.text}</Badge>
            {draft.dispatchedAt && !pending && <span className="text-[11px] text-neutral-600">{relPast(draft.dispatchedAt, Date.now())}</span>}
          </div>
          {cap.over && (
            <p className="mt-1.5 text-[11.5px] tabular-nums text-yellow-300">
              Passa {brl(cap.overCents)} do teto de {brl(cap.capCents)} por épico — quebre em dois épicos antes de criar.
            </p>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {pending
            ? <Button size="sm" icon="zap" onClick={onDispatch} disabled={draft.tasks.length === 0}>Criar no DFL</Button>
            : <Button variant="ghost" size="sm" icon="rotate" onClick={() => onOp({ op: 'set-status', id: draft.id, status: 'draft' })}>voltar a rascunho</Button>}
          {c.armed
            ? <Button variant="dangerSolid" size="sm" onClick={c.clickDelete}>apagar?</Button>
            : <Button variant="ghost" size="sm" square icon="trash" title="Apagar rascunho" aria-label="Apagar rascunho" onClick={c.clickDelete} />}
        </div>
      </div>

      {c.open && (
        <ul className="divide-y divide-neutral-800/70 border-t border-neutral-800/70">
          {draft.tasks.length === 0 && <li className="px-3.5 py-3 text-[12px] text-neutral-600">Sem tasks neste épico.</li>}
          {draft.tasks.map((t) => <DraftTaskRow key={t.id} epicId={draft.id} task={t} onOp={onOp} />)}
        </ul>
      )}
    </div>
  );
}
