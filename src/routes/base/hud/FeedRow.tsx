import { DiffView } from '../../../components/chat/DiffView';
import { fmtToolDuration } from '../../../components/chat/message-format';
import { baseName, type ActivityItem } from '../activity';

const ICON: Record<ActivityItem['kind'], string> = { file: '✎', command: '$', read: '◌', agent: '◆', web: '◍', tool: '▣', talk: '“' };
const MAX_OUTPUT = 200;
export const hhmm = (ts?: number) => (ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

// Subagent and question rows wait on something else, so their time says nothing about the tool.
const showsDuration = (item: ActivityItem) => item.tool?.durationMs !== undefined && item.kind !== 'agent' && item.tool.name !== 'AskUserQuestion';

function RowBody({ item, name }: { item: ActivityItem; name: string }) {
  const { tool, text } = item;
  return (
    <div className="body">
      {text && <p>{text}</p>}
      {item.kind === 'file' && <code>{item.target}</code>}
      {tool?.diff && <DiffView diff={tool.diff} />}
      {tool?.markdown && <p>{tool.markdown}</p>}
      {tool?.todos && <ul>{tool.todos.map((t, i) => <li key={i}>{t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '▸' : '○'} {t.content}</li>)}</ul>}
      {item.kind !== 'file' && tool?.command && tool.command !== name && <code>{tool.command}</code>}
      {!!tool?.output.length && <pre>{tool.output.slice(-MAX_OUTPUT).join('\n')}</pre>}
    </div>
  );
}

interface Props { item: ActivityItem; open: boolean; onToggle: (id: string) => void; isNew: boolean; sessionRunning: boolean }

export function FeedRow({ item, open, onToggle, isNew, sessionRunning }: Props) {
  const { tool, text } = item;
  const hasBody = !!(text || tool?.diff || tool?.output.length || tool?.markdown || tool?.todos?.length);
  const name = item.kind === 'file' ? baseName(item.target) : item.target;
  // A tool parsed from history is always 'done', and one without a result stays 'running' forever: only a live session can really be running one.
  const running = item.status === 'running' && sessionRunning;
  return (
    <li className={`row k-${item.kind}${item.status === 'error' ? ' err' : ''}${running ? ' run' : ''}`}>
      <button type="button" disabled={!hasBody} aria-expanded={open} onClick={() => onToggle(item.id)}>
        <i aria-hidden="true">{ICON[item.kind]}</i>
        <b>{item.verb}</b>
        <span title={item.target}>{name || (text ? text.slice(0, 90) : '')}</span>
        {isNew && <em className="new">new</em>}
        {item.status === 'error' && <em>failed</em>}
        {running && <em>running</em>}
        {showsDuration(item) && <small>{fmtToolDuration(item.tool!.durationMs!)}</small>}
        <time>{hhmm(item.ts)}</time>
      </button>
      {open && <RowBody item={item} name={name} />}
    </li>
  );
}
