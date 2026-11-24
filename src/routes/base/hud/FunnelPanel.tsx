import type { BaseEngine } from '../engine/engine';
import type { FunnelView } from '../hudState';
import { FUNNEL_COLS, FUNNEL_H, FUNNEL_W, funnelRow, funnelSegment, funnelX } from '../panels';

export function FunnelPanel({ view, engine }: { view: FunnelView; engine: BaseEngine }) {
  const n = view.branches.length;
  return (
    <div className="base-funnel">
      <header>
        <b>{view.title}</b>
        <span>{view.done}/{view.total} verified · merged, deployed and verified are different states</span>
        <button type="button" onClick={() => engine.closePanels()}>Close · Esc</button>
      </header>
      <svg viewBox={`0 0 ${FUNNEL_W} ${FUNNEL_H}`}>
        {FUNNEL_COLS.map((c, i) => (
          <g key={c}>
            <text x={funnelX(i)} y={40} className="col">{c}</text>
            <line x1={funnelX(i)} x2={funnelX(i)} y1={52} y2={FUNNEL_H - 20} className="grid" />
          </g>
        ))}
        {view.branches.map((b, i) => {
          const { y, mid } = funnelRow(n, i);
          return (
            <g key={i} onClick={() => engine.openBranch(b.crateId, b.agentId)}>
              {Array.from({ length: 8 }, (_, k) => {
                const on = k < b.reach;
                return <path key={k} d={funnelSegment(k, y, mid)} style={{ strokeWidth: Math.min(20, 90 / n) }} className={`flow ${on ? (b.done ? 'ok' : 'on') : 'off'}${on && k === b.reach - 1 && b.bad ? ' bad' : ''}`} />;
              })}
              <text x={funnelX(2)} y={y - 13} className="tag">{b.name}: {b.task.slice(0, 26)}{b.rework ? ` · rework ×${b.rework}` : ''}</text>
              {!b.done && <circle cx={funnelX(Math.min(8, b.reach))} cy={y} r={9} className={`head${b.bad ? ' bad' : ''}`} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
