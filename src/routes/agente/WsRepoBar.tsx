import type { AgentHistoryApi } from '../../cockpit/useAgentHistory';
import { wsStatusLine } from './ws-status';

interface WsRepoBarProps { botId: string; api: AgentHistoryApi; isAdmin: boolean; now: number }

export function WsRepoBar({ api, now }: WsRepoBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] text-neutral-400" data-testid="ws-status">{wsStatusLine(api.wsStatus, now)}</span>
    </div>
  );
}
