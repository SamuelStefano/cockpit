import { useCallback, useState } from 'react';
import type { BotComputer, ClientMsg, ServerMsg } from '../../shared/protocol';

export type BotComputerState = { status: 'ok'; computer: BotComputer } | { status: 'error'; error: string };

export interface BotComputers {
  botComputers: Record<string, BotComputerState>;
  onBotComputerGet: (botId: string) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useBotComputer(send: (m: ClientMsg) => boolean): BotComputers {
  const [botComputers, setBotComputers] = useState<Record<string, BotComputerState>>({});
  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'team-computer') return false;
    const v: BotComputerState = msg.computer ? { status: 'ok', computer: msg.computer } : { status: 'error', error: msg.error ?? 'indisponível' };
    setBotComputers((prev) => ({ ...prev, [msg.botId]: v }));
    return true;
  }, []);
  const onBotComputerGet = useCallback((botId: string) => { send({ t: 'team-computer-get', botId }); }, [send]);
  return { botComputers, onBotComputerGet, onMsg };
}
