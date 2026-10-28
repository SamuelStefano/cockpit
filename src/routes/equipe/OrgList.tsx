import { Icon } from '../../components/primitives';
import { Mascot } from '../../components/team/Mascot';
import { LivingPhrase } from '../../components/team/LivingPhrase';
import type { BotView } from './team-view';
import { buildOrgTree, type OrgBranch } from './org-tree';

interface OrgListProps {
  views: BotView[];
  onOpen: (id: string) => void;
}

export function flattenOrg(branches: OrgBranch[], depth = 0): { view: BotView; depth: number }[] {
  return branches.flatMap((b) => [{ view: b.view, depth }, ...flattenOrg(b.children, depth + 1)]);
}

function Row({ view, depth, onOpen }: { view: BotView; depth: number; onOpen: (id: string) => void }) {
  const { bot, state } = view;
  const live = state === 'thinking' || state === 'working';
  return (
    <li>
      <button
        type="button" onClick={() => onOpen(bot.id)} aria-label={`Abrir ${bot.name}`}
        style={{ paddingLeft: 4 + depth * 12 }}
        className="flex h-14 w-full items-center gap-3 border-t border-neutral-800/70 pr-1 text-left active:bg-neutral-900/60"
      >
        <Mascot mascot={bot.mascot} state={state} size={32} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 text-[14px] font-medium text-neutral-100">
            <span className="truncate">{bot.name}</span>
            {bot.primary && <Icon name="star" size={12} className="shrink-0 fill-orange-500 text-orange-500" />}
          </span>
          <span className="truncate text-[12px] text-neutral-500">
            {live
              ? <LivingPhrase active startedAt={view.startedAt} />
              : view.pending ? 'Esperando você' : state === 'idle' ? 'Livre' : view.preview}
          </span>
        </span>
        <Icon name="chevronRight" size={14} className="shrink-0 text-neutral-600" />
      </button>
    </li>
  );
}

export function OrgList({ views, onOpen }: OrgListProps) {
  const rows = flattenOrg(buildOrgTree(views));
  if (rows.length === 0) return null;
  return (
    <ul aria-label="Agentes da equipe" className="border-b border-neutral-800/70">
      {rows.map((r) => <Row key={r.view.bot.id} view={r.view} depth={r.depth} onOpen={onOpen} />)}
    </ul>
  );
}
