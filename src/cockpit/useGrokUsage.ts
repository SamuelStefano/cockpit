import { useCallback, useState } from 'react';
import type { ClientMsg, PlanUsage, ServerMsg } from '../../shared/protocol';

export interface GrokUsageState {
  usage: PlanUsage | null;
  blockedUntil: number | null;
  readAt: number | null;
  nextReadAt: number | null;
}

export interface GrokUsage {
  grokUsage: GrokUsageState;
  onRefreshGrokUsage: (force?: boolean) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

const EMPTY: GrokUsageState = { usage: null, blockedUntil: null, readAt: null, nextReadAt: null };

// Mirror of the Claude plan-usage state, fed by its own frame: the two accounts
// are read by separate pollers and one must never overwrite the other's number.
export function useGrokUsage(send: (m: ClientMsg) => boolean): GrokUsage {
  const [grokUsage, setGrokUsage] = useState<GrokUsageState>(EMPTY);
  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'grok-usage') return false;
    setGrokUsage({ usage: msg.usage, blockedUntil: msg.blockedUntil ?? null, readAt: msg.readAt ?? null, nextReadAt: msg.nextReadAt ?? null });
    return true;
  }, []);
  const onRefreshGrokUsage = useCallback((force = false) => { send(force ? { t: 'grok-usage-get', force: true } : { t: 'grok-usage-get' }); }, [send]);
  return { grokUsage, onRefreshGrokUsage, onMsg };
}
