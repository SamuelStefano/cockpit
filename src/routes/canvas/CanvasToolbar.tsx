import { Button } from '../../components/primitives';

interface Props {
  zoom: number;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onResetLayout: () => void;
}

export function CanvasToolbar({ zoom, onZoom, onFit, onResetLayout }: Props) {
  return (
    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/85 px-1.5 py-1 shadow-lg backdrop-blur-md">
      <Button variant="ghost" size="sm" icon="layers" onClick={onResetLayout} title="reorganizar (descarta posições arrastadas)" />
      <Button variant="ghost" size="sm" icon="maximize" onClick={onFit} title="enquadrar tudo" />
      <span className="mx-1 h-4 w-px bg-neutral-700" />
      <Button variant="ghost" size="sm" onClick={() => onZoom(1 / 1.25)} title="afastar">−</Button>
      <span className="w-11 text-center font-mono text-[11px] tabular-nums text-neutral-300">{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="sm" onClick={() => onZoom(1.25)} title="aproximar">+</Button>
    </div>
  );
}
