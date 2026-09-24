import { Button } from '../../components/primitives';

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

export function CanvasToolbar({
  zoom, onZoom, onFit, onResetLayout, onNewTerminal, onOpenRecent, analysisOn, onToggleAnalysis, onFocusOrchestrator,
  dockOpen, onToggleDock,
}: Props) {
  return (
    <div data-canvas-overlay className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/85 px-1.5 py-1 shadow-lg backdrop-blur-md">
      {onToggleDock && (
        <>
          <Button
            variant={dockOpen ? 'secondary' : 'ghost'} size="sm" icon="panelRight" onClick={onToggleDock}
            title="fixar o orchestrator no sidebar (Ctrl+.)" className="text-fuchsia-400 hover:text-fuchsia-300"
          >orchestrator</Button>
          <span className="mx-1 h-4 w-px bg-neutral-700" />
        </>
      )}
      {!dockOpen && onFocusOrchestrator && (
        <>
          <Button variant="ghost" size="sm" icon="command" onClick={onFocusOrchestrator} title="ir para a janela do orchestrator" className="text-fuchsia-400 hover:text-fuchsia-300">orchestrator</Button>
          <span className="mx-1 h-4 w-px bg-neutral-700" />
        </>
      )}
      <Button variant="ghost" size="sm" icon="zap" onClick={onOpenRecent} title="abrir o terminal das sessões mais recentes">sessões</Button>
      <Button variant="ghost" size="sm" icon="terminal" onClick={onNewTerminal} title="novo terminal (tmux) no canvas">terminal</Button>
      <Button variant={analysisOn ? 'secondary' : 'ghost'} size="sm" icon="sliders" onClick={onToggleAnalysis} title="cpu, memória, contexto e tempo de cada terminal">análise</Button>
      <span className="mx-1 h-4 w-px bg-neutral-700" />
      <Button variant="ghost" size="sm" icon="layers" onClick={onResetLayout} title="descarta as posições arrastadas e arruma tudo de novo">reorganizar</Button>
      <Button variant="ghost" size="sm" icon="maximize" onClick={onFit} title="enquadrar tudo" />
      <span className="mx-1 h-4 w-px bg-neutral-700" />
      <Button variant="ghost" size="sm" onClick={() => onZoom(1 / 1.25)} title="afastar">−</Button>
      <span className="w-11 text-center font-mono text-[11px] tabular-nums text-neutral-300">{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="sm" onClick={() => onZoom(1.25)} title="aproximar">+</Button>
    </div>
  );
}
