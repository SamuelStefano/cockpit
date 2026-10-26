import type { Message } from '../../shared/protocol';
import { stripLongContext } from '../../shared/long-context';

export function lastAssistantModel(messages: readonly Message[] | undefined): string | null {
  if (!messages) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant' && m.model) return stripLongContext(m.model);
  }
  return null;
}

// The model the NEXT turn of a session runs on: the user's explicit pick, else the
// model the session last ran on (it may have been created elsewhere, e.g. by a
// task), else the global default seed. Display and send must share this.
export function resolveSessionModel(override: string | undefined, messages: readonly Message[] | undefined, defaultModel: string): string {
  return override ?? lastAssistantModel(messages) ?? defaultModel;
}
