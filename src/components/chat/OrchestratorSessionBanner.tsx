import { Icon } from '../primitives';

// Samuel typing into the normal chat view for the SAME session the canvas
// dock also writes into (see server/ws/runs.ts's twin-process guard) used to
// look like an ordinary turn — nothing told him this chat's send goes into
// the Orchestrator's tmux pane instead of starting a fresh run.
export function OrchestratorSessionBanner() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3">
      <div className="flex items-center gap-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2 text-[12.5px] text-fuchsia-200">
        <Icon name="command" size={13} className="shrink-0 text-fuchsia-400" />
        <span>Esta é a sessão do Orchestrator — mensagens vão pro terminal dele, não pra um turno novo.</span>
      </div>
    </div>
  );
}
