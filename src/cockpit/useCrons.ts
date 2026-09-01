import { useCallback, useState } from 'react';
import type { ClientMsg, Cron, ServerMsg } from '../../shared/protocol';

export interface Crons {
  crons: Cron[];
  cronsLoaded: boolean;
  onCronsGet: () => void;
  onCronSave: (cron: Cron) => void;
  onCronDelete: (id: string) => void;
  onCronRun: (id: string) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useCrons(send: (m: ClientMsg) => boolean): Crons {
  const [crons, setCrons] = useState<Cron[]>([]);
  const [cronsLoaded, setCronsLoaded] = useState(false);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'crons') return false;
    setCrons(msg.items);
    setCronsLoaded(true);
    return true;
  }, []);

  return {
    crons,
    cronsLoaded,
    onCronsGet: useCallback(() => { send({ t: 'crons-get' }); }, [send]),
    onCronSave: useCallback((cron: Cron) => { send({ t: 'cron-save', cron }); }, [send]),
    onCronDelete: useCallback((id: string) => { send({ t: 'cron-delete', id }); }, [send]),
    onCronRun: useCallback((id: string) => { send({ t: 'cron-run', id }); }, [send]),
    onMsg,
  };
}
