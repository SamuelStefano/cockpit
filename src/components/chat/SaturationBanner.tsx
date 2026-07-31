import { Button, Icon } from '../primitives';
import { saturation, canHandoff } from './saturation';

interface SaturationBannerProps {
  sessionId?: string;
  contextTokens: number;
  busy: boolean;
  onHandoff: (sessionId: string) => void;
}

export function SaturationBanner({ sessionId, contextTokens, busy, onHandoff }: SaturationBannerProps) {
  const sat = saturation(contextTokens);
  if (!sat || !canHandoff(sessionId, false)) return null;

  const tone = sat.critical
    ? { border: 'border-red-500/30', bg: 'bg-red-500/10', chip: 'bg-red-500/20 text-red-300', title: 'text-red-200', body: 'text-red-100/75' }
    : { border: 'border-orange-500/30', bg: 'bg-orange-500/10', chip: 'bg-orange-500/20 text-orange-300', title: 'text-orange-200', body: 'text-orange-100/75' };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-2">
      <div className={`rounded-xl border ${tone.border} ${tone.bg} p-3.5`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.chip}`}>
            <Icon name="zap" size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[14px] font-semibold ${tone.title}`}>
              Sessão lotada — {sat.pct}% da janela ({sat.k}k tokens)
            </p>
            <p className={`mt-1 text-[13px] leading-relaxed ${tone.body}`}>
              Cada mensagem daqui pra frente reenvia quase todo esse contexto: você paga
              muito por pouca resposta. Migrar salva o contexto e as tarefas num arquivo
              de Contextos, abre um chat novo e arquiva este.
            </p>
            <Button
              className="mt-3"
              variant={sat.critical ? 'primary' : 'secondary'}
              size="sm"
              icon="sparkles"
              loading={busy}
              onClick={() => sessionId && onHandoff(sessionId)}
            >
              {busy ? 'Migrando…' : 'Migrar para um chat novo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
