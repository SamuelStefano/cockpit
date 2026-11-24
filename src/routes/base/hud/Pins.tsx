import { PIN_SIZE, type BaseEngine } from '../engine/engine';
import type { HudState } from '../hudState';

export function Pins({ hud, engine }: { hud: HudState; engine: BaseEngine }) {
  return (
    <div className="base-pins">
      {hud.pins.map((p) => (
        <div key={p.id} className="pin">
          <header>{p.name}<button type="button" onClick={() => engine.unpin(p.id)}>×</button></header>
          <canvas ref={(c) => engine.attachPin(p.id, c)} width={PIN_SIZE.w} height={PIN_SIZE.h} onClick={() => engine.select(p.id)} />
        </div>
      ))}
    </div>
  );
}
