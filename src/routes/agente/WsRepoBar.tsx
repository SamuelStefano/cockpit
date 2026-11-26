import { useState } from 'react';
import type { AgentHistoryApi } from '../../cockpit/useAgentHistory';
import { Button } from '../../components/primitives';
import { WsConnectModal } from './WsConnectModal';
import { wsStatusLine } from './ws-status';

interface WsRepoBarProps { botId: string; api: AgentHistoryApi; isAdmin: boolean; now: number }

export function WsRepoBar({ botId, api, isAdmin, now }: WsRepoBarProps) {
  const [connecting, setConnecting] = useState(false);
  const conflicts = api.wsConflicts.filter((c) => c.botId === botId);
  const repo = api.wsStatus?.repo;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-neutral-400" data-testid="ws-status">{wsStatusLine(api.wsStatus, now)}</span>
        {isAdmin && repo && <Button size="xs" variant="outline" icon="link" onClick={api.onWsSync}>Sincronizar</Button>}
        {isAdmin && !repo && <Button size="xs" variant="outline" icon="gitPullRequest" onClick={() => setConnecting(true)}>Conectar GitHub</Button>}
      </div>
      {conflicts.map((c) => (
        <p key={c.path} role="status" className="rounded-md border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-[12px] text-amber-200">
          Conflito em {c.path}: mantivemos a versão do Deck; a do GitHub está ao lado como cópia “.remote”.
        </p>
      ))}
      {isAdmin && <WsConnectModal open={connecting} onClose={() => setConnecting(false)} api={api} />}
    </div>
  );
}
