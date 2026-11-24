import type { BaseEngine } from '../engine/engine';
import type { HudState } from '../hudState';

export function SectorStrip({ hud, engine }: { hud: HudState; engine: BaseEngine }) {
  return (
    <div className="base-sectors">
      {hud.sectors.map((s) => (
        <div key={s.id} className={`base-sector${hud.dim === s.id ? ' sel' : ''}`} style={{ borderTopColor: s.color }}>
          <button type="button" onClick={() => engine.goSector(s.id)} title={`Fly to ${s.name}`}>
            <b>{s.name}</b> <kbd>{s.hotkey}</kbd>
            <span className="nums"><i>{s.busy} busy</i><em className={s.stuck ? 'hot' : ''}>{s.stuck} stuck</em><i>{s.waiting} waiting</i></span>
          </button>
          <button type="button" className="dim" onClick={() => engine.toggleDim(s.id)} title="Highlight this sector">◐</button>
        </div>
      ))}
    </div>
  );
}
