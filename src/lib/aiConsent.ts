import { inShell } from './shell';

const key = (accountId: string) => `deck.ai-consent.${accountId}`;

// Store rule 5.1.2(i): in the shell, the first prompt of an account waits for a
// stored "Concordo". Stored per account, so a second account on the same phone asks again.
export function needsAiConsent(accountId: string | undefined, store: Pick<Storage, 'getItem'> = localStorage): boolean {
  if (!inShell()) return false;
  try { return store.getItem(key(accountId ?? 'local')) !== '1'; } catch { return true; }
}

export function recordAiConsent(accountId: string | undefined, store: Pick<Storage, 'setItem'> = localStorage): void {
  try { store.setItem(key(accountId ?? 'local'), '1'); } catch { /* storage blocked: asked again next time */ }
}
