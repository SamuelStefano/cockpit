import { Icon } from '../primitives';
import { fmtElapsed, useElapsed } from './elapsed';

// Compactação levava minutos MUDA: o chat parecia congelado e a conversa só
// voltava resumida, sem aviso nenhum. Esta linha ocupa o lugar do "Pensando…"
// enquanto o silêncio dura, com barra em movimento pra deixar claro que o turno
// está vivo — e some sozinha assim que o próximo frame chega.
export function CompactingLine({ since }: { since: number }) {
  const secs = useElapsed(since);
  return (
    <div className="fade-up flex flex-col gap-1.5 pt-1.5" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="spinner-star inline-block w-4 text-center leading-none text-orange-400" aria-hidden>
          <Icon name="sparkles" size={13} />
        </span>
        <span className="text-[12px] font-medium text-neutral-300">Compactando a conversa…</span>
        <span className="text-[11px] tabular-nums text-neutral-600">{fmtElapsed(secs)}</span>
      </div>
      <div className="h-[3px] w-44 overflow-hidden rounded-full bg-neutral-800/80">
        <span className="sweep block h-full w-1/4 rounded-full bg-gradient-to-r from-orange-500/30 via-orange-400 to-orange-500/30" />
      </div>
      <span className="text-[11px] leading-relaxed text-neutral-500">
        O contexto encheu e o agente está resumindo o histórico. Leva alguns minutos e o turno segue sozinho depois.
      </span>
    </div>
  );
}
