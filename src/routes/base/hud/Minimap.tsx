import type { BaseEngine } from '../engine/engine';
import { minimapWorldX } from '../engine/minimap';

export function Minimap({ engine }: { engine: BaseEngine }) {
  return (
    <canvas className="base-minimap" width={260} height={90} ref={(c) => engine.attachMinimap(c)}
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); engine.minimapClick(minimapWorldX(((e.clientX - r.left) * 260) / r.width)); }} />
  );
}
