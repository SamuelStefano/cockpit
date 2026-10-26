import { createContext, useContext, type ReactNode } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import type { MascotState } from '../../components/team/mascot-state';
import type { TermApi } from '../../cockpit/useTerminals';
import type { BotComputerApi } from './equipe-props';
import { useBotComputerTab } from './useBotComputerTab';
import { ComputerTakeover } from './ComputerTakeover';

type Tab = ReturnType<typeof useBotComputerTab>;

export interface ComputerCtx extends Tab {
  bot: TeamBot;
  state: MascotState;
  term: TermApi;
  connected: boolean;
  isAdmin: boolean;
  isMobile: boolean;
}

const Ctx = createContext<ComputerCtx | null>(null);

interface ProviderProps {
  bot: TeamBot;
  state: MascotState;
  api: BotComputerApi;
  term: TermApi;
  connected: boolean;
  isAdmin: boolean;
  isMobile: boolean;
  children: ReactNode;
}

export function BotComputerProvider({ bot, state, api, term, connected, isAdmin, isMobile, children }: ProviderProps) {
  const tab = useBotComputerTab(bot.id, api, connected, state);
  const value: ComputerCtx = { ...tab, bot, state, term, connected, isAdmin, isMobile };
  return (
    <Ctx.Provider value={value}>
      {children}
      {tab.takenOver && isAdmin && <ComputerTakeover bot={bot} term={term} onRelease={tab.release} />}
    </Ctx.Provider>
  );
}

export function useComputer(): ComputerCtx | null {
  return useContext(Ctx);
}
