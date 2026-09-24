import { lazy, Suspense } from 'react';
import type { OrchestratorActivity, OrchestratorInfo, TermStats } from '../../../shared/canvas';
import { Badge, Button, Icon } from '../../components/primitives';
import { usePersisted } from '../../lib/persist';
import type { TermApi } from '../../useCockpit';
import { OrchestratorActivityPanel } from './OrchestratorActivityPanel';
import { OrchestratorChatInput } from './OrchestratorChatInput';
import { buildPastedSend } from './orchestrator-chat-history';
import { cpuLabel } from './orchestrator-dock';
import { orchestratorTermId } from './orchestrator';
import { useOrchestratorActivityPoll } from './useOrchestratorActivityPoll';
import type { OrchestratorDock as DockState } from './useOrchestratorDock';

const XtermView = lazy(() => import('../../components/Xterm').then((m) => ({ default: m.XtermView })));

interface Props {
  orchestrator: OrchestratorInfo;
  dock: DockState;
  term: TermApi;
  stats?: TermStats;
  // From r.orchestratorItem?.running (Canvas.tsx) — the SAME running∪cv-live
  // read the kanban pins above its columns, never the dock's own CPU sample
  // (review item 7: the two disagreed whenever the process waited on the API
  // or idled hot). CPU is still shown, just as a secondary figure below.
  live: boolean;
  activity: OrchestratorActivity | null;
  onActivityGet: () => void;
  onOpenShell: (termId: string) => void;
}

// The Orchestrator docked into a right sidebar: same live tmux pane the
// floating window would show (reused, not a second terminal stack), plus a
// composer that types straight into that pane.
export function OrchestratorDock({ orchestrator, dock, term, stats, live, activity, onActivityGet, onOpenShell }: Props) {
  const termId = orchestratorTermId(orchestrator);
  const cpu = cpuLabel(stats);
  const sheet = dock.mobile;
  const [activityOpen, setActivityOpen] = usePersisted('canvas.orchestratorActivityOpen', false);
  useOrchestratorActivityPoll(activityOpen, onActivityGet);

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
        {cpu && <span className="font-mono text-[10px] text-neutral-500">{cpu}</span>}
        <Badge tone={live ? 'green' : 'neutral'} dot={live}>{live ? 'rodando' : 'ocioso'}</Badge>
        <Button variant="ghost" size="sm" square icon="x" title="fechar (Ctrl+.)" onClick={() => dock.setOpen(false)} />
      </header>
      <OrchestratorActivityPanel activity={activity} open={activityOpen} onToggle={() => setActivityOpen((o) => !o)} onOpenShell={onOpenShell} />
      <div className="relative min-h-0 flex-1" data-term-active>
        <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-600">abrindo terminal…</div>}>
          <XtermView id={termId} term={term} autoFocus={false} />
        </Suspense>
      </div>
      <OrchestratorChatInput onSend={(text) => term.input(termId, buildPastedSend(text))} />
    </div>
  );
}
