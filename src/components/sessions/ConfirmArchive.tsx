import { useEffect } from 'react';
import { Icon } from '../primitives';

type Mode = 'archive' | 'delete';

const COPY: Record<Mode, { heading: string; cta: string; icon: 'x' | 'trash'; body: (title: string) => React.ReactNode }> = {
  archive: {
    heading: 'Arquivar sessão?',
    cta: 'Arquivar',
    icon: 'x',
    body: (title) => (
      <><span className="text-neutral-200">{title}</span> some do sidebar. O histórico no disco não é apagado — dá pra restaurar em "Arquivadas".</>
    ),
  },
  delete: {
    heading: 'Excluir sessão?',
    cta: 'Excluir',
    icon: 'trash',
    body: (title) => (
      <><span className="text-neutral-200">{title}</span> some do Deck por completo (nem em "Arquivadas"). O arquivo de histórico no disco não é apagado.</>
    ),
  },
};

export function ConfirmArchive({ title, mode = 'archive', onConfirm, onCancel }: { title: string; mode?: Mode; onConfirm: () => void; onCancel: () => void }) {
  const c = COPY[mode];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.defaultPrevented) return;
      // Enter digitado num campo (rename inline, composer…) não pode confirmar
      // uma ação destrutiva: o atalho só vale quando o foco está fora de inputs.
      // Botão focado também fica de fora — o click nativo dele já age sozinho.
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable);
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.key === 'Enter' && !typing) { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label={c.heading} className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
            <Icon name={c.icon} size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-neutral-100">{c.heading}</p>
            <p className="mt-1 text-[12px] leading-snug text-neutral-400">{c.body(title)}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-[12.5px] font-medium text-neutral-300 transition hover:bg-neutral-800">
            Cancelar
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-red-500/90 px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-red-500">
            {c.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
