import { Button } from '../../components/primitives';
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
}

export function CanvasToolbar({
  zoom, onZoom, onFit, onResetLayout, onNewTerminal, onOpenRecent, analysisOn, onToggleAnalysis,
}: Props) {
  const menu = useToolbarMenu();
  return (
    <div data-canvas-overlay className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/85 px-1.5 py-1 shadow-lg backdrop-blur-md">
      {/* A wide, unwrapped row anchored to the right edge pushed everything
          before "sessões" off-screen on a 390px phone (UX review 24/09
          item 10) — below `sm` these fold into the "…" menu instead. */}
      <div className="hidden items-center gap-1 sm:flex">
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
            <Button variant="ghost" size="sm" icon="zap" onClick={() => { onOpenRecent(); menu.close(); }}>sessões</Button>
            <Button variant="ghost" size="sm" icon="terminal" onClick={() => { onNewTerminal(); menu.close(); }}>terminal</Button>
            <Button variant={analysisOn ? 'secondary' : 'ghost'} size="sm" icon="sliders" onClick={() => { onToggleAnalysis(); menu.close(); }}>análise</Button>
            <Button variant="ghost" size="sm" icon="layers" onClick={() => { onResetLayout(); menu.close(); }}>reorganizar</Button>
            <Button variant="ghost" size="sm" icon="maximize" onClick={() => { onFit(); menu.close(); }}>enquadrar tudo</Button>
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={() => onZoom(1 / 1.25)} title="afastar" aria-label="Afastar">−</Button>
      <span className="w-11 text-center font-mono text-[12px] tabular-nums text-neutral-300" title="ctrl/⌘ + scroll = zoom">{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="sm" onClick={() => onZoom(1.25)} title="aproximar" aria-label="Aproximar">+</Button>
    </div>
  );
}
