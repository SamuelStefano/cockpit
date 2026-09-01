import type { ReactNode } from 'react';
import { Icon, tokens, type IconName } from '../primitives';

interface ComposerNoticeProps {
  icon: IconName;
  children: ReactNode;
  onDismiss?: () => void;
}

// Faixa de alerta acima do compositor (erro do microfone, cota esgotada). Sem
// dispensar quando o aviso descreve um estado que o usuário não resolve fechando.
export function ComposerNotice({ icon, children, onDismiss }: ComposerNoticeProps) {
  return (
    <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-2.5 py-2 text-[12px] leading-snug text-red-200">
      <Icon name={icon} size={13} className="mt-0.5 shrink-0 text-red-400" />
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar aviso"
          title="Dispensar aviso"
          className={`shrink-0 rounded-sm p-0.5 text-red-300/70 transition hover:bg-red-500/15 hover:text-red-200 ${tokens.focusRing}`}
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  );
}
