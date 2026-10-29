import type { NavRole } from './chrome/nav-routes';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from './primitives';
import { useEscapeLayer } from './primitives/useEscapeLayer';
import { useBackClose } from './primitives/useBackClose';
import { filterCommands, capSessions } from './command-palette-filter';
import { usePaletteCommands } from './usePaletteCommands';
import { CommandPaletteResults, PALETTE_LIST_ID, paletteOptionId } from './CommandPaletteResults';
import type { Route } from '../useRoute';
import type { PermMode } from '../../shared/protocol';
import type { Session } from '../data/types';

const PAGE = 8;

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
  draft: string;
  role?: NavRole;
}

export function CommandPalette({ open, onClose, nav, onNew, mode, setMode, sessions, onSelectSession, running, onStop, onFocusComposer, onShowHelp, draft, role }: CommandPaletteProps) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useBackClose(open, onClose);

  const commands = usePaletteCommands({ onClose, nav, onNew, mode, setMode, sessions, onSelectSession, running, onStop, onFocusComposer, onShowHelp, draft, role });
  const filtered = useMemo(() => capSessions(filterCommands(commands, q), q), [q, commands]);

  useEscapeLayer(open, onClose);
  useEffect(() => { setSel(0); }, [q, open]);
  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    // IME compondo: Enter/Esc confirmam/cancelam o candidato, não a paleta.
    if (e.nativeEvent.isComposing) return;
    const last = filtered.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s >= last ? 0 : s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s <= 0 ? Math.max(last, 0) : s - 1)); }
    else if (e.key === 'PageDown') { e.preventDefault(); setSel((s) => Math.min(s + PAGE, Math.max(last, 0))); }
    else if (e.key === 'PageUp') { e.preventDefault(); setSel((s) => Math.max(s - PAGE, 0)); }
    else if (e.key === 'Home' && !q) { e.preventDefault(); setSel(0); }
    else if (e.key === 'End' && !q) { e.preventDefault(); setSel(Math.max(last, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.run(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12dvh] max-lg:pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-xs" onClick={onClose}>
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
            placeholder="Buscar…"
            aria-label="Buscar comando ou sessão"
            role="combobox"
            aria-expanded={filtered.length > 0}
            aria-controls={PALETTE_LIST_ID}
            aria-activedescendant={filtered[sel] ? paletteOptionId(sel) : undefined}
            aria-autocomplete="list"
            className="w-full bg-transparent py-3.5 text-[14px] text-neutral-100 placeholder-neutral-600 outline-hidden"
          />
          <kbd className="hidden rounded-sm border sm:inline border-neutral-700 bg-neutral-950 px-1.5 py-0.5 font-mono text-[12px] text-neutral-500">esc</kbd>
        </div>
        <div className="scroll-thin max-h-[52dvh] max-lg:max-h-[calc(100dvh-5rem)] overscroll-contain overflow-y-auto py-2">
          <CommandPaletteResults filtered={filtered} sel={sel} setSel={setSel} />
        </div>
      </div>
    </div>
  );
}
