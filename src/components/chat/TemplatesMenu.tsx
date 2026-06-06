import { useState, useEffect, useRef } from 'react';
import { Icon } from '../primitives';
import { usePersisted } from '../../lib/persist';

// Prompts salvos (squad/SDD/checklist DFL rodam o tempo todo). 100% client:
// vivem no localStorage via usePersisted, sem backend. Inserir = preenche o
// rascunho atual; salvar = guarda o rascunho com um nome.
type Template = { id: string; name: string; text: string };

export function TemplatesMenu({ draft, onInsert }: { draft: string; onInsert: (text: string) => void }) {
  const [templates, setTemplates] = usePersisted<Template[]>('templates', []);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);
  const saveCurrent = () => {
    const text = draft.trim();
    if (!text) return;
    const name = window.prompt('Nome do template:', text.slice(0, 40))?.trim();
    if (!name) return;
    setTemplates((prev) => [...prev, { id: Math.random().toString(36).slice(2), name, text }]);
  };
  const remove = (id: string) => setTemplates((prev) => prev.filter((t) => t.id !== id));
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Templates de prompt"
        className={`flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-neutral-800 ${open ? 'bg-neutral-800 text-amber-300' : 'text-neutral-500 hover:text-amber-300'}`}
      >
        <Icon name="star" size={13} />
      </button>
      {open && (
        <div className="scroll-thin absolute bottom-full right-0 z-30 mb-2 max-h-72 w-72 overflow-auto rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl shadow-black/50">
          {templates.length === 0 && (
            <p className="px-3 py-2 text-[11.5px] leading-snug text-neutral-500">
              Nenhum template salvo ainda. Escreva um prompt e salve abaixo.
            </p>
          )}
          {templates.map((t) => (
            <div key={t.id} className="group/tpl flex items-stretch">
              <button
                onClick={() => { onInsert(t.text); setOpen(false); }}
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-1.5 text-left transition hover:bg-neutral-800/70"
              >
                <span className="truncate text-[12.5px] font-medium text-neutral-200">{t.name}</span>
                <span className="line-clamp-1 w-full truncate text-[10.5px] text-neutral-600">{t.text}</span>
              </button>
              <button
                onClick={() => remove(t.id)}
                title="Excluir template"
                className="flex w-8 shrink-0 items-center justify-center text-neutral-600 opacity-0 transition hover:text-red-400 group-hover/tpl:opacity-100"
              >
                <Icon name="trash" size={12} />
              </button>
            </div>
          ))}
          <div className="mt-1 border-t border-neutral-800 pt-1">
            <button
              onClick={saveCurrent}
              disabled={!draft.trim()}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11.5px] text-neutral-400 transition hover:bg-neutral-800/70 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="plus" size={12} /> Salvar rascunho atual
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
