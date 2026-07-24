import { useEffect, useMemo, useRef, useState } from 'react';
import { transpile } from './transpile';

export type Mode = 'html' | 'react' | 'native';
export type LogLevel = 'log' | 'info' | 'warn' | 'error';
export interface LogEntry { level: LogLevel; text: string; n: number }
type Payload = { type: 'deck:html'; html: string } | { type: 'deck:code'; code: string } | { error: string };

function toPayload(src: string, mode: Mode): Payload {
  if (mode === 'html') return { type: 'deck:html', html: src };
  const r = transpile(src);
  if ('error' in r) return { error: r.error };
  return { type: 'deck:code', code: r.code };
}

// Coração do live preview: mantém um RASCUNHO editável do código e re-renderiza a
// tela do iframe a cada tecla (debounced). O rascunho sincroniza com `code`
// SOMENTE quando o assistente produz código novo (mudança externa) — assim uma
// edição local do usuário não é atropelada por um re-render do chat. Também
// coleta console.* (deck:log), erros (deck:error) e altura (deck:height).
export function useLivePreview(code: string, mode: Mode, debounceMs = 160) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [draft, setDraft] = useState(code);
  const [debounced, setDebounced] = useState(code);
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState(180);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const lastExternal = useRef(code);
  const logSeq = useRef(0);

  // Código novo do assistente (não uma edição local) → recarrega o rascunho.
  useEffect(() => {
    if (code !== lastExternal.current) {
      lastExternal.current = code;
      setDraft(code);
    }
  }, [code]);

  // Debounce das teclas: transpilar/postar a cada caractere seria caro e piscaria.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(draft), debounceMs);
    return () => clearTimeout(t);
  }, [draft, debounceMs]);

  const payload = useMemo(() => toPayload(debounced, mode), [debounced, mode]);

  useEffect(() => {
    if ('error' in payload) { setError(payload.error); return; }
    setError(null);
    setLogs([]); // cada render é um console limpo
    const msg = payload;
    const send = () => ref.current?.contentWindow?.postMessage(msg, '*');
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || !e.data) return;
      const d = e.data;
      if (d.type === 'deck:ready') send();
      else if (d.type === 'deck:error') setError(String(d.message));
      else if (d.type === 'deck:height' && mode !== 'native') setHeight(Math.min(640, Math.max(120, d.height + 4)));
      else if (d.type === 'deck:log') {
        const entry: LogEntry = { level: d.level, text: String(d.text), n: logSeq.current++ };
        setLogs((l) => [...l, entry].slice(-100));
      }
    };
    window.addEventListener('message', onMsg);
    send();
    return () => window.removeEventListener('message', onMsg);
  }, [payload, mode]);

  const dirty = draft !== lastExternal.current;
  const reset = () => { setDraft(lastExternal.current); };

  return { ref, draft, setDraft, error, height, logs, dirty, reset, clearLogs: () => setLogs([]) };
}
