import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from './primitives';
import type { Route } from '../useRoute';
import type { PermMode } from '../../shared/protocol';
import type { Session } from '../data/mock';

type IconName = Parameters<typeof Icon>[0]['name'];

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  group: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  route: Route;
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

const MODE_LABEL: Record<PermMode, string> = { plan: 'Planejar', auto: 'Auto', acceptEdits: 'Executar' };

export function CommandPalette({ open, onClose, route, nav, onNew, mode, setMode, sessions, onSelectSession, running, onStop, onFocusComposer, onShowHelp }: CommandPaletteProps) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Cmd[]>(() => {
    const go = (to: Route) => () => { nav(to); onClose(); };
    const setM = (m: PermMode) => () => { setMode(m); onClose(); };
    const nav_: Cmd[] = [
      { id: 'go-chat', label: 'Ir para Chat', icon: 'message', group: 'Navegar', run: go('/') },
      { id: 'go-ctx', label: 'Ir para Contextos', icon: 'sparkles', group: 'Navegar', run: go('/contextos') },
      { id: 'go-skills', label: 'Ir para Skills', icon: 'zap', group: 'Navegar', run: go('/skills') },
      { id: 'go-uso', label: 'Ir para Uso', icon: 'arrowUp', group: 'Navegar', run: go('/uso') },
    ];
    const actions: Cmd[] = [
      { id: 'new', label: 'Nova sessão', icon: 'plus', group: 'Ações', run: () => { onNew(); onClose(); } },
      { id: 'focus', label: 'Focar campo de mensagem', hint: '↵', icon: 'pencil', group: 'Ações', run: () => { nav('/'); onFocusComposer(); onClose(); } },
      { id: 'help', label: 'Mostrar atalhos de teclado', hint: '?', icon: 'command', group: 'Ações', run: () => { onClose(); onShowHelp(); } },
    ];
    if (running.size) {
      // Com 1 só rodando, mira nela explicitamente — senão onStop() cairia no
      // activeRef (a sessão que você está vendo, que pode estar ociosa).
      const lone = running.size === 1 ? [...running][0] : undefined;
      actions.push({ id: 'stop', label: 'Parar resposta atual', icon: 'square', group: 'Ações', run: () => { onStop(lone); onClose(); } });
    }
    if (running.size > 1) {
      // Kill-switch do run noturno: derruba todos os turnos em voo de uma vez.
      const keys = [...running];
      actions.push({ id: 'stop-all', label: `Parar todas as respostas (${keys.length})`, icon: 'square', group: 'Ações', run: () => { for (const k of keys) onStop(k); onClose(); } });
    }
    // Sessões com run em andamento: pulo rápido pra acompanhar. Resolve o título
    // pela lista; chave temporária (new-*) sem título cai num rótulo genérico.
    const runningCmds: Cmd[] = [...running].map((key) => {
      const s = sessions.find((x) => x.id === key);
      return {
        id: `run-${key}`,
        label: s?.title || s?.snippet || 'sessão em execução',
        hint: '▶',
        icon: 'message' as IconName,
        group: 'Em execução',
        run: () => { onSelectSession(key); nav('/'); onClose(); },
      };
    });
    const modes: Cmd[] = (['plan', 'auto', 'acceptEdits'] as PermMode[]).map((m) => ({
      id: `mode-${m}`,
      label: `Modo: ${MODE_LABEL[m]}`,
      hint: mode === m ? 'atual' : undefined,
      icon: m === 'plan' ? 'pencil' : m === 'auto' ? 'sparkles' : 'play',
      group: 'Modo',
      run: setM(m),
    }));
    const sess: Cmd[] = sessions.slice(0, 40).map((s) => ({
      id: `sess-${s.id}`,
      label: s.title || s.snippet || 'sessão',
      icon: 'message',
      group: 'Sessões',
      run: () => { onSelectSession(s.id); nav('/'); onClose(); },
    }));
    return [...nav_, ...actions, ...runningCmds, ...modes, ...sess];
  }, [nav, onClose, onNew, mode, setMode, sessions, onSelectSession, running, onStop, onFocusComposer, onShowHelp]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(needle) || c.group.toLowerCase().includes(needle));
  }, [q, commands]);

  useEffect(() => { setSel(0); }, [q, open]);
  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  // Agrupa preservando a ordem de aparição.
  const groups: { name: string; items: Cmd[] }[] = [];
  for (const c of filtered) {
    let g = groups.find((x) => x.name === c.group);
    if (!g) { g = { name: c.group, items: [] }; groups.push(g); }
    g.items.push(c);
  }
  const flatIndex = (c: Cmd) => filtered.indexOf(c);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
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
            className="w-full bg-transparent py-3.5 text-[14px] text-neutral-100 placeholder-neutral-600 outline-none"
          />
          <kbd className="rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">esc</kbd>
        </div>
        <div className="scroll-thin max-h-[52vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-neutral-600">Nenhum comando encontrado</div>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="mb-1">
                <div className="px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-600">{g.name}</div>
                {g.items.map((c) => {
                  const active = flatIndex(c) === sel;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setSel(flatIndex(c))}
                      onClick={c.run}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[13.5px] transition
                        ${active ? 'bg-orange-500/15 text-orange-200' : 'text-neutral-300 hover:bg-neutral-800/60'}`}
                    >
                      <Icon name={c.icon} size={15} className={active ? 'text-orange-400' : 'text-neutral-500'} />
                      <span className="flex-1 truncate">{c.label}</span>
                      {c.hint && <span className="text-[11px] text-neutral-500">{c.hint}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
