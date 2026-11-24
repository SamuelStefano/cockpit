import type { TeamProfile } from '../../../shared/protocol';

// The promise each profile makes, in one line, for a non-dev reading the bot's profile.
// Must match server/engine/restricted-profile.ts: say only what the code enforces.
export const PROFILE_COPY: Record<TeamProfile, { badge: string; tone: 'yellow' | 'neutral'; line: string }> = {
  restricted: {
    badge: 'travado',
    tone: 'yellow',
    line: 'Lê e escreve só na pasta dele e pesquisa na web. Sem terminal, sem MCPs e sem agente externo.',
  },
  full: {
    badge: 'completo',
    tone: 'neutral',
    line: 'Usa as mesmas ferramentas do chat, terminal incluso.',
  },
};

export const profileCopy = (p: TeamProfile) => PROFILE_COPY[p] ?? PROFILE_COPY.restricted;
