import type { ReactNode } from 'react';
import { Icon, tokens, type IconName } from '../primitives';

type NoticeTone = 'error' | 'info';

interface ComposerNoticeProps {
  icon: IconName;
  children: ReactNode;
  onDismiss?: () => void;
  tone?: NoticeTone;
}

const TONE = {
  error: { box: 'border-red-500/30 bg-red-500/[0.07] text-red-200', icon: 'text-red-400', close: 'text-red-300/70 hover:bg-red-500/15 hover:text-red-200' },
  info: { box: 'border-orange-500/30 bg-orange-500/[0.07] text-orange-100', icon: 'text-orange-400', close: 'text-orange-300/70 hover:bg-orange-500/15 hover:text-orange-100' },
} satisfies Record<NoticeTone, { box: string; icon: string; close: string }>;

// Faixa de alerta acima do compositor (erro do microfone, cota esgotada). Sem
// dispensar quando o aviso descreve um estado que o usuário não resolve fechando.
// `info` é orientação, não falha (ex.: "use o 🎤 do teclado").
export function ComposerNotice({ icon, children, onDismiss, tone = 'error' }: ComposerNoticeProps) {
  const t = TONE[tone];
  return (
    <div className={`mb-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[12px] leading-snug ${t.box}`}>
      <Icon name={icon} size={13} className={`mt-0.5 shrink-0 ${t.icon}`} />
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar aviso"
          title="Dispensar aviso"
          className={`shrink-0 rounded-sm p-0.5 transition ${t.close} ${tokens.focusRing} ${tokens.touchTarget}`}
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  );
}
