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

  // Desmarcadas nesta rodada. Guarda as EXCLUÍDAS (não as escolhidas) pra uma
  // candidata que entra depois de trocar o corte já nascer marcada. Zera ao abrir.
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  useEffect(() => { if (open) setExcluded(new Set()); }, [open]);
  const toggle = (id: string) => setExcluded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selected = useMemo(() => candidates.filter((s) => !excluded.has(s.id)).map((s) => s.id), [candidates, excluded]);

  // Fecha sozinho quando o afunilamento TERMINA (busy true → false): sem isso o
  // modal ficaria em cima de uma lista que já mudou.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) setOpen(false);
    wasBusy.current = !!busy;
  }, [busy]);

  return { open, setOpen, idleDays, setIdleDays, candidates, now, excluded, toggle, selected };
}
