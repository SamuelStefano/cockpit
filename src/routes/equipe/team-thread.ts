import type { Message } from '../../data/types';
import { teamPromptSender } from '../../../shared/team-messages';

// A delivered team message lands in the recipient's thread as a user turn; the
// thread shows it as traffic (an inline pill) instead of a human bubble.
export function isTeamPromptMessage(m: Message): boolean {
  return m.role === 'user' && teamPromptSender(m.text) !== undefined;
}

export function threadAnchors(messages: Message[]): number[] {
  return messages.flatMap((m) => (!isTeamPromptMessage(m) && typeof m.ts === 'number' ? [m.ts] : []));
}

export function trafficParticipants(items: { from: string; to: string }[]): string[] {
  return [...new Set(items.flatMap((m) => [m.from, m.to]))];
}

export function trafficLabel(count: number, names: string[]): string {
  const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names[0] ?? '';
  return `${count} ${count === 1 ? 'mensagem' : 'mensagens'} entre ${who}`;
}
