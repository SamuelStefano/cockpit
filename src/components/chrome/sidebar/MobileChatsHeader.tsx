import type { BotView } from '../../../routes/equipe/team-view';
import { Icon, tokens } from '../../primitives';
import { AgentAvatar } from '../rail/AgentAvatar';
import { pendingRequests, requestsLabel } from './mobile-pending';

interface MobileChatsHeaderProps {
  views: BotView[];
  onOpenAgent: (id: string) => void;
  onTeam?: () => void;
}

// Top of the phone's conversations list: one row of agent avatars, and one line
// for what waits on the person, only when something does.
export function MobileChatsHeader({ views, onOpenAgent, onTeam }: MobileChatsHeaderProps) {
  const pending = pendingRequests(views);
  return (
    <div className="shrink-0 px-2.5 pb-1 pt-2">
      {views.length > 0 && (
        <div role="list" aria-label="Agentes" className="scroll-thin -mx-1 flex items-start gap-3 overflow-x-auto px-1 pb-2">
          <span role="listitem" className="flex w-12 shrink-0 flex-col items-center gap-1">
            <span aria-current="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800 text-neutral-100"><Icon name="message" size={18} /></span>
            <span className="text-[11px] font-medium text-neutral-100">Todos</span>
          </span>
          {views.map((v) => (
            <span key={v.bot.id} role="listitem" className="shrink-0">
              <button type="button" onClick={() => onOpenAgent(v.bot.id)} aria-label={v.bot.name} className={`flex w-12 flex-col items-center gap-1 rounded-lg ${tokens.focusRing}`}>
                <AgentAvatar view={v} size={44} />
                <span className="w-full truncate text-center text-[11px] text-neutral-400">{v.bot.name}</span>
              </button>
            </span>
          ))}
        </div>
      )}
      {pending > 0 && onTeam && (
        <button type="button" onClick={onTeam} className={`flex h-9 w-full items-center gap-2 rounded-lg bg-orange-500/10 px-2.5 text-left text-[13px] text-orange-200 ${tokens.focusRing}`}>
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />
          <span className="min-w-0 flex-1 truncate">{requestsLabel(pending)}</span>
          <Icon name="chevronRight" size={14} />
        </button>
      )}
    </div>
  );
}
