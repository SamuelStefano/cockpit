import { useCallback, useState } from 'react';
import type { Connection } from '../../shared/connections';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';

export interface ConnectionsApi {
  connections: Connection[];
  loaded: boolean;
  refresh: () => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useConnections(send: (m: ClientMsg) => boolean): ConnectionsApi {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(() => { send({ t: 'connections-get' }); }, [send]);
  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'connections') return false;
    setConnections(msg.items);
    setLoaded(true);
    return true;
  }, []);
  return { connections, loaded, refresh, onMsg };
}
