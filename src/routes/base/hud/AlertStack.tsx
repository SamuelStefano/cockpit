import type { BaseEngine } from '../engine/engine';
import type { HudState } from '../hudState';
import { AlertCard } from './AlertCard';

const MAX_VISIBLE = 4;

export function AlertStack({ hud, engine }: { hud: HudState; engine: BaseEngine }) {
  const visible = hud.alerts.slice(0, MAX_VISIBLE), extra = hud.alerts.length - visible.length;
  return (
    <div className="base-alerts">
      {visible.map((a, i) => (
        <AlertCard key={a.id} alert={a} first={i === 0} hotkeys={hud.mode === 'practice'}
          secondsLeft={a.deadline ? Math.max(0, Math.ceil(a.deadline - hud.clock)) : null}
          onFocus={() => engine.focusDecision(a.id)} onChoose={(k) => engine.choose(a.id, k)} />
      ))}
      {extra > 0 && <div className="more">+{extra} waiting behind these</div>}
    </div>
  );
}
