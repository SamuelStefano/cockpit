import type { BaseEngine } from '../engine/engine';
import type { HudState } from '../hudState';

const SPEEDS = [1, 10, 60];

export function BottomBar({ hud, engine }: { hud: HudState; engine: BaseEngine }) {
  return (
    <div className="base-bottom">
      <div className="base-speed base-plate">
        <button type="button" className={hud.paused ? 'sel' : ''} onClick={() => engine.togglePause()}>❚❚</button>
        {SPEEDS.map((s) => <button type="button" key={s} className={hud.speed === s && !hud.paused ? 'sel' : ''} onClick={() => engine.setSpeed(s)}>{s}x</button>)}
      </div>
      <div className="base-rail">
        {hud.tickets.map((t) => (
          <button type="button" key={t.id} className="ticket" onClick={() => engine.openFunnel(t.id)}>
            <b>{t.title}</b>
            <span className="pips">{t.pips.map((p, i) => <i key={i} style={{ '--v': p.value } as React.CSSProperties} className={p.bad ? 'bad' : p.ok ? 'ok' : ''} />)}</span>
            <small>{t.done}/{t.total || '…'} verified</small>
          </button>
        ))}
      </div>
    </div>
  );
}
