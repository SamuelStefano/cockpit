import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '../../data/types';
import { usePersisted } from '../../lib/persist';
import { FUNNEL_IDLE_KEY, FUNNEL_IDLE_DEFAULT } from '../../lib/prefs';
import { staleSessions } from './stale';

interface Args {
  sessions: Session[];
  pinned: Set<string>;
  running?: Set<string>;
  activeId: string;
  busy?: boolean;
}

const TICK_MS = 600_000; // dia é a menor unidade do corte: re-render de minuto em minuto seria desperdício

export function useFunnel({ sessions, pinned, running, activeId, busy }: Args) {
  const [open, setOpen] = useState(false);
  const [idleDays, setIdleDays] = usePersisted<number>(FUNNEL_IDLE_KEY, FUNNEL_IDLE_DEFAULT);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  // Reancora ao abrir: uma aba deixada aberta a noite toda mostraria o corte de ontem.
  useEffect(() => { if (open) setNow(Date.now()); }, [open]);

  const candidates = useMemo(
    () => staleSessions(sessions, { now, idleDays, pinned, running, activeId }),
    [sessions, now, idleDays, pinned, running, activeId],
  );

  // Fecha sozinho quando o afunilamento TERMINA (busy true → false): sem isso o
  // modal ficaria em cima de uma lista que já mudou.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) setOpen(false);
    wasBusy.current = !!busy;
  }, [busy]);

  return { open, setOpen, idleDays, setIdleDays, candidates, now };
}
