import { useState } from 'react';
import { toast } from '../primitives';
import type { Message } from '../../data/types';
import { SUPABASE_ENABLED } from '../../lib/supabase';
import { createShare, revokeShare, listShares, type StoredShare } from '../../lib/shareService';

const CONFIRM = 'Qualquer pessoa com o link verá esta conversa (sem saídas de ferramentas). Continuar?';

export function useShareConversation(title: string, messages: Message[], sessionId?: string) {
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<StoredShare | null>(() => (sessionId ? listShares().find((s) => s.sessionId === sessionId) ?? null : null));

  const share = async () => {
    if (!sessionId) return;
    // A modal would unmount with the menu that hosts this entry.
    if (!window.confirm(CONFIRM)) return;
    setBusy(true);
    try {
      const s = await createShare(sessionId, title, messages);
      setCurrent(s);
      await navigator.clipboard.writeText(s.url).catch(() => undefined);
      toast('Link copiado');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui compartilhar', { tone: 'error' });
    } finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await revokeShare(current.path);
      setCurrent(null);
      toast('Link revogado');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui revogar', { tone: 'error' });
    } finally { setBusy(false); }
  };

  return { enabled: SUPABASE_ENABLED && !!sessionId, busy, current, share, revoke };
}
