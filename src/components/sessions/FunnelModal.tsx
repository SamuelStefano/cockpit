import { Button, Modal } from '../primitives';
import type { Session } from '../../data/types';
import { FUNNEL_INSTR, FUNNEL_SUMMARY } from '../../../shared/funnel-prompt';
import { IDLE_OPTIONS, FUNNEL_MAX } from './stale';
import { FunnelRow } from './FunnelRow';

export function FunnelModal({
  open, onClose, candidates, excluded, onToggle, selected, idleDays, setIdleDays, now, busy, onRun,
}: {
  open: boolean;
  onClose: () => void;
  candidates: Session[];
  excluded: Set<string>;
  onToggle: (id: string) => void;
  selected: string[];
  idleDays: number;
  setIdleDays: (d: number) => void;
  now: number;
  busy?: boolean;
  onRun: (ids: string[]) => void;
}) {
  const kept = candidates.length - selected.length;
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Afunilar sessões paradas" icon="sparkles" maxWidth="max-w-xl"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button icon="sparkles" loading={busy} disabled={busy || selected.length === 0} onClick={() => onRun(selected)}>
            {busy ? 'Destilando…' : `Destilar e arquivar ${selected.length}`}
          </Button>
        </>
      )}
    >
      <p className="text-[13px] leading-relaxed text-neutral-400">{FUNNEL_SUMMARY}</p>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-[12px] text-neutral-500">Paradas há mais de</span>
        {IDLE_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setIdleDays(d)}
            disabled={busy}
            aria-pressed={idleDays === d}
            className={`rounded-lg border px-2 py-1 text-[12px] transition disabled:opacity-50 ${idleDays === d ? 'border-orange-500/40 bg-orange-500/10 text-orange-300' : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'}`}
          >
            {d} dias
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-56 overflow-auto overscroll-contain rounded-xl border border-neutral-800 bg-neutral-950/60">
        {candidates.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-neutral-500">Nenhuma sessão parada nesse corte.</p>
        ) : candidates.map((s) => (
          <FunnelRow key={s.id} s={s} checked={!excluded.has(s.id)} now={now} disabled={busy} onToggle={() => onToggle(s.id)} />
        ))}
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-neutral-600">
        {kept > 0 ? `${kept} desmarcada${kept > 1 ? 's' : ''} fica${kept > 1 ? 'm' : ''} como está${kept > 1 ? 'o' : ''}. ` : 'Desmarque o que quer manter; fixe a sessão pra ela nunca entrar aqui. '}
        Favoritas, a sessão aberta, as que estão rodando e as que esperam resposta ficam de fora.
        Máximo de {FUNNEL_MAX} por rodada. Arquivar é reversível — elas continuam em "Arquivadas" e o histórico segue no disco.
      </p>

      <details className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
        <summary className="cursor-pointer text-[12px] text-neutral-400">Ver o prompt que o agente vai rodar</summary>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-neutral-500">{FUNNEL_INSTR}</pre>
      </details>
    </Modal>
  );
}
