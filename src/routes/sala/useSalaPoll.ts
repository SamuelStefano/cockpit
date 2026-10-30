import { useEffect } from 'react';

const POLL_MS = 4000;

export function useSalaPoll(input: {
  connected: boolean;
  botIds: string[];
  sessionIds: string[];
  onComputer: (botId: string) => void;
  onPeek: (sessionId: string) => void;
}): void {
  const bots = input.botIds.join(',');
  const sessions = input.sessionIds.join(',');
  const { connected, onComputer, onPeek } = input;
  useEffect(() => {
    if (!connected) return;
    const tick = () => {
      for (const id of bots.split(',').filter(Boolean)) onComputer(id);
      for (const id of sessions.split(',').filter(Boolean)) onPeek(id);
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(timer);
  }, [connected, bots, sessions, onComputer, onPeek]);
}
