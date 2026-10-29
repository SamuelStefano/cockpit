import { useEffect, useRef, type ReactNode } from 'react';
import { useDialogFocus } from '../components/primitives/useDialogFocus';
import { Button, Icon, type IconName } from '../components/primitives';
import { useEscapeLayer } from '../components/primitives/useEscapeLayer';

// Modal de confirmação para ações destrutivas/sensíveis do painel admin (remover
// token, tirar MCP, conceder/revogar admin). Enter confirma, Esc cancela. Tom
// vermelho por padrão (destrutivo); `tone="accent"` para ações não-destrutivas.
export function AdminConfirm({
  heading, body, cta, icon = 'trash', tone = 'danger', onConfirm, onCancel,
}: {
  heading: string;
  body: ReactNode;
  cta: string;
  icon?: IconName;
  tone?: 'danger' | 'accent';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // In the shared Escape stack (useEscapeLayer): opened on top of a Modal, this
  // overlay closes first instead of the Modal underneath.
  useEscapeLayer(true, onCancel);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      // Mesma guarda do ConfirmDelete: Enter digitado num campo (ou num botão já
      // focado) não pode confirmar sozinho uma ação destrutiva de admin.
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable);
      if (e.key === 'Enter' && !typing) { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog);

  const glyph = tone === 'danger' ? 'bg-red-500/15 text-red-400' : 'bg-orange-500/15 text-orange-400';

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/60 p-4 backdrop-blur-xs max-sm:p-0 sm:items-center" onClick={onCancel}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={heading} className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-black/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${glyph}`}>
            <Icon name={icon} size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-neutral-100">{heading}</p>
            <p className="mt-1 text-[13px] leading-snug text-neutral-400">{body}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2 max-sm:[&>button]:min-h-11 max-sm:[&>button]:w-full">
          {/* Focus starts on the SAFE choice: Enter on a destructive admin action
              must never be one keystroke away from opening the dialog. */}
          <Button variant="outline" onClick={onCancel} data-autofocus>Cancelar</Button>
          <Button variant={tone === 'danger' ? 'dangerSolid' : 'primary'} onClick={onConfirm}>{cta}</Button>
        </div>
      </div>
    </div>
  );
}
