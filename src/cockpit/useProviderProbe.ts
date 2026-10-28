import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import type { ProbeResult } from '../../shared/provider-probe';

export interface ProviderProbeApi {
  probeResult: ProbeResult | null;
  probeBusy: boolean;
  onProviderProbe: (endpoint: string, key?: string) => boolean;
  onProviderProbeReset: () => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export type ProviderProbeView = Omit<ProviderProbeApi, 'onMsg'>;

export function useProviderProbe(send: (m: ClientMsg) => boolean): ProviderProbeApi {
  const [probeResult, setResult] = useState<ProbeResult | null>(null);
  const [probeBusy, setBusy] = useState(false);
  const onProviderProbe = useCallback((endpoint: string, key?: string) => {
    setResult(null);
    const ok = send({ t: 'provider-probe', endpoint, ...(key ? { key } : {}) });
    if (ok) setBusy(true);
    else setResult({ ok: false, error: 'Sem conexão com o Deck agora.' });
    return ok;
  }, [send]);
  const onProviderProbeReset = useCallback(() => { setResult(null); setBusy(false); }, []);
  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'provider-probe') return false;
    setResult(msg.result);
    setBusy(false);
    return true;
  }, []);
  return { probeResult, probeBusy, onProviderProbe, onProviderProbeReset, onMsg };
}
