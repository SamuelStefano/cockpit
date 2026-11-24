import { Button, Icon, tokens } from '../primitives';
import { useSaturationBanner } from './useSaturationBanner';
import { canHandoff } from './saturation';
import type { ComposerCost } from './send-cost';

interface SaturationBannerProps {
  contextModel?: string | null;
  sessionId?: string;
  contextTokens: number;
  busy: boolean;
  onHandoff?: (sessionId: string) => void;
  // Price of the NEXT send. Folded into the same chip: "is the session full?" and
  // "what does sending cost now?" explain the spend only together.
  cost?: ComposerCost | null;
}

const TONE = {
  warn: { dot: 'bg-orange-400', text: 'text-orange-200', border: 'border-orange-500/25', bg: 'bg-orange-500/[0.07]', body: 'text-orange-100/70' },
  critical: { dot: 'bg-red-400', text: 'text-red-200', border: 'border-red-500/30', bg: 'bg-red-500/8', body: 'text-red-100/70' },
};

export function SaturationBanner({ sessionId, contextTokens, contextModel = null, busy, onHandoff, cost = null }: SaturationBannerProps) {
  const notice = useSaturationBanner(sessionId, contextTokens, contextModel);
  if (!notice && !cost) return null;
  const doesNotFit = !!cost && !cost.fits;
  const tone = TONE[doesNotFit ? 'critical' : notice?.level ?? 'warn'];
  const migrate = onHandoff && sessionId && (notice || cost?.cost.cold) && canHandoff(sessionId, false) ? () => onHandoff(sessionId) : undefined;
  const expanded = !!notice?.expanded;

  const summary = [
    notice && `Sessão lotada ${notice.sat.pct}% (${notice.sat.k}k)`,
    cost && (doesNotFit
      ? `Este envio custa ${cost.label} e não cabe no que sobrou da janela — vai pra fila e roda quando a janela virar.`
      : `Próximo envio ${cost.label}`),
  ].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-2">
      <div className={`flex items-center gap-2 rounded-2xl border ${tone.border} ${tone.bg} py-1.5 pl-3 pr-1.5 text-[13px] ${tone.text}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
        {notice ? (
          <button
            type="button"
            onClick={notice.toggle}
            aria-expanded={expanded}
            className={`min-w-0 flex-1 text-left transition hover:underline ${doesNotFit ? '' : 'truncate'} ${tokens.focusRing}`}
          >
            {summary}
          </button>
        ) : (
          <span className={`min-w-0 flex-1 ${doesNotFit ? '' : 'truncate'}`}>{summary}</span>
        )}
        {migrate && !expanded && (
          <Button size="sm" loading={busy} onClick={migrate}>
            {busy ? 'Migrando…' : 'Migrar'}
          </Button>
        )}
        {notice && (
          <button
            type="button"
            onClick={notice.dismiss}
            aria-label="Dispensar aviso de sessão lotada"
            title="Dispensar — volta a avisar se a janela ficar crítica"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:text-neutral-200 ${tokens.focusRing}`}
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
      {expanded && notice && (
        <div className={`mt-1.5 rounded-2xl border ${tone.border} ${tone.bg} px-3.5 py-3`}>
          <p className={`text-[14px] leading-relaxed ${tone.body}`}>
            Cada mensagem daqui pra frente reenvia quase todo esse contexto: você paga
            muito por pouca resposta. Migrar salva o contexto e as tarefas num arquivo
            de Contextos, abre um chat novo e arquiva este.
            {cost?.cost.cold && !doesNotFit && ' Com o cache frio, migrar sai mais barato que continuar.'}
          </p>
          {migrate && (
            <Button className="mt-3" icon="sparkles" loading={busy} onClick={migrate}>
              {busy ? 'Migrando…' : 'Migrar para um chat novo'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
