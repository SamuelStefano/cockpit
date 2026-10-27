import { useEffect } from 'react';
import { Drawer } from '../components/primitives';
import { ThreadPane } from './equipe/ThreadPane';
import { BotProfile } from './equipe/BotProfile';
import { BotComputerProvider } from './equipe/computer-context';
import type { EquipeProps } from './equipe/equipe-props';

// An agent's thread in the chat's own center. Its profile replaces the terminals
// on the right (desktop) or slides over the thread (phone).
export function Equipe(p: EquipeProps) {
  const { view, isMobile, profileOpen } = p;
  const { connected, onTeamMessagesGet } = p;
  useEffect(() => { if (connected) onTeamMessagesGet(); }, [connected, onTeamMessagesGet]);
  const profile = (
    <BotProfile view={view} bots={p.bots} models={p.models} onSave={p.onTeamSave} onEdit={p.onEdit} onDelete={p.onTeamDelete}
      onBack={p.onCloseProfile} connected={p.connected} cronApi={p} filesApi={p} />
  );
  return (
    <BotComputerProvider bot={view.bot} state={view.state} api={p} term={p.term} connected={p.connected} isAdmin={p.isAdmin} isMobile={isMobile}>
      <div className="flex h-full min-h-0 min-w-0 flex-1">
        <main className="min-w-0 flex-1">
          <ThreadPane view={view} p={p} onProfile={p.onToggleProfile} profileOpen={profileOpen} />
        </main>
        {profileOpen && !isMobile && <aside aria-label="Perfil do agente" className="w-80 shrink-0 border-l border-neutral-800 bg-neutral-950">{profile}</aside>}
      </div>
      {isMobile && <Drawer open={profileOpen} onClose={p.onCloseProfile} title="Perfil do agente" side="right">{profile}</Drawer>}
    </BotComputerProvider>
  );
}
