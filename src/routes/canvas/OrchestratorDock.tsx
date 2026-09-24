import { lazy, Suspense } from 'react';
import type { OrchestratorInfo, TermStats } from '../../../shared/canvas';
import { Badge, Button, Icon } from '../../components/primitives';
import type { TermApi } from '../../useCockpit';
import { OrchestratorChatInput } from './OrchestratorChatInput';
import { buildPastedSend } from './orchestrator-chat-history';
import { orchestratorRunning } from './orchestrator-dock';
import { orchestratorTermId } from './orchestrator';
import type { OrchestratorDock as DockState } from './useOrchestratorDock';

const XtermView = lazy(() => import('../../components/Xterm').then((m) => ({ default: m.XtermView })));

interface Props {
  orchestrator: OrchestratorInfo;
  dock: DockState;
  term: TermApi;
  stats?: TermStats;
}

// The Orchestrator docked into a right sidebar: same live tmux pane the
// floating window would show (reused, not a second terminal stack), plus a
// composer that types straight into that pane.
export function OrchestratorDock({ orchestrator, dock, term, stats }: Props) {
  const termId = orchestratorTermId(orchestrator);
  const running = orchestratorRunning(stats);
  const sheet = dock.mobile;

  return (
    <div
      data-canvas-overlay
      className={
        sheet
          ? 'fixed inset-0 z-50 flex flex-col border-l border-fuchsia-500/30 bg-neutral-950'
          : 'relative flex shrink-0 flex-col border-l border-fuchsia-500/30 bg-neutral-950'
      }
      style={sheet ? undefined : { width: dock.width }}
    >
      {!sheet && (
        <div
          onPointerDown={dock.startResize}
          title="arrastar pra redimensionar"
          className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none"
        />
      )}
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-fuchsia-500/30 bg-fuchsia-500/10 pl-3 pr-1.5">
        <Icon name="command" size={13} className="text-fuchsia-400" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-neutral-200">Orchestrator</span>
        <Badge tone={running ? 'green' : 'neutral'}>{running ? 'rodando' : 'ocioso'}</Badge>
        <Button variant="ghost" size="sm" square icon="x" title="fechar (Ctrl+.)" onClick={() => dock.setOpen(false)} />
      </header>
      <div className="relative min-h-0 flex-1" data-term-active>
        <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-600">abrindo terminal…</div>}>
          <XtermView id={termId} term={term} autoFocus={false} />
        </Suspense>
      </div>
      <OrchestratorChatInput onSend={(text) => term.input(termId, buildPastedSend(text))} />
    </div>
  );
}
