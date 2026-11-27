import { useMemo, useState } from 'react';
import { groupByDepartment } from '../../../../shared/departments';
import type { BotView } from '../../../routes/equipe/team-view';
import { Popover, tokens } from '../../primitives';
import { BOT_STATE_LABEL } from '../../team/botState';
import { AgentAvatar } from './AgentAvatar';
import { SpaceButton } from './SpaceButton';
import { SpaceTile } from './SpaceTile';

interface AgentOverflowProps {
  hidden: number;
  views: BotView[];
  selectedId: string | null;
  onOpen: (id: string) => void;
}

export function AgentOverflow({ hidden, views, selectedId, onOpen }: AgentOverflowProps) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupByDepartment(views, (v) => v.bot.department), [views]);
  const content = (
    <div className="w-64 p-1.5">
      {groups.map((g) => (
        <section key={g.department?.id ?? 'none'} aria-label={g.department?.name ?? 'Sem setor'}>
          <div className="px-2 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-(--text-muted)">{g.department?.name ?? 'Sem setor'}</div>
          {g.items.map((v) => (
            <button
              key={v.bot.id} type="button" aria-label={v.bot.name} aria-current={v.bot.id === selectedId ? 'true' : undefined}
              onClick={() => { setOpen(false); onOpen(v.bot.id); }}
              className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] ${tokens.focusRing} ${v.bot.id === selectedId ? 'bg-(--accent-tint) text-(--text)' : 'text-(--text-body) hover:bg-neutral-800 hover:text-(--text)'}`}
            >
              <AgentAvatar view={v} size={26} />
              <span className="min-w-0 flex-1 truncate">{v.bot.name}</span>
              <span className="shrink-0 text-[11px] text-(--text-muted)">{v.pending ? 'esperando você' : v.unread && v.state === 'idle' ? 'mensagem nova' : BOT_STATE_LABEL[v.state]}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
  return (
    <Popover open={open} onClose={() => setOpen(false)} content={content} side="right" align="start" label="Todos os agentes">
      <SpaceButton label={`Mais ${hidden} agentes`} onClick={() => setOpen((o) => !o)} haspopup expanded={open}>
        <SpaceTile>+{hidden}</SpaceTile>
      </SpaceButton>
    </Popover>
  );
}
