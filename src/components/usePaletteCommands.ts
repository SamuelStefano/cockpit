import { useMemo } from 'react';
import type { Cmd, IconName } from './command-palette-types';
import type { Route } from '../useRoute';
import type { PermMode } from '../../shared/protocol';
import type { Session } from '../data/types';
import { buildPromptLink } from '../cockpit/prompt-link';
import { toast } from './primitives/toast-bus';
import { navFor, type NavRole } from './chrome/nav-routes';
import { gameEnabled } from '../game/game-bus';
import { foundEgg } from '../game/found-egg';
import { triggerEgg, type EggTrigger } from '../game/egg-bus';

const SUDO_QUERY = 'sudo make me a sandwich';
const HIDDEN_EGGS: EggTrigger[] = ['iddqd', 'matrix', 'konami'];

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
  draft?: string;
  role?: NavRole;
  query?: string;
}

export function usePaletteCommands(args: PaletteCommandsArgs): Cmd[] {
  const { onClose, nav, onNew, mode, setMode, sessions, onSelectSession, running, onStop, onFocusComposer, onShowHelp, draft = '', role = 'student', query = '' } = args;
  const arcade = gameEnabled();
  const q = query.trim().toLowerCase();
  const sudo = arcade && q === SUDO_QUERY;
  const hiddenEgg = arcade ? HIDDEN_EGGS.find((e) => e === q) : undefined;
  return useMemo<Cmd[]>(() => {
    const go = (to: Route) => () => { nav(to); onClose(); };
    const setM = (m: PermMode) => () => { setMode(m); onClose(); };
    // Every route the header offers, from the same list (navFor): the palette used
    // to reach only 5 of them, so ⌘K could not open pontos, crons, canvas…
    const nav_: Cmd[] = navFor(role).map((n) => ({
      id: `go-${n.to === '/' ? 'chat' : n.to.slice(1)}`,
      label: `Ir para ${n.label}`,
      icon: n.icon,
      group: 'Navegar',
      run: go(n.to),
    }));
    const actions: Cmd[] = [
      { id: 'new', label: 'Nova conversa', icon: 'plus', group: 'Ações', run: () => { onNew(); onClose(); } },
      { id: 'focus', label: 'Focar campo de mensagem', hint: '↵', icon: 'pencil', group: 'Ações', run: () => { nav('/'); onFocusComposer(); onClose(); } },
      { id: 'help', label: 'Mostrar atalhos de teclado', hint: '?', icon: 'command', group: 'Ações', run: () => { onClose(); onShowHelp(); } },
    ];
    if (arcade) {
      actions.push(
        { id: 'arcade', label: 'Abrir Arcade', icon: 'zap', group: 'Ações', run: go('/arcade') },
        { id: 'arcade-runner', label: 'Jogar Bit Runner', icon: 'play', group: 'Ações', run: go('/arcade') },
      );
    }
    // Shown only on the exact phrase (the filter would otherwise list it for "sudo").
    if (sudo) {
      actions.push({ id: 'sudo-sandwich', label: SUDO_QUERY, icon: 'terminal', group: 'Ações', run: () => { foundEgg('sudo'); toast('Feito. 🥪 Você não é root, mas o Bit abriu uma exceção.'); onClose(); } });
    }
    // Hidden like the sandwich: listed only on the exact word, never in the empty palette.
    if (hiddenEgg) {
      actions.push({ id: `egg-${hiddenEgg}`, label: hiddenEgg, icon: 'zap', group: 'Ações', run: () => { onClose(); triggerEgg(hiddenEgg); } });
    }
    if (draft.trim()) {
      actions.push({
        id: 'copy-prompt-link', label: 'Copiar link de prompt', icon: 'copy', group: 'Ações',
        run: () => {
          navigator.clipboard.writeText(buildPromptLink(location.origin, draft))
            .then(() => toast('Link copiado'), () => toast('Não foi possível copiar o link.', { tone: 'error' }));
          onClose();
        },
      });
    }
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
    const modes: Cmd[] = (['auto', 'acceptEdits'] as PermMode[]).map((m) => ({
      id: `mode-${m}`,
      label: `Modo: ${MODE_LABEL[m]}`,
      hint: mode === m ? 'atual' : undefined,
      icon: m === 'auto' ? 'sparkles' : 'play',
      group: 'Modo',
      run: setM(m),
    }));
    // Every session is a command, so a query finds old ones too; the empty
    // palette shows only the first SESSIONS_IDLE (capSessions in filter).
    const sess: Cmd[] = sessions.map((s) => ({
      id: `sess-${s.id}`,
      label: s.title || s.snippet || 'sessão',
      icon: 'message',
      group: 'Sessões',
      run: () => { onSelectSession(s.id); nav('/'); onClose(); },
    }));
    // Empty-palette order: what is running, recent sessions, actions, then routes.
    return [...runningCmds, ...sess, ...actions, ...nav_, ...modes];
  }, [role, arcade, sudo, hiddenEgg, nav, onClose, onNew, mode, setMode, sessions, onSelectSession, running, onStop, onFocusComposer, onShowHelp, draft]);
}
