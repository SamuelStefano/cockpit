import { useCallback, useEffect, useRef, useState } from 'react';
import type { McpsState } from '../../shared/mcps';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';

export interface Mcps {
  mcps: McpsState | null;
  mcpsBusy: boolean;
  onMcpsGet: () => void;
  onMsg: (msg: ServerMsg) => boolean;
}

// `claude mcp list` health-checks every server; an older server never answers
// the frame at all, and the card would spin forever.
const BUSY_TIMEOUT_MS = 90_000;

export function useMcps(send: (m: ClientMsg) => boolean): Mcps {
  const [mcps, setState] = useState<McpsState | null>(null);
  const [mcpsBusy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onMcpsGet = useCallback(() => {
    if (!send({ t: 'mcps-get' })) return;
    setBusy(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBusy(false), BUSY_TIMEOUT_MS);
  }, [send]);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'mcps') return false;
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
    setState(msg.state);
    return true;
  }, []);

  return { mcps, mcpsBusy, onMcpsGet, onMsg };
}
