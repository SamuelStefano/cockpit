import type { Message } from '../../data/types';
import { teamPromptSender } from '../../../shared/team-messages';

// A delivered team message lands in the recipient's thread as a user turn; the
// thread shows it as traffic (chip or separator) instead of a human bubble.
export function isTeamPromptMessage(m: Message): boolean {
  return m.role === 'user' && teamPromptSender(m.text) !== undefined;
}

export function threadAnchors(messages: Message[]): number[] {
  return messages.flatMap((m) => (!isTeamPromptMessage(m) && typeof m.ts === 'number' ? [m.ts] : []));
}

export function messageSnippet(text: string, max = 80): string {
  const one = text.replace(/\s+/g, ' ').trim();
  if (!one) return '';
  return one.length > max ? `${one.slice(0, max).trimEnd()}…` : one;
}
