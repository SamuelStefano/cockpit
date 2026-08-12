import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { transpile } from './transpile';
import { evalComponent } from '../../../lib/appSandboxEval';
import { APP_SCOPE } from '../../../lib/appSandboxScope';
import { createTimerJail } from '../../../lib/sandboxTimers';
import { tapConsole } from '../../../lib/consoleTap';
import type { LogEntry } from './useLivePreview';

const MAX_LOGS = 200;
const FLUSH_MS = 150;

// Motor do modo App: mesmo rascunho debounced do live preview, mas em vez de
// postar pro iframe ele transpila e AVALIA no documento do app, devolvendo o
// componente pronto pra montar na árvore React do Deck.
export function useAppSandbox(code: string, debounceMs = 200) {
  const [draft, setDraft] = useState(code);
  const [debounced, setDebounced] = useState(code);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const lastExternal = useRef(code);
  const runIdRef = useRef(0);

  useEffect(() => {
    if (code !== lastExternal.current) {
      lastExternal.current = code;
      setDraft(code);
    }
  }, [code]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(draft), debounceMs);
    return () => clearTimeout(t);
  }, [draft, debounceMs]);

  // O runId é derivado da build, não de estado: se fosse setState num efeito, a
  // barreira montaria com a key velha e remontaria logo depois — dois mounts por
  // edição, e o componente do usuário perderia estado à toa.
  const build = useMemo(() => {
    runIdRef.current += 1;
    const jail = createTimerJail();
    const r = transpile(debounced);
    const result = 'error' in r
      ? { error: r.error }
      : evalComponent(r.code, { ...(APP_SCOPE as unknown as Record<string, unknown>), ...jail.scope });
    return { jail, result, runId: runIdRef.current };
  }, [debounced]);

  const built = build.result;

  // Toda build nova é uma tentativa nova: zera o erro de runtime. Ao trocar de
  // build, os timers da anterior morrem junto com ela.
  useEffect(() => {
    setRuntimeError(null);
    return () => build.jail.clear();
  }, [build]);

  // O componente pode chamar console.log DURANTE o render; aplicar setState ali
  // realimentaria o render num laço. Por isso o grampo acumula num buffer local e
  // um timer descarrega fora do ciclo de render.
  useEffect(() => {
    const buf: LogEntry[] = [];
    let seq = 0;
    const push = (level: LogEntry['level'], text: string) => {
      buf.push({ level, text, n: seq++ });
      if (buf.length > MAX_LOGS) buf.splice(0, buf.length - MAX_LOGS);
    };
    const restore = tapConsole(push);
    const onError = (e: ErrorEvent) => push('error', e.error instanceof Error ? e.error.message : String(e.message));
    const onRejection = (e: PromiseRejectionEvent) => push('error', `promessa rejeitada: ${String(e.reason)}`);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    const timer = setInterval(() => {
      if (buf.length === 0) return;
      const next = buf.splice(0, buf.length);
      setLogs((l) => [...l, ...next].slice(-MAX_LOGS));
    }, FLUSH_MS);
    return () => {
      clearInterval(timer);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      restore();
    };
  }, []);

  const onRuntimeError = useCallback((message: string) => setRuntimeError(message), []);
  const reset = useCallback(() => setDraft(lastExternal.current), []);

  return {
    draft,
    setDraft,
    Component: 'Component' in built ? built.Component : null,
    error: 'error' in built ? built.error : runtimeError,
    runId: build.runId,
    logs,
    clearLogs: useCallback(() => setLogs([]), []),
    dirty: draft !== lastExternal.current,
    reset,
    onRuntimeError,
  };
}
