import type { TeamBot } from '../../../shared/protocol';
import type { TeamState, TeamStateBot, TeamStateFollowUp } from '../../../shared/team-state';

const MIN = 60_000;
const HOUR = 3_600_000;

// "há 12 min" / "há 5 h" / "há 2 d"
export function ago(ms: number): string {
  const m = Math.max(0, Math.round(ms / MIN));
  if (m < 60) return `há ${Math.max(1, m)} min`;
  const h = Math.round(ms / HOUR);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

export interface TeamSections {
  waiting: TeamStateBot[];
  working: TeamStateBot[];
  idle: number;
}

export function sectionsOf(state: TeamState): TeamSections {
  return {
    waiting: state.bots.filter((b) => b.status === 'waiting'),
    working: state.bots.filter((b) => b.status === 'working'),
    idle: state.bots.filter((b) => b.status === 'idle').length,
  };
}

export const followUpKey = (f: TeamStateFollowUp): string => `${f.from}>${f.to}@${f.at}`;

export function nameOf(state: TeamState, id: string): string {
  return state.bots.find((b) => b.id === id)?.name ?? id;
}

export const primaryBot = (bots: TeamBot[]): TeamBot | undefined => bots.find((b) => b.primary);

// The nudge sent to the bot that owes an answer. Names only: the stored preview is
// the sender's own text and is not repeated here.
export function nudgeText(fromName: string, toName: string, waited: string): string {
  return `Cobrança: ${fromName} aguarda a sua resposta ${waited}. ${toName}, responda ou diga o que falta.`;
}
