import type { Session } from '../../../data/types';
import type { BotView } from '../../../routes/equipe/team-view';
import { Badge, Button, Icon, IconButton, tokens } from '../../primitives';
import { AgentAvatar } from './AgentAvatar';
import { agentMeta, agentThreads, isBusy } from './agent-space';
import { RotateAgentButton } from './RotateAgentButton';

interface AgentSpaceSideProps {
  view: BotView;
  chief: boolean;
  sessions: Session[];
  activeSessionId: string;
  running?: Set<string>;
  onOpenThread: (botId: string) => void;
  onSelectSession: (id: string) => void;
  onRotate?: (botId: string) => void;
  onWorkspace: (botId: string) => void;
  onProfile: (botId: string) => void;
  onCollapse: () => void;
  onNew: () => void;
}

const row = `flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${tokens.focusRing}`;
const groupLabel = 'px-2 pb-1 pt-3.5 text-[11px] font-medium uppercase tracking-[0.06em] text-(--text-muted)';

export function AgentSpaceSide({ view, chief, sessions, activeSessionId, running, onOpenThread, onSelectSession, onRotate, onWorkspace, onProfile, onCollapse, onNew }: AgentSpaceSideProps) {
  const { bot } = view;
  const threads = agentThreads(view, sessions);
  const meta = agentMeta(bot);
  return (
    <>
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-(--border) px-3.5 pb-3.5 pt-4">
        <div className="flex items-center gap-2.5">
          <AgentAvatar view={view} size={48} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-1.5">
              <h2 className="truncate text-[15px] font-semibold text-(--text)">{bot.name}</h2>
              {chief && <Badge tone="orange">chefe</Badge>}
            </div>
            {meta && <span className="truncate text-[12px] text-(--text-muted)">{meta}</span>}
          </div>
          <IconButton icon="squarePen" label="Nova conversa" size="sm" side="bottom" onClick={onNew} />
          <IconButton icon="panelLeft" label="Recolher barra lateral" size="sm" side="bottom" aria-expanded onClick={onCollapse} />
        </div>
        {bot.label && <p className="text-[13px] leading-snug text-(--text-strong)">{bot.label}</p>}
        <div className="flex items-center gap-2">
          {onRotate && <RotateAgentButton busy={isBusy(view)} onConfirm={() => onRotate(bot.id)} />}
          <Button variant="secondary" size="sm" icon="file" onClick={() => onWorkspace(bot.id)}>Workspace</Button>
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <div className={groupLabel}>Conversas</div>
        {threads.map((t) => {
          const live = !!running?.has(t.id);
          const on = t.id === activeSessionId;
          return (
            <button
              key={t.id} type="button" aria-current={on ? 'true' : undefined}
              onClick={() => (t.current ? onOpenThread(bot.id) : onSelectSession(t.id))}
              className={`${row} ${on ? 'bg-(--accent-tint)' : 'hover:bg-neutral-800'}`}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] text-(--text)">{t.title}</span>
                <span className="text-[11.5px] text-(--text-muted)">{t.current ? `Atual · ${t.when}` : t.when}</span>
              </span>
              {live && <span role="img" aria-label="trabalhando" className="h-2 w-2 shrink-0 rounded-full bg-(--ok)" />}
            </button>
          );
        })}
        <div className={groupLabel}>Workspace</div>
        <button type="button" onClick={() => onWorkspace(bot.id)} className={`${row} text-[13px] text-(--text-body) hover:bg-neutral-800`}>
          <Icon name="file" size={15} />Arquivos do agente
        </button>
        <button type="button" onClick={() => onProfile(bot.id)} aria-label="Perfil do agente" className={`${row} text-[13px] text-(--text-body) hover:bg-neutral-800`}>
          <Icon name="user" size={15} />Perfil
        </button>
      </div>
      <div className="flex min-h-13 shrink-0 items-center border-t border-(--border) px-3 py-2.5">
        <span className="text-[12px] text-(--text-muted)">Só local, sem histórico no GitHub</span>
      </div>
    </>
  );
}
