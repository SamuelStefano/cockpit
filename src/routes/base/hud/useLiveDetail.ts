import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmtToolDuration } from '../../../components/chat/message-format';
import { activityOf, lastUserTs, newestTs, summaryOf, type ActivityFilter } from '../activity';
import { buildView } from '../activityView';
import { quietLabel, silentFor } from '../liveAdapter';
import { markSeen, readSeen } from '../seenStore';
import { taskProgress, progressLabel } from '../taskProgress';
import { runningAgents, type LiveSource } from '../useLiveFeed';
import { useFrozenFeed } from './useFrozenFeed';
import { useNow } from './useNow';
import { useThreadLoader } from './useThreadLoader';

export const MAX_ROWS = 300;

export function useLiveDetail(sessionId: string, running: boolean, source: LiveSource) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [failedOnly, setFailedOnly] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [scrolled, setScrolled] = useState(false);
  const feedRef = useRef<HTMLOListElement>(null);
  const thread = source.threads[sessionId];
  useThreadLoader(sessionId, thread, running, source.connected, source.onLoadThread);

  const items = useMemo(() => activityOf(thread), [thread]);
  const sum = useMemo(() => summaryOf(items), [items]);
  const view = useMemo(() => buildView(items, filter, failedOnly, MAX_ROWS), [items, filter, failedOnly]);
  const { shown, fresh } = useFrozenFeed({ items, view }, scrolled || open.size > 0);

  const release = useCallback(() => {
    setOpen(new Set());
    setScrolled(false);
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, []);
  const toggle = useCallback((id: string) => setOpen((p) => { const n = new Set(p); if (!n.delete(id)) n.add(id); return n; }), []);
  const pickFilter = (f: ActivityFilter) => { release(); setFilter(f); };
  const toggleFailed = () => { release(); setFailedOnly((v) => !v); };
  const onScroll = () => setScrolled((feedRef.current?.scrollTop ?? 0) > 0);

  // The mark moves when the reader leaves the desk, so "new" means new since they last looked.
  const [seenAt] = useState(() => readSeen()[sessionId]);
  const newest = useRef<number | undefined>(undefined);
  newest.current = newestTs(shown.items);
  useEffect(() => () => { if (newest.current !== undefined) markSeen(sessionId, newest.current); }, [sessionId]);

  const now = useNow(running, 10000);
  const startedAt = running ? lastUserTs(shown.items) : undefined;
  const elapsed = startedAt === undefined ? null : fmtToolDuration(Math.max(0, now - startedAt));
  const quiet = running ? silentFor(source.termStats[sessionId]?.lastAt, now, runningAgents(source.bgAgents?.[sessionId])) : null;
  const progress = taskProgress(source.todos?.[sessionId], running);

  return {
    thread, sum, view: shown.view, fresh, feedRef, filter, pickFilter, failedOnly, toggleFailed, open, toggle, release, onScroll, seenAt,
    elapsed, quiet: quiet === null ? null : quietLabel(quiet), progress: progress ? progressLabel(progress) : null,
    subagents: runningAgents(source.bgAgents?.[sessionId]),
  };
}
