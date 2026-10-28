import { useEffect } from 'react';
import { ThreadPane } from './equipe/ThreadPane';
import { BotComputerProvider } from './equipe/computer-context';
import type { EquipeProps } from './equipe/equipe-props';

// An agent's thread in the chat's own center. Its profile is the /agentes/:id page.
export function Equipe(p: EquipeProps) {
  const { view, isMobile, profileOpen } = p;
  const { connected, onTeamMessagesGet } = p;
  useEffect(() => { if (connected) onTeamMessagesGet(); }, [connected, onTeamMessagesGet]);
  return (
    <BotComputerProvider bot={view.bot} state={view.state} api={p} term={p.term} connected={p.connected} isAdmin={p.isAdmin} isMobile={isMobile}>
      <div className="flex h-full min-h-0 min-w-0 flex-1">
        <main className="min-w-0 flex-1">
          <ThreadPane view={view} p={p} onProfile={p.onToggleProfile} profileOpen={profileOpen} />
        </main>
      </div>
    </BotComputerProvider>
  );
}
