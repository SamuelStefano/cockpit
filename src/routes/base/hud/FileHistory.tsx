import { DiffView } from '../../../components/chat/DiffView';
import { baseName, plural } from '../activity';
import type { FileGroup } from '../activityView';
import { isNewSince } from '../seenStore';
import { hhmm } from './FeedRow';

interface Props { groups: FileGroup[]; open: ReadonlySet<string>; onToggle: (id: string) => void; seenAt: number | undefined }

// One row per file; the diffs only mount once the row is open.
export function FileHistory({ groups, open, onToggle, seenAt }: Props) {
  return (
    <>
      {groups.map((g) => {
        const id = `file:${g.path}`, isOpen = open.has(id);
        return (
          <li key={g.path} className="row k-file group">
            <button type="button" aria-expanded={isOpen} onClick={() => onToggle(id)}>
              <i aria-hidden="true">✎</i>
              <b>{baseName(g.path)}</b>
              <span title={g.path}>{g.path}</span>
              {g.items.some((it) => isNewSince(seenAt, it.ts)) && <em className="new">new</em>}
              {g.failed > 0 && <em className="bad">{g.failed} failed</em>}
              <small>{plural(g.edits, 'change')}</small>
            </button>
            {isOpen && (
              <ol className="attempts">
                {g.items.map((it, i) => (
                  <li key={`${it.id}-${i}`} className={it.status === 'error' ? 'err' : ''}>
                    <p><b>{it.verb}</b>{it.status === 'error' && <em> failed</em>} <time>{hhmm(it.ts)}</time></p>
                    {it.tool?.diff && <DiffView diff={it.tool.diff} />}
                  </li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
      {!groups.length && <li className="none">No file changes yet.</li>}
      <li className="note">Files written by subagents or shell commands are not listed.</li>
    </>
  );
}
