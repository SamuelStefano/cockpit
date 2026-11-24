import type { BaseEngine } from '../engine/engine';
import { fmtClock } from '../hudState';
import type { SinceSummary } from '../sim-types';

export function SinceYouLeft({ since: s, engine }: { since: SinceSummary; engine: BaseEngine }) {
  const stats: [number | string, string][] = [[s.verified, 'verified'], [s.waiting, 'waiting for you'], [s.lost, 'lost'], [s.rules, 'handled by rules'], [`${s.pressure}%`, 'pressure added']];
  return (
    <div className="base-overlay">
      <h2>Since you left</h2>
      <div className="stats">{stats.map(([v, l]) => <div key={l}><b>{v}</b>{l}</div>)}</div>
      <ol>{s.items.map((i, k) => <li key={k} className={`f-${i.kind}`}><time>{fmtClock(i.t - s.t0)}</time>{i.msg}</li>)}</ol>
      <button type="button" onClick={() => engine.closeSince()}>Back to work</button>
    </div>
  );
}
