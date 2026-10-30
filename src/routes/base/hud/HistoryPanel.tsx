import type { BaseEngine } from '../engine/engine';
import { fmtClock, type HudState } from '../hudState';
import type { FeedItem } from '../sim-types';

const ICON: Record<FeedItem['kind'], string> = { alert: '▲', you: '➤', rule: '⚙', good: '★', bad: '✖', info: '·' };

export function HistoryPanel({ hud, engine }: { hud: HudState; engine: BaseEngine }) {
  const items = hud.feed.slice(-60).reverse();
  return (
    <div className="base-history">
      <ul>
        {items.map((f, i) => (
          <li key={`${f.t}-${i}`} className={`f-${f.kind}`} onClick={() => f.pos && engine.flyTo(f.pos)}>
            <time>{fmtClock(f.t)}</time><i>{ICON[f.kind]}</i>{f.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
