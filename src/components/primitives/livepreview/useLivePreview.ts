import { useEffect, useMemo, useRef, useState } from 'react';
import { transpile, transpileBare } from './transpile';
import { fireConfetti } from '../confetti-bus';

export type Mode = 'html' | 'react' | 'native' | 'svg' | 'test';

// Mapeia a linguagem do bloco (```preview*) pro runtime do iframe.
export function modeOf(lang: string): Mode {
  if (lang === 'preview-html') return 'html';
  if (lang === 'preview-native') return 'native';
  if (lang === 'preview-svg') return 'svg';
  if (lang === 'preview-test') return 'test';
  return 'react';
}

export type LogLevel = 'log' | 'info' | 'warn' | 'error';
export interface LogEntry { level: LogLevel; text: string; n: number }
export interface TestResult { name: string; pass: boolean; error: string }
type Payload = { type: 'deck:html'; html: string } | { type: 'deck:code'; code: string } | { error: string };

function toPayload(src: string, mode: Mode): Payload {
  if (mode === 'html' || mode === 'svg') return { type: 'deck:html', html: src };
  // O juiz roda statements soltos (test/expect globais) → transpile SEM CommonJS.
  const r = mode === 'test' ? transpileBare(src) : transpile(src);
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
  const [tests, setTests] = useState<TestResult[]>([]);
  const lastExternal = useRef(code);
  const logSeq = useRef(0);
  // Confetti só na TRANSIÇÃO pra tudo-verde (evita re-disparar a cada tecla numa
  // suíte que já estava passando). Vermelho→verde comemora; verde→verde não.
  const wasGreen = useRef(false);

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
    setTests([]);
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
      } else if (d.type === 'deck:test' && Array.isArray(d.results)) {
        const results: TestResult[] = d.results.map((r: TestResult) => ({ name: String(r.name), pass: !!r.pass, error: String(r.error ?? '') }));
        setTests(results);
        const allGreen = results.length > 0 && results.every((r) => r.pass);
        if (allGreen && !wasGreen.current) fireConfetti();
        wasGreen.current = allGreen;
      }
    };
    window.addEventListener('message', onMsg);
    send();
    return () => window.removeEventListener('message', onMsg);
  }, [payload, mode]);

  const dirty = draft !== lastExternal.current;
  const reset = () => { setDraft(lastExternal.current); };

  return { ref, draft, setDraft, error, height, logs, tests, dirty, reset, clearLogs: () => setLogs([]) };
}
