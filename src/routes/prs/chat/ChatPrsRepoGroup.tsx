import { Icon } from '../../../components/primitives/Icon';
import { PrRow } from '../PrRow';
import { orgOf, repoName, type RepoGroup } from '../prs-view';

interface ChatPrsRepoGroupProps { group: RepoGroup; created: ReadonlySet<string>; selectedUrl: string | null; onSelect: (url: string) => void }

export function ChatPrsRepoGroup({ group, created, selectedUrl, onSelect }: ChatPrsRepoGroupProps) {
  const counts = [group.open && `${group.open} ${group.open === 1 ? 'aberta' : 'abertas'}`, group.merged && `${group.merged} ${group.merged === 1 ? 'mergeada' : 'mergeadas'}`].filter(Boolean).join(' · ');
  return (
    <section>
      <a
        href={`https://github.com/${group.repo}`} target="_blank" rel="noreferrer"
        className="group mb-1.5 flex items-center gap-2 rounded-md px-1 py-1 transition hover:bg-neutral-900"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-300"><Icon name="gitPullRequest" size={14} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-neutral-100">{repoName(group.repo)}</span>
          <span className="block truncate text-[12px] text-neutral-500">{orgOf(group.repo)}{counts && ` · ${counts}`}</span>
        </span>
        <Icon name="external" size={13} className="shrink-0 text-neutral-600 transition group-hover:text-neutral-300" />
      </a>
      <div className="space-y-2">
        {group.prs.map((p) => <PrRow key={p.url} pr={p} active={p.url === selectedUrl} onSelect={onSelect} hideRepo tag={created.has(p.url) ? undefined : 'citada'} />)}
      </div>
    </section>
  );
}
