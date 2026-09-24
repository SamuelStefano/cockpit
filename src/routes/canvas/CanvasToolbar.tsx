import { Button, ButtonGroup } from '../../components/primitives';
import { useToolbarMenu } from './useToolbarMenu';

interface Props {
  zoom: number;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onResetLayout: () => void;
  onNewTerminal: () => void;
  onOpenRecent: () => void;
  analysisOn: boolean;
  onToggleAnalysis: () => void;
  // Absent when no orchestrator.json is configured, or its session/shell
  // hasn't shown up on the canvas yet — the button has nowhere to jump to.
  onFocusOrchestrator?: () => void;
  // Absent when there's no orchestrator.json at all — nothing to dock.
  dockOpen?: boolean;
  onToggleDock?: () => void;
}

// Orchestrator's two actions (dock, jump) used to be two adjacent buttons
// both labelled "orchestrator" — one caption, two square icon buttons instead
// (UX review 24/09 item 10).
function OrchestratorGroup({ dockOpen, onToggleDock, onFocusOrchestrator }: Pick<Props, 'dockOpen' | 'onToggleDock' | 'onFocusOrchestrator'>) {
  if (!onToggleDock && !onFocusOrchestrator) return null;
  return (
    <ButtonGroup label="orchestrator">
      {onToggleDock && (
        <Button
          variant={dockOpen ? 'secondary' : 'ghost'} size="sm" square icon="panelRight" onClick={onToggleDock}
          title="fixar o orchestrator no sidebar (Ctrl+.)" className="text-fuchsia-400 hover:text-fuchsia-300"
        />
      )}
      {!dockOpen && onFocusOrchestrator && (
        <Button
          variant="ghost" size="sm" square icon="command" onClick={onFocusOrchestrator}
          title="ir para a janela do orchestrator" className="text-fuchsia-400 hover:text-fuchsia-300"
        />
      )}
    </ButtonGroup>
  );
}

export function CanvasToolbar({
  zoom, onZoom, onFit, onResetLayout, onNewTerminal, onOpenRecent, analysisOn, onToggleAnalysis, onFocusOrchestrator,
  dockOpen, onToggleDock,
}: Props) {
  const menu = useToolbarMenu();
  return (
    <div data-canvas-overlay className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/85 px-1.5 py-1 shadow-lg backdrop-blur-md">
      {/* A wide, unwrapped row anchored to the right edge pushed everything
          before "sessões" off-screen on a 390px phone (UX review 24/09
          item 10) — below `sm` these fold into the "…" menu instead. */}
      <div className="hidden items-center gap-1 sm:flex">
        <OrchestratorGroup dockOpen={dockOpen} onToggleDock={onToggleDock} onFocusOrchestrator={onFocusOrchestrator} />
        {(onToggleDock || onFocusOrchestrator) && <span className="mx-1 h-4 w-px bg-neutral-700" />}
        <Button variant="ghost" size="sm" icon="zap" onClick={onOpenRecent} title="abrir o terminal das sessões mais recentes">sessões</Button>
        <Button variant="ghost" size="sm" icon="terminal" onClick={onNewTerminal} title="novo terminal (tmux) no canvas">terminal</Button>
        <Button variant={analysisOn ? 'secondary' : 'ghost'} size="sm" icon="sliders" onClick={onToggleAnalysis} title="cpu, memória, contexto e tempo de cada terminal">análise</Button>
        <span className="mx-1 h-4 w-px bg-neutral-700" />
        <Button variant="ghost" size="sm" icon="layers" onClick={onResetLayout} title="descarta as posições arrastadas e arruma tudo de novo">reorganizar</Button>
        <Button variant="ghost" size="sm" icon="maximize" onClick={onFit} title="enquadrar tudo" />
        <span className="mx-1 h-4 w-px bg-neutral-700" />
      </div>
      <div ref={menu.ref} className="relative sm:hidden">
        <Button variant="ghost" size="sm" square icon="ellipsis" onClick={menu.toggle} title="mais ações" />
        {menu.open && (
          <div className="absolute bottom-full right-0 z-20 mb-2 flex w-44 flex-col gap-0.5 rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-2xl">
            {onToggleDock && (
              <Button variant={dockOpen ? 'secondary' : 'ghost'} size="sm" icon="panelRight" className="text-fuchsia-400" onClick={() => { onToggleDock(); menu.close(); }}>orchestrator</Button>
            )}
            {!dockOpen && onFocusOrchestrator && (
              <Button variant="ghost" size="sm" icon="command" className="text-fuchsia-400" onClick={() => { onFocusOrchestrator(); menu.close(); }}>orchestrator</Button>
            )}
            <Button variant="ghost" size="sm" icon="zap" onClick={() => { onOpenRecent(); menu.close(); }}>sessões</Button>
            <Button variant="ghost" size="sm" icon="terminal" onClick={() => { onNewTerminal(); menu.close(); }}>terminal</Button>
            <Button variant={analysisOn ? 'secondary' : 'ghost'} size="sm" icon="sliders" onClick={() => { onToggleAnalysis(); menu.close(); }}>análise</Button>
            <Button variant="ghost" size="sm" icon="layers" onClick={() => { onResetLayout(); menu.close(); }}>reorganizar</Button>
            <Button variant="ghost" size="sm" icon="maximize" onClick={() => { onFit(); menu.close(); }}>enquadrar tudo</Button>
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={() => onZoom(1 / 1.25)} title="afastar">−</Button>
      <span className="w-11 text-center font-mono text-[11px] tabular-nums text-neutral-300" title="ctrl/⌘ + scroll = zoom">{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="sm" onClick={() => onZoom(1.25)} title="aproximar">+</Button>
    </div>
  );
}
