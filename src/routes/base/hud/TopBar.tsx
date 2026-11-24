import { Badge, Segmented } from '../../../components/primitives';
import type { BaseEngine } from '../engine/engine';
import { fmtClock, type HudState } from '../hudState';
import type { BaseMode } from '../types';
import { BaseProgress } from './BaseProgress';

const MODES: { id: BaseMode; label: string }[] = [{ id: 'live', label: 'Live' }, { id: 'practice', label: 'Practice' }];
const tone = (p: number) => (p > 66 ? '#e5432f' : p > 33 ? '#f2c14e' : '#58c26a');

export function TopBar({ hud, engine }: { hud: HudState; engine: BaseEngine }) {
  const practice = hud.mode === 'practice';
  return (
    <div className="base-top base-plate">
      <Segmented label="Mode" value={hud.mode} items={MODES} onChange={(m) => engine.setMode(m)} />
      {practice && <Badge tone="yellow">Practice, simulated data</Badge>}
      {practice && (
        <>
          <label>PRESSURE</label>
          <div className="base-pbar"><div style={{ width: `${hud.pressure}%`, background: tone(hud.pressure) }} /></div>
          <b>{Math.round(hud.pressure)}%</b>
        </>
      )}
      <b className={hud.awaiting ? 'base-hot' : ''}>{hud.awaiting ? `${hud.awaiting} await${hud.awaiting === 1 ? 's' : ''} you` : 'Nothing awaits you'}</b>
      {!practice && hud.finished > 0 && <span className="base-streak">{hud.finished} finished to read</span>}
      {!practice && <span className="base-dim">{hud.agentsShown} on the floor{hud.elsewhere ? ` · +${hud.elsewhere} elsewhere` : ''}</span>}
      {practice && hud.streak > 1 && <span className="base-streak">×{hud.streak} streak</span>}
      {!practice && <BaseProgress />}
      {practice && <span className="base-clock">{fmtClock(hud.clock)}</span>}
      {practice && <span className="base-dim">Rank {hud.level} · {hud.xp} xp</span>}
    </div>
  );
}
