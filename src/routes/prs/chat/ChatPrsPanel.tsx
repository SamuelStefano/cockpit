import { Button } from '../../../components/primitives/Button';
import { Drawer } from '../../../components/primitives/Drawer';
import { EmptyState } from '../../../components/primitives/EmptyState';
import { SkeletonCards } from '../../../components/primitives/SkeletonCards';
import { PrDetailPanel } from '../PrDetailPanel';
import { ChatPrsRepoGroup } from './ChatPrsRepoGroup';
import type { ChatPrDeps } from './pr-deps-context';
import type { useChatPrs } from './useChatPrs';

interface ChatPrsPanelProps { state: ReturnType<typeof useChatPrs>; deps: ChatPrDeps }

export function ChatPrsPanel({ state: s, deps }: ChatPrsPanelProps) {
  const { onAllPrs, ...actions } = deps;
  const close = () => s.setOpen(false);
  const go = (fn: () => void) => () => { close(); fn(); };
  const repos = s.groups.length;

  let list;
  if (s.loading) list = <SkeletonCards count={3} />;
  else if (!repos) {
    list = (
      <EmptyState icon="gitPullRequest" size="sm" title="Nenhuma PR nesta conversa" description={s.error ?? 'Quando a conversa abrir ou citar uma PR, ela aparece aqui com o código.'} />
    );
  } else {
    list = (
      <div className="space-y-5">
        {s.error && <p className="text-[12px] text-red-400">{s.error}</p>}
        {s.groups.map((g) => <ChatPrsRepoGroup key={g.repo} group={g} created={s.created} selectedUrl={s.selectedUrl} onSelect={s.select} />)}
      </div>
    );
  }

  return (
    <Drawer open={s.open} onClose={close} title="Pull requests desta conversa" side="right" width={repos ? 'w-full lg:w-[min(88rem,95vw)]' : 'w-full sm:w-[26rem]'}>
      <div className="flex h-full min-h-0">
        <div className={`scroll-thin flex min-h-0 flex-col overflow-y-auto ${repos ? 'lg:w-[22rem] lg:shrink-0 lg:border-r lg:border-neutral-800/80' : 'w-full'} ${s.selected ? 'hidden lg:flex' : 'w-full'}`}>
          <div className="flex items-center gap-2 px-3 pt-3">
            <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-500">
              {repos > 0 && `${repos} ${repos === 1 ? 'repositório' : 'repositórios'} · ${s.count} ${s.count === 1 ? 'PR' : 'PRs'}`}
            </span>
            <Button variant="ghost" size="xs" square icon="rotate" loading={s.refreshing} onClick={s.refresh} title="Atualizar" aria-label="Atualizar" />
            <Button variant="secondary" size="xs" icon="gitPullRequest" onClick={go(onAllPrs)}>Todas as PRs</Button>
          </div>
          <div className="p-3">{list}</div>
        </div>
        {s.selected && (
          <div className="scroll-thin min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="px-3 pt-3 lg:hidden"><Button variant="ghost" size="xs" icon="chevronLeft" onClick={() => s.select(null)}>Todas desta conversa</Button></div>
            <PrDetailPanel
              key={s.selected.url} pr={s.selected} entry={s.detail} canMerge={s.created.has(s.selected.url)} onRetry={s.retryDetail} hideSessionLink
              onOpenSession={(id) => { close(); actions.onOpenSession(id); }} onSendTo={actions.onSendTo} onLaunchAgent={actions.onLaunchAgent}
            />
          </div>
        )}
      </div>
    </Drawer>
  );
}
