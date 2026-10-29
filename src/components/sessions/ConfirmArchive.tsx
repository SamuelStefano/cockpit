import { useEffect } from 'react';
import { Button, Icon } from '../primitives';
import { useEscapeLayer } from '../primitives/useEscapeLayer';

const COPY = {
  heading: 'Excluir sessão?',
  cta: 'Excluir',
  body: (title: string) => (
    <><span className="text-neutral-200">{title}</span> some do Deck por completo (nem em "Arquivadas"). O arquivo de histórico no disco não é apagado.</>
  ),
};

export function ConfirmArchive({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  const c = COPY;
  // In the shared Escape stack (useEscapeLayer): opened on top of a Modal, this
  // overlay closes first instead of the Modal underneath.
  useEscapeLayer(true, onCancel);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.defaultPrevented) return;
      // Enter digitado num campo (rename inline, composer…) não pode confirmar
      // uma ação destrutiva: o atalho só vale quando o foco está fora de inputs.
      // Botão focado também fica de fora — o click nativo dele já age sozinho.
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable);
      if (e.key === 'Enter' && !typing) { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);
  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/60 p-4 backdrop-blur-xs max-sm:p-0 sm:items-center" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label={c.heading} className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-black/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
            <Icon name="trash" size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-neutral-100">{c.heading}</p>
            <p className="mt-1 text-[13px] leading-snug text-neutral-400">{c.body(title)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2 max-sm:[&>button]:min-h-11 max-sm:[&>button]:w-full">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant="dangerSolid" onClick={onConfirm}>{c.cta}</Button>
        </div>
      </div>
    </div>
  );
}
