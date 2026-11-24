import type { BaseEngine } from '../engine/engine';
import { fmtClock, type JourneyView } from '../hudState';

export function JourneyPanel({ view, engine }: { view: JourneyView; engine: BaseEngine }) {
  return (
    <div className="base-journey">
      <h3>{view.title}</h3>
      <div className="now">{view.status}</div>
      <ol>{view.rows.map((r, i) => <li key={i}><time>{fmtClock(r.t)}</time>{r.what}</li>)}</ol>
      <button type="button" onClick={() => engine.closePanels()}>Close · Esc</button>
    </div>
  );
}
