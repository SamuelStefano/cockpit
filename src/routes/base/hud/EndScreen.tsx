import type { BaseEngine } from '../engine/engine';
import { fmtClock } from '../hudState';
import type { EndSummary } from '../sim-types';

export function EndScreen({ end: e, engine }: { end: EndSummary; engine: BaseEngine }) {
  const stats: [number | string, string][] = [[e.prs, 'PRs verified'], [fmtClock(e.time), 'shift'], [`${e.peak}%`, 'peak pressure'], [e.handled, 'your decisions'], [e.auto, 'answered by rules'], [e.regressions, 'regressions']];
  return (
    <div className="base-overlay">
      <div className="rank">{e.rank}</div>
      <h2>Shift complete</h2>
      <div className="stats">{stats.map(([v, l]) => <div key={l}><b>{v}</b>{l}</div>)}</div>
      <p>{e.missed ? 'One post missed its slot. ' : ''}Best streak {e.best}. {e.rules} rules carry into the next shift.</p>
      <button type="button" onClick={() => engine.restart()}>Run another shift</button>
    </div>
  );
}
