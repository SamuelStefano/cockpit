import { Suspense } from 'react';
import type { ModelInfo, TeamBot, TeamBotInput } from '../../shared/protocol';
import type { BotFormTarget } from '../routes/equipe/equipe-props';
import { BotForm } from './lazyRoutes';

interface AgentFormHostProps {
  target: BotFormTarget;
  bots: TeamBot[];
  models: ModelInfo[];
  isAdmin: boolean;
  onSave: (bot: TeamBotInput) => void;
  onClose: () => void;
}

// The new/edit agent form, reachable from the sidebar on any route.
export function AgentFormHost({ target, bots, models, isAdmin, onSave, onClose }: AgentFormHostProps) {
  if (!target) return null;
  const bot = target.mode === 'edit' ? target.bot : null;
  return (
    <Suspense fallback={null}>
      <BotForm key={bot?.id ?? 'new'} bot={bot} bots={bots} models={models} locked={!isAdmin} onSave={onSave} onClose={onClose} />
    </Suspense>
  );
}
