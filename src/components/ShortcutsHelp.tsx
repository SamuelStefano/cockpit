import { useEffect } from 'react';
import { Icon } from './primitives';

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Global',
    items: [
      { keys: ['⌘', 'K'], label: 'Abrir paleta de comandos' },
      { keys: ['?'], label: 'Mostrar este painel' },
      { keys: ['esc'], label: 'Fechar paleta / modal' },
    ],
  },
  {
    title: 'Chat',
    items: [
      { keys: ['↵'], label: 'Enviar mensagem' },
      { keys: ['⇧', '↵'], label: 'Quebrar linha' },
    ],
  },
  {
    title: 'Listas (sessões, skills, contextos)',
    items: [
      { keys: ['⌘', '/'], label: 'Focar a busca' },
    ],
  },
  {
    title: 'Paleta de comandos',
    items: [
      { keys: ['↑', '↓'], label: 'Navegar resultados' },
      { keys: ['↵'], label: 'Executar selecionado' },
    ],
  },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((k) => (
        <kbd key={k} className="rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">{k}</kbd>
      ))}
    </span>
  );
}

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up w-full max-w-md overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-200">
            <Icon name="command" size={14} className="text-orange-400" /> Atalhos de teclado
          </span>
          <button onClick={onClose} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="scroll-thin max-h-[60vh] space-y-4 overflow-y-auto px-4 py-3.5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">{g.title}</div>
              <div className="space-y-1">
                {g.items.map((it) => (
                  <div key={it.label} className="flex items-center justify-between gap-3 rounded-md px-1 py-1">
                    <span className="text-[12.5px] text-neutral-300">{it.label}</span>
                    <Keys keys={it.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
