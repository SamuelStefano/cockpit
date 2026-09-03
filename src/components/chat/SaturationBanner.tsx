import { Button, Icon, tokens } from '../primitives';
import { useSaturationBanner } from './useSaturationBanner';

interface SaturationBannerProps {
  sessionId?: string;
  contextTokens: number;
  busy: boolean;
  onHandoff: (sessionId: string) => void;
}

const TONE = {
  warn: { dot: 'bg-orange-400', text: 'text-orange-300/80', border: 'border-orange-500/25', bg: 'bg-orange-500/[0.07]', body: 'text-orange-100/70' },
  critical: { dot: 'bg-red-400', text: 'text-red-300/90', border: 'border-red-500/30', bg: 'bg-red-500/8', body: 'text-red-100/70' },
};

export function SaturationBanner({ sessionId, contextTokens, busy, onHandoff }: SaturationBannerProps) {
  const notice = useSaturationBanner(sessionId, contextTokens);
  if (!notice) return null;
  const { sat, level, expanded, toggle, dismiss } = notice;
  const tone = TONE[level];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-1.5">
      <div className="flex items-center gap-2 text-[11.5px]">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          className={`min-w-0 flex-1 truncate text-left ${tone.text} transition hover:underline ${tokens.focusRing}`}
        >
          Sessão lotada — {sat.pct}% da janela ({sat.k}k tokens)
        </button>
        {!expanded && (
          <Button variant="ghost" size="sm" loading={busy} onClick={() => sessionId && onHandoff(sessionId)}>
            {busy ? 'Migrando…' : 'Migrar'}
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar aviso de sessão lotada"
          title="Dispensar — volta a avisar se a janela ficar crítica"
          className={`shrink-0 rounded-sm p-0.5 text-neutral-600 transition hover:text-neutral-300 ${tokens.focusRing} ${tokens.touchTarget}`}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
      {expanded && (
        <div className={`mt-1 rounded-lg border ${tone.border} ${tone.bg} px-3 py-2.5`}>
          <p className={`text-[12.5px] leading-relaxed ${tone.body}`}>
            Cada mensagem daqui pra frente reenvia quase todo esse contexto: você paga
            muito por pouca resposta. Migrar salva o contexto e as tarefas num arquivo
            de Contextos, abre um chat novo e arquiva este.
          </p>
          <Button
            className="mt-2.5"
            variant={level === 'critical' ? 'primary' : 'secondary'}
            size="sm"
            icon="sparkles"
            loading={busy}
            onClick={() => sessionId && onHandoff(sessionId)}
          >
            {busy ? 'Migrando…' : 'Migrar para um chat novo'}
          </Button>
        </div>
      )}
    </div>
  );
}
