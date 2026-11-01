import type { ActivityFilter } from '../activity';
import { safeUrl } from './safeUrl';
import type { LiveSource } from '../useLiveFeed';
import { BoxSection } from './BoxSection';
import { FeedList } from './FeedList';
import { LiveStats } from './LiveStats';
import { TaskProgress } from './TaskProgress';
import { useLiveDetail } from './useLiveDetail';

const FILTERS: [ActivityFilter, string][] = [['all', 'Everything'], ['file', 'Files'], ['command', 'Commands'], ['agent', 'Agents'], ['talk', 'Chat']];

interface Props { sessionId: string; running: boolean; source: LiveSource; onStep: (dir: 1 | -1) => void }

export function LiveDetail({ sessionId, running, source, onStep }: Props) {
  const d = useLiveDetail(sessionId, running, source);
  const cards = source.boardLoaded ? source.board.cards.filter((c) => c.sessionIds.includes(sessionId)) : [];
  const prs = (source.peeks[sessionId]?.prs ?? []).filter((p) => safeUrl(p.url));
  return (
    <div className="base-live-detail">
      <div className="head">
        <button type="button" aria-label="Previous desk" title="Previous desk [" onClick={() => onStep(-1)}>‹</button>
        <button type="button" aria-label="Next desk" title="Next desk ]" onClick={() => onStep(1)}>›</button>
        {d.elapsed && <span>Turn running for {d.elapsed}</span>}
        {d.quiet && <span className="quiet">{d.quiet}</span>}
      </div>
      <BoxSection cards={cards} prs={prs} sum={d.sum} loaded={!!d.thread} />
      {d.progress && <TaskProgress label={d.progress} />}
      <LiveStats sum={d.sum} subagents={d.subagents} failedOnly={d.failedOnly} onToggleFailed={d.toggleFailed} />
      <div className="filters" role="tablist">
        {FILTERS.map(([k, l]) => <button type="button" role="tab" aria-selected={d.filter === k} key={k} className={d.filter === k ? 'sel' : ''} onClick={() => d.pickFilter(k)}>{l}</button>)}
      </div>
      {d.fresh > 0 && <button type="button" className="fresh" onClick={d.release}>{d.fresh} new, back to top</button>}
      <ol className="feed" ref={d.feedRef} onScroll={d.onScroll}>
        <FeedList view={d.view} loaded={!!d.thread} open={d.open} onToggle={d.toggle} seenAt={d.seenAt} sessionRunning={running} />
      </ol>
    </div>
  );
}
