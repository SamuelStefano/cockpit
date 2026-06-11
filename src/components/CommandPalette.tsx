import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from './primitives';
import { filterCommands } from './commandPalette.filter';
import { usePaletteCommands } from './usePaletteCommands';
import { CommandPaletteResults } from './CommandPaletteResults';
import type { Route } from '../useRoute';
import type { PermMode } from '../../shared/protocol';
import type { Session } from '../data/mock';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  nav: (to: Route) => void;
  onNew: () => void;
  mode: PermMode;
  setMode: (m: PermMode) => void;
  sessions: Session[];
  onSelectSession: (id: string) => void;
  running: Set<string>;
  onStop: (key?: string) => void;
  onFocusComposer: () => void;
  onShowHelp: () => void;
}

export function CommandPalette({ open, onClose, nav, onNew, mode, setMode, sessions, onSelectSession, running, onStop, onFocusComposer, onShowHelp }: CommandPaletteProps) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = usePaletteCommands({ onClose, nav, onNew, mode, setMode, sessions, onSelectSession, running, onStop, onFocusComposer, onShowHelp });
  const filtered = useMemo(() => filterCommands(commands, q), [q, commands]);

  useEffect(() => { setSel(0); }, [q, open]);
  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4">
          <Icon name="search" size={16} className="text-neutral-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar comando ou sessão…"
            aria-label="Buscar comando ou sessão"
            className="w-full bg-transparent py-3.5 text-[14px] text-neutral-100 placeholder-neutral-600 outline-none"
          />
          <kbd className="rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">esc</kbd>
        </div>
        <div className="scroll-thin max-h-[52vh] overscroll-contain overflow-y-auto py-2">
          <CommandPaletteResults filtered={filtered} sel={sel} setSel={setSel} />
        </div>
      </div>
    </div>
  );
}
