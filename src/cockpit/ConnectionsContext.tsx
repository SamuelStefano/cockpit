import { createContext, useContext } from 'react';
import type { Connection } from '../../shared/connections';

export interface ConnectionsCtx {
  connections: Connection[];
  loaded: boolean;
  refresh: () => void;
}

const EMPTY: ConnectionsCtx = { connections: [], loaded: false, refresh: () => {} };

export const ConnectionsContext = createContext<ConnectionsCtx>(EMPTY);
export const useConnectionsCtx = () => useContext(ConnectionsContext);
