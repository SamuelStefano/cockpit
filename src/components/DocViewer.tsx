import { useEffect, useState, type ReactNode } from 'react';
import { Icon, Markdown } from './primitives';

// Visualizador de documento (contexto/skill). No desktop é um diálogo central;
// no mobile vira bottom-sheet (sobe de baixo, largura cheia, alça de arraste e
// alvos de toque maiores). Esc fecha. `actions` recebe botões extras do header.
export function DocViewer({
  title, badges, actions, body,
  onClose,
}: {
  title: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  body: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-neutral-800 bg-neutral-950 shadow-2xl sm:max-h-[85vh] sm:max-w-3xl sm:rounded-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-neutral-700 sm:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">{title}{badges}</div>
          <div className="flex shrink-0 items-center gap-1.5">
            {actions}
            <button onClick={onClose} title="Fechar (Esc)" className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
        <div className="scroll-thin overflow-y-auto px-4 py-4 text-[13px] leading-relaxed text-neutral-300 sm:px-5">
          <div className="max-w-prose"><Markdown md={body} /></div>
        </div>
      </div>
    </div>
  );
}

// Botão de header reaproveitável (copiar/baixar).
export function DocAction({ label, icon, onClick }: { label: string; icon: 'copy' | 'check' | 'download'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-[11px] font-medium text-neutral-400 transition hover:border-orange-500/40 hover:text-orange-300"
    >
      <Icon name={icon} size={12} /> {label}
    </button>
  );
}

// Botão "copiar" com feedback de estado, usado pelos dois viewers.
export function CopyDocAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return <DocAction label={copied ? 'copiado!' : 'copiar'} icon={copied ? 'check' : 'copy'} onClick={copy} />;
}
