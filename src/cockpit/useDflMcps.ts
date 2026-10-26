import { useCallback, useEffect, useRef, useState } from 'react';
import type { DflMcpsState } from '../../shared/dfl-mcps';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { toast } from '../components/primitives/toast-bus';

export interface DflMcps {
  dflMcps: DflMcpsState | null;
  dflMcpsBusy: boolean;
  onDflMcpsGet: () => void;
  onDflMcpsAdd: (hosts?: string[]) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

// `claude mcp list` health-checks every server; an older server never answers
// the frame at all, and the card would spin forever.
const BUSY_TIMEOUT_MS = 90_000;

export function useDflMcps(send: (m: ClientMsg) => boolean): DflMcps {
  const [dflMcps, setState] = useState<DflMcpsState | null>(null);
  const [dflMcpsBusy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const begin = useCallback((m: ClientMsg) => {
    if (!send(m)) return;
    setBusy(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBusy(false), BUSY_TIMEOUT_MS);
  }, [send]);

  const onDflMcpsGet = useCallback(() => begin({ t: 'dfl-mcps-get' }), [begin]);
  const onDflMcpsAdd = useCallback((hosts: string[] = []) => begin({ t: 'dfl-mcps-add', hosts }), [begin]);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'dfl-mcps') return false;
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
    setState(msg.state);
    if (msg.state.op) toast(msg.state.op.message, { tone: msg.state.op.ok ? 'ok' : 'error' });
    return true;
  }, []);

  return { dflMcps, dflMcpsBusy, onDflMcpsGet, onDflMcpsAdd, onMsg };
}
