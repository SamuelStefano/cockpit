import type { WsCommit } from '../../../shared/protocol';
import { Badge, tokens } from '../../components/primitives';
import { ago } from '../equipe-home/team-home';

interface CommitListProps { commits: WsCommit[]; selected: string | null; onSelect: (hash: string) => void; now: number }

export function CommitList({ commits, selected, onSelect, now }: CommitListProps) {
  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto lg:max-h-[70vh]" aria-label="Commits">
      {commits.map((c) => (
        <li key={c.hash}>
          <button type="button" onClick={() => onSelect(c.hash)} aria-current={c.hash === selected}
            className={`flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition ${tokens.focusRing} ${c.hash === selected ? 'border-orange-500/40 bg-orange-500/6' : 'border-neutral-800 hover:border-neutral-700'}`}>
            <span className="truncate text-[13px] text-neutral-100">{c.message}</span>
            <span className="flex items-center gap-2 text-[11px] text-neutral-500">
              <code>{c.hash.slice(0, 7)}</code>
              <span>{ago(now - c.at)}</span>
              <Badge>{c.source === 'deck' ? 'Deck' : 'GitHub'}</Badge>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
