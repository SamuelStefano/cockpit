import type { BaseEngine } from '../engine/engine';
import { fmtClock, type HudState } from '../hudState';

export function ReplayBar({ hud, engine }: { hud: HudState; engine: BaseEngine }) {
  const n = hud.feed.length, r = hud.replay;
  if (!n) return null;
  return (
    <div className="base-replay base-plate">
      <label>Replay</label>
      <input type="range" min={0} max={n - 1} value={r ? r.index : n - 1} onChange={(e) => engine.scrub(Number(e.target.value))} aria-label="Replay the shift" />
      {r?.item ? <span>{fmtClock(r.item.t)} · {r.item.msg}</span> : <span className="base-dim">Scrub to revisit the shift</span>}
      {r && <button type="button" onClick={() => engine.scrub(null)}>Resume</button>}
    </div>
  );
}
