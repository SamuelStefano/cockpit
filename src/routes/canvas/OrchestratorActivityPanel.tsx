import type { DelegatedShell, OrchestratorActivity } from '../../../shared/canvas';
import { Badge, Icon } from '../../components/primitives';
import { BackgroundAgents, fmtElapsed } from '../../components/chat/BackgroundAgents';

interface Props {
  activity: OrchestratorActivity | null;
  open: boolean;
  onToggle: () => void;
  onOpenShell: (termId: string) => void;
}

function ShellRow({ shell, onOpen }: { shell: DelegatedShell; onOpen: () => void }) {
  const reported = shell.status === 'reported';
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!shell.tmuxAlive}
      title={shell.tmuxAlive ? 'abrir o shell' : 'sem shell ativo pra este delegado'}
      className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-neutral-800/60 disabled:cursor-default disabled:hover:bg-transparent"
    >
      {reported ? <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-400" /> : (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-orange-400" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-medium text-neutral-200">{shell.name}</span>
          {shell.startedAt && <span className="shrink-0 font-mono text-[10.5px] text-neutral-500">{fmtElapsed(Date.now() - shell.startedAt)}</span>}
          {!shell.tmuxAlive && <Badge tone="neutral" className="shrink-0 px-1 py-0 text-[9.5px]">sem shell</Badge>}
        </div>
        <p className="truncate text-[11px] text-neutral-500">{reported ? shell.reportPreview ?? shell.promptPreview : shell.promptPreview}</p>
      </div>
    </button>
  );
}

// "Em andamento": the Orchestrator's own subagents (Task/Agent launches still
// running in its turn), the shells it delegated work into by hand
// (~/.cockpit/orch-shells/*.prompt.md/.report.md), and any other raw shell
// someone opened from the canvas with no note on record. Collapsible, above
// the composer — polled only while open (useOrchestratorActivityPoll).
export function OrchestratorActivityPanel({ activity, open, onToggle, onOpenShell }: Props) {
  const subCount = activity?.subagents.filter((a) => a.status === 'running').length ?? 0;
  const shellCount = (activity?.delegatedShells.filter((s) => s.status === 'running').length ?? 0) + (activity?.rawShells.length ?? 0);
  const total = subCount + shellCount;

  return (
    <div className="shrink-0 border-b border-neutral-800">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-neutral-900/60"
      >
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} className="shrink-0 text-neutral-500" />
        <span className="flex-1 text-[12px] font-medium text-neutral-300">Em andamento</span>
        {total > 0 && <Badge tone="orange" className="shrink-0">{total}</Badge>}
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto px-2 pb-2">
          {!activity ? (
            <p className="px-1.5 py-1 text-[11.5px] text-neutral-600">carregando…</p>
          ) : total === 0 && activity.delegatedShells.length === 0 ? (
            <p className="px-1.5 py-1 text-[11.5px] text-neutral-600">nada em andamento agora</p>
          ) : (
            <div className="flex flex-col gap-2">
              {activity.subagents.length > 0 && <BackgroundAgents agents={activity.subagents} />}
              {activity.delegatedShells.map((s) => (
                <ShellRow key={s.name} shell={s} onOpen={() => onOpenShell(`cv-${s.name}`)} />
              ))}
              {activity.rawShells.map((id) => (
                <button
                  key={id} type="button" onClick={() => onOpenShell(id)}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12px] text-neutral-300 transition hover:bg-neutral-800/60"
                >
                  <Icon name="terminal" size={12} className="shrink-0 text-neutral-500" />
                  <span className="truncate">{id}</span>
                  <Badge tone="neutral" className="ml-auto shrink-0 px-1 py-0 text-[9.5px]">sem registro</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
