import { useEffect } from 'react';
import { Icon, Badge, Markdown } from './primitives';
import type { ContextDoc } from '../useCockpit';

// Tom por tipo de memória. memory ganha tom próprio (era o mais comum e caía em
// neutral sem querer). 5 tipos, 5 tons distintos.
export const TYPE_TONE: Record<string, 'orange' | 'green' | 'yellow' | 'red' | 'neutral'> = {
  user: 'orange',
  project: 'green',
  feedback: 'yellow',
  reference: 'neutral',
  memory: 'red',
};

export function ContextModal({ doc, type, onClose }: { doc: ContextDoc; type?: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-neutral-200">{doc.title}</span>
            {type && <Badge tone={TYPE_TONE[type] ?? 'neutral'}>{type}</Badge>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4 text-[13px] leading-relaxed text-neutral-300">
          <div className="max-w-prose"><Markdown md={doc.body} /></div>
        </div>
      </div>
    </div>
  );
}
