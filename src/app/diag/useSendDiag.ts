import { useCallback, useEffect, useRef, useState } from 'react';
import { recordConnEvent } from '../connectionTelemetry';
import { scheduler, sendDiagReport } from './diagReport';

export type SendDiagState = 'idle' | 'sending' | 'sent' | 'failed' | 'limited';
const RESET_MS = 6_000;

// "Enviar diagnóstico ao admin": one report on demand, with its own hourly cap.
export function useSendDiag(send = sendDiagReport) {
  const [state, setState] = useState<SendDiagState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const settle = (s: SendDiagState) => {
    setState(s);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), RESET_MS);
  };

  const trigger = useCallback(async () => {
    if (!scheduler.manual(Date.now())) { settle('limited'); return; }
    setState('sending');
    recordConnEvent('diag_report', { kind: 'manual' });
    settle((await send('manual', { byUser: true })) ? 'sent' : 'failed');
  }, [send]);

  return { state, trigger };
}
