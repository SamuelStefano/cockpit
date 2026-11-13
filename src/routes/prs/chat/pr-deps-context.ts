import { createContext } from 'react';
import type { PrActionDeps } from '../usePrActions';

// What the chat header needs to offer PR actions without threading four props
// through Chat. Absent (tests, non-owner accounts) means no PR button at all: the
// PR frames are owner-only on the server.
export interface ChatPrDeps extends PrActionDeps { onAllPrs: () => void; connected: boolean }

export const ChatPrDepsContext = createContext<ChatPrDeps | null>(null);
