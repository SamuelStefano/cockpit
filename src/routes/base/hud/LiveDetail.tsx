import { useEffect, useMemo, useState } from 'react';
import { DiffView } from '../../../components/chat/DiffView';
import { activityOf, baseName, filterActivity, summaryOf, type ActivityFilter, type ActivityItem } from '../activity';
import type { LiveSource } from '../useLiveFeed';

const FILTERS: [ActivityFilter, string][] = [['all', 'Everything'], ['file', 'Files'], ['command', 'Commands'], ['agent', 'Agents'], ['talk', 'Chat']];
const ICON: Record<ActivityItem['kind'], string> = { file: '✎', command: '$', read: '◌', agent: '◆', web: '◍', tool: '▣', talk: '“' };
const STATUS_LABEL = { todo: 'To do', doing: 'Doing', review: 'In review', done: 'Done' } as const;
const REFRESH_MS = 8000, MAX_ROWS = 300, MAX_OUTPUT = 200;
const hhmm = (ts?: number) => (ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
const safeUrl = (u: string) => /^https?:\/\//i.test(u);

function Row({ item }: { item: ActivityItem }) {
  const [open, setOpen] = useState(false);
  const { tool, text } = item;
  const hasBody = !!(text || tool?.diff || tool?.output.length || tool?.markdown || tool?.todos?.length);
  const name = item.kind === 'file' ? baseName(item.target) : item.target;
  return (
    <li className={`row k-${item.kind}${item.status === 'error' ? ' err' : ''}${item.status === 'running' ? ' run' : ''}`}>
      <button type="button" disabled={!hasBody} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <i aria-hidden="true">{ICON[item.kind]}</i>
        <b>{item.verb}</b>
        <span title={item.target}>{name || (text ? text.slice(0, 90) : '')}</span>
        {item.status === 'error' && <em>failed</em>}
        {item.status === 'running' && <em>running</em>}
        <time>{hhmm(item.ts)}</time>
      </button>
      {open && (
        <div className="body">
          {text && <p>{text}</p>}
          {item.kind === 'file' && <code>{item.target}</code>}
          {tool?.diff && <DiffView diff={tool.diff} />}
          {tool?.markdown && <p>{tool.markdown}</p>}
          {tool?.todos && <ul>{tool.todos.map((t, i) => <li key={i}>{t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '▸' : '○'} {t.content}</li>)}</ul>}
          {item.kind !== 'file' && tool?.command && tool.command !== name && <code>{tool.command}</code>}
          {!!tool?.output.length && <pre>{tool.output.slice(-MAX_OUTPUT).join('\n')}</pre>}
        </div>
      )}
    </li>
  );
}

export function LiveDetail({ sessionId, running, source }: { sessionId: string; running: boolean; source: LiveSource }) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const { onLoadThread, connected } = source;
  // Load on selection and when a turn ends; only a running session keeps refreshing.
  useEffect(() => {
    if (!connected) return;
    onLoadThread(sessionId);
    if (!running) return;
    const t = window.setInterval(() => { if (!document.hidden) onLoadThread(sessionId); }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [connected, onLoadThread, sessionId, running]);

  const thread = source.threads[sessionId];
  const items = useMemo(() => activityOf(thread), [thread]);
  const sum = useMemo(() => summaryOf(items), [items]);
  const rows = useMemo(() => filterActivity(items, filter).slice(-MAX_ROWS).reverse(), [items, filter]);
  const peek = source.peeks[sessionId];
  const cards = source.boardLoaded ? source.board.cards.filter((c) => c.sessionIds.includes(sessionId)) : [];
  const prs = (peek?.prs ?? []).filter((p) => safeUrl(p.url));
  const hasBox = cards.length > 0 || prs.length > 0 || sum.written.length + sum.edited.length > 0;

  return (
    <div className="base-live-detail">
      <section className="box" aria-label="Linked box">
        <h4>Box</h4>
        {!hasBox && <p className="none">{thread ? 'No box yet: no card, PR or file from this session.' : 'Loading…'}</p>}
        {cards.map((c) => <p key={c.id}><b>{STATUS_LABEL[c.status] ?? c.status}</b> {c.title}</p>)}
        {prs.map((p) => <p key={p.url}><a href={p.url} target="_blank" rel="noreferrer">{p.label}</a></p>)}
        {sum.written.length + sum.edited.length > 0 && <p className="files">{sum.written.length} written · {sum.edited.length} edited</p>}
        {sum.written.slice(-6).map((f) => <p key={f} className="file" title={f}>+ {baseName(f)}</p>)}
      </section>
      <div className="stats">
        <span>{sum.commands} commands</span><span>{sum.reads} reads</span><span>{sum.agents} agents</span>
        {sum.failed > 0 && <span className="bad">{sum.failed} failed</span>}
      </div>
      <div className="filters" role="tablist">
        {FILTERS.map(([k, l]) => <button type="button" role="tab" aria-selected={filter === k} key={k} className={filter === k ? 'sel' : ''} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      <ol className="feed">
        {rows.map((it) => <Row key={it.id} item={it} />)}
        {thread && !rows.length && <li className="none">Nothing here yet.</li>}
        {!thread && <li className="none">Loading activity…</li>}
      </ol>
    </div>
  );
}
