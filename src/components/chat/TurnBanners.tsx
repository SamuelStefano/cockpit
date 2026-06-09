import { Icon } from '../primitives';
import type { PermMode } from '../../../shared/protocol';

interface TurnBannersProps {
  phase: 'idle' | 'thinking' | 'streaming';
  failed: boolean;
  planPending: boolean;
  lastEnd?: string;
  retryLast: () => void;
  onSend: (text: string, modeOverride?: PermMode) => void;
}

// Precedência: falha > plano > corte de teto. Só um banner aparece por vez.
export function TurnBanners({ phase, failed, planPending, lastEnd, retryLast, onSend }: TurnBannersProps) {
  if (failed) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-t border-red-500/30 bg-red-500/[0.06] px-4 py-2">
        <Icon name="rotate" size={13} className="text-red-400" />
        <span className="text-[12px] text-red-200/90">O turno falhou. Reenviar a última mensagem?</span>
        <button
          onClick={retryLast}
          className="ml-auto rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11.5px] font-medium text-red-200 transition hover:bg-red-500/20"
        >
          Tentar novamente
        </button>
      </div>
    );
  }
  if (planPending) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-t border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-2">
        <Icon name="check" size={13} className="text-emerald-400" />
        <span className="text-[12px] text-emerald-200/90">Plano pronto para execução.</span>
        <button
          onClick={() => onSend('Plano aprovado — prossiga com a implementação.', 'acceptEdits')}
          className="ml-auto rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11.5px] font-medium text-emerald-200 transition hover:bg-emerald-500/20"
        >
          Aprovar &amp; executar
        </button>
      </div>
    );
  }
  if (phase === 'idle' && lastEnd) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-t border-amber-500/30 bg-amber-500/[0.06] px-4 py-2">
        <Icon name="rotate" size={13} className="text-amber-400" />
        <span className="text-[12px] text-amber-200/90">
          {lastEnd.includes('budget') ? 'Interrompido pelo teto de gasto.' : 'Interrompido pelo limite de turnos.'} Retomar de onde parou?
        </span>
        <button
          onClick={() => onSend('Continue de onde você parou e termine a tarefa.')}
          className="ml-auto rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-medium text-amber-200 transition hover:bg-amber-500/20"
        >
          Continuar
        </button>
      </div>
    );
  }
  return null;
}
