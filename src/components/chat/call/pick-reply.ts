import type { Message } from '../../../data/types';
import { toSpokenSummary } from './utterance';

// Latest assistant answer since the last user message that has speakable final text.
// Error and notice bubbles (offline, queue, refused) are never read out loud.
export function pickSpokenReply(messages: Message[]): { id: string; text: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user') return null;
    if (m.role !== 'assistant' || m.error || m.notice) continue;
    const text = toSpokenSummary(m.blocks);
    if (text) return { id: m.id, text };
  }
  return null;
}
