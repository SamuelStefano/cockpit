import type { BaseEngine } from '../engine/engine';
import type { HudState } from '../hudState';

export function SideButtons({ hud, engine }: { hud: HudState; engine: BaseEngine }) {
  return (
    <div className="base-side">
      {hud.mode === 'practice' && (
        <>
          <button type="button" onClick={() => engine.setComposer(true)}>New prompt · P</button>
          <button type="button" onClick={() => engine.openFunnel()}>Funnel · F</button>
          <button type="button" onClick={() => engine.toggleHistory()}>History · H</button>
          <button type="button" onClick={() => engine.stepAway()}>Step away 2h · A</button>
        </>
      )}
      <button type="button" onClick={() => engine.cycleSound()}>Sound: {hud.sound} · M</button>
      {hud.rules.length > 0 && (
        <div className="base-rules">
          <b>Rules</b>
          {hud.rules.map((t) => <button type="button" key={t} title="Remove rule" onClick={() => engine.removeRule(t)}>⚙ {t} ×</button>)}
        </div>
      )}
    </div>
  );
}
