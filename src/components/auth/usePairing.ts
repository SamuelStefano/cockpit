import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { relayHttpBase } from '../../cockpit/session';
import { diagnose, isExpired, remainingMs, fmtCountdown, type RelayProbe, type PairDiagnosis } from './pairing';

// Erros com mensagem própria pro usuário; o resto (TypeError de rede, SyntaxError
// de JSON) vira uma mensagem genérica em vez de vazar "Unexpected token" cru.
class PairError extends Error {}

export interface Pairing {
  code: string;
  cmd: string;
  err: string;
  busy: boolean;
  expired: boolean;
  countdown: string | null;
  probe: RelayProbe;
  diagnosis: PairDiagnosis;
  fetchCode: () => void;
  testConnection: () => void;
}

const SETUP_URL = 'https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.sh';

export function usePairing(token: string, agentOnline = false): Pairing {
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<RelayProbe>('unknown');
  const [now, setNow] = useState(() => Date.now());

  const abortRef = useRef<AbortController | null>(null);
  // Read at call time: supabase refreshes the JWT hourly, and a fetchCode keyed on
  // it re-ran the mount effect and swapped the code under a half-typed command.
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const probeRef = useRef<AbortController | null>(null);

  const fetchCode = useCallback(async () => {
    // Sem timeout/abort o relay travado deixava "gerando código…" girando pra sempre,
    // e um unmount no meio do fetch (agente conectou) setava estado em componente morto.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 15_000);
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${relayHttpBase()}/pair/new`, {
        method: 'POST',
        headers: { authorization: `Bearer ${tokenRef.current}` },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new PairError('falha ao gerar código');
      const data = (await res.json().catch(() => null)) as { code?: string; expiresAt?: string } | null;
      if (!data?.code) throw new PairError('resposta inválida do relay — tente de novo');
      setCode(data.code);
      setExpiresAt(typeof data.expiresAt === 'string' ? data.expiresAt : null);
      setNow(Date.now());
      setProbe('ok'); // o /pair/new respondeu: o relay está de pé e aceitou a sessão
    } catch (e) {
      if (timedOut) setErr('o relay demorou pra responder — gere um novo código');
      else if (!ctrl.signal.aborted) setErr(e instanceof PairError ? e.message : 'não deu pra falar com o relay — verifique sua conexão');
    } finally {
      clearTimeout(timer);
      if (abortRef.current === ctrl) setBusy(false);
    }
  }, []);

  // "Testar conexão": prova de ida-e-volta com o relay AGORA, separada do código.
  // Sem isto o usuário não tinha como saber de que lado estava o silêncio.
  const testConnection = useCallback(async () => {
    probeRef.current?.abort();
    const ctrl = new AbortController();
    probeRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    setProbe('checking');
    try {
      const res = await fetch(`${relayHttpBase()}/status`, { signal: ctrl.signal });
      setProbe(res.status === 401 || res.status === 403 ? 'rejected' : res.ok ? 'ok' : 'unreachable');
    } catch {
      if (!ctrl.signal.aborted) setProbe('unreachable');
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    void fetchCode();
    return () => { abortRef.current?.abort(); probeRef.current?.abort(); };
  }, [fetchCode]);

  // Relógio só enquanto há prazo vivo: expirado não precisa mais de tick.
  const expired = isExpired(expiresAt, now);
  useEffect(() => {
    if (!expiresAt || expired) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt, expired]);

  const left = remainingMs(expiresAt, now);
  const diagnosis = useMemo(
    () => diagnose({ probe, agentOnline, expired, hasCode: !!code }),
    [probe, agentOnline, expired, code],
  );

  return {
    code,
    cmd: code ? `curl -fsSL ${SETUP_URL} | bash -s -- ${code}` : '',
    err,
    busy,
    expired,
    countdown: left === null ? null : fmtCountdown(left),
    probe,
    diagnosis,
    fetchCode: () => { void fetchCode(); },
    testConnection: () => { void testConnection(); },
  };
}
