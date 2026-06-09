import { useMemo } from 'react';
import type { Cmd, IconName } from './commandPalette.types';
import type { Route } from '../useRoute';
import type { PermMode } from '../../shared/protocol';
import type { Session } from '../data/mock';

const MODE_LABEL: Record<PermMode, string> = { plan: 'Planejar', auto: 'Auto', acceptEdits: 'Executar' };

interface PaletteCommandsArgs {
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

export function usePaletteCommands(args: PaletteCommandsArgs): Cmd[] {
  const { onClose, nav, onNew, mode, setMode, sessions, onSelectSession, running, onStop, onFocusComposer, onShowHelp } = args;
  return useMemo<Cmd[]>(() => {
    const go = (to: Route) => () => { nav(to); onClose(); };
    const setM = (m: PermMode) => () => { setMode(m); onClose(); };
    const nav_: Cmd[] = [
      { id: 'go-chat', label: 'Ir para Chat', icon: 'message', group: 'Navegar', run: go('/') },
      { id: 'go-ctx', label: 'Ir para Contextos', icon: 'sparkles', group: 'Navegar', run: go('/contextos') },
      { id: 'go-skills', label: 'Ir para Skills', icon: 'zap', group: 'Navegar', run: go('/skills') },
      { id: 'go-uso', label: 'Ir para Uso', icon: 'arrowUp', group: 'Navegar', run: go('/uso') },
      { id: 'go-docs', label: 'Ir para Docs', icon: 'file', group: 'Navegar', run: go('/docs') },
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
}
