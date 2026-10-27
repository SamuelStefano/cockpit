import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessagesQuery } from '../../cockpit/useTeam';

// The bot↔bot conversation opened from a traffic marker, on top of the agent's thread.
export function usePeerSelection(botId: string, bots: TeamBot[], connected: boolean, onTeamMessagesGet: (q?: TeamMessagesQuery) => void) {
  useEffect(() => { if (connected) onTeamMessagesGet(); }, [connected, onTeamMessagesGet]);
  const byId = useMemo(() => new Map(bots.map((b) => [b.id, b])), [bots]);
  const [peerId, setPeerId] = useState<string | null>(null);
  const peer = peerId && peerId !== botId ? byId.get(peerId) ?? null : null;
  const openPeer = useCallback((id: string) => {
    onTeamMessagesGet({ botId, peer: id });
    setPeerId(id);
  }, [botId, onTeamMessagesGet]);
  const closePeer = useCallback(() => setPeerId(null), []);
  return { byId, peer, openPeer, closePeer };
}
