import type { BaseEngine } from '../engine/engine';
import type { HudState } from '../hudState';
import { useComposer } from './useComposer';

export function ComposerPanel({ hud, engine }: { hud: HudState; engine: BaseEngine }) {
  const c = useComposer(hud, engine);
  return (
    <div className="base-composer base-plate">
      <input autoFocus value={c.text} onChange={(e) => c.setText(e.target.value)} placeholder="What should the base build? (simulated)"
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') c.send(); if (e.key === 'Escape') engine.setComposer(false); }} />
      <select value={c.wing} onChange={(e) => c.setWing(e.target.value)}>{hud.wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <select value={c.width} onChange={(e) => c.setWidth(Number(e.target.value))}>{[1, 3, 5].map((n) => <option key={n} value={n}>{n} agent{n > 1 ? 's' : ''}</option>)}</select>
      <button type="button" onClick={c.send}>Send</button>
    </div>
  );
}
