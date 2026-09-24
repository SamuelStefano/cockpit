import { useRef, type ReactNode } from 'react';
import { useEscapeLayer } from './useEscapeLayer';
import { useDialogFocus } from './useDialogFocus';
import { Button } from './Button';
import { tokens } from './tokens';
import { Icon, type IconName } from './Icon';

// Overlay modal do design system: backdrop com blur, fecha no clique-fora e no Esc,
// semântica role="dialog". Extraído do padrão ad-hoc do AttachmentModal pra parar de
// recriar `fixed inset-0` solto a cada tela. footer opcional (ações); sem footer, o
// conteúdo já traz seus botões.
export function Modal({
  open, onClose, title, icon, children, footer, maxWidth = 'max-w-lg', label,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  icon?: IconName;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  label?: string;
}) {
  useEscapeLayer(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, open);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        tabIndex={-1}
        className={`scale-in flex max-h-[88dvh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl shadow-black/50`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
            {icon && <Icon name={icon} size={14} className="shrink-0 text-neutral-500" />}
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-200" title={title}>{title}</span>
            <Button variant="ghost" size="sm" square icon="x" onClick={onClose} title="Fechar (Esc)" aria-label="Fechar" className={tokens.touchTarget} />
          </div>
        )}
        <div className="overflow-auto overscroll-contain px-4 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-neutral-800 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
