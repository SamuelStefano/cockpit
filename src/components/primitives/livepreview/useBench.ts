import { useCallback, useEffect, useRef, useState } from 'react';
import { buildBench, type BenchBundle } from './bench-bus';
import type { LogEntry } from './useLivePreview';

// Bench: o código roda contra o repo ALVO de verdade (componentes, tema, libs),
// então quem compila é o servidor — o cliente só edita, pede o bundle e joga no
// iframe. Debounce alto de propósito: cada build é um esbuild no repo alvo, caro
// demais pra disparar por tecla como o preview local faz.
const DEBOUNCE_MS = 800;

export function useBench(code: string, repo: string) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [draft, setDraft] = useState(code);
  const [debounced, setDebounced] = useState(code);
  const [bundle, setBundle] = useState<BenchBundle | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState(320);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // O primeiro build é sob clique: a cerca vive no histórico da sessão, então
  // compilar ao renderizar dispararia um build por abertura da conversa — e o
  // texto ainda está crescendo enquanto o assistente escreve.
  const [armed, setArmed] = useState(false);
  const lastExternal = useRef(code);
  const logSeq = useRef(0);
  const port = useRef<MessagePort | null>(null);
  const latest = useRef<BenchBundle | null>(null);
  // Builds podem voltar fora de ordem (um lento seguido de um rápido); só o
  // último pedido pode pintar a tela, senão a edição nova é sobrescrita.
  const seq = useRef(0);

  useEffect(() => {
    if (code !== lastExternal.current) { lastExternal.current = code; setDraft(code); }
  }, [code]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(draft), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    if (!armed || !debounced.trim() || !repo) return;
    const mine = ++seq.current;
    setBuilding(true);
    buildBench(repo, debounced)
      .then((b) => { if (mine !== seq.current) return; setError(null); setLogs([]); setBundle(b); })
      .catch((e: Error) => { if (mine !== seq.current) return; setError(e.message); })
      .finally(() => { if (mine === seq.current) setBuilding(false); });
    // Um build em voo não pode mais pintar a tela depois que o card sai; o
    // guard de seq faz isso sozinho ao invalidar o id.
    return () => { seq.current++; };
  }, [armed, debounced, repo]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || !e.data) return;
      const d = e.data;
      // Trocar de aba desmonta o iframe: no `deck:ready` do documento NOVO a
      // porta velha já morreu, então o bundle atual precisa ser reenviado —
      // senão a tela volta em branco.
      if (d.type === 'deck:ready') {
        port.current = e.ports[0] ?? null;
        if (latest.current) port.current?.postMessage(latest.current);
      } else if (d.type === 'deck:error') setError(String(d.message));
      else if (d.type === 'deck:height') setHeight(Math.min(720, Math.max(160, d.height + 4)));
      else if (d.type === 'deck:log') {
        setLogs((l) => [...l, { level: d.level, text: String(d.text), n: logSeq.current++ }].slice(-100));
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    if (!bundle) return;
    latest.current = bundle;
    port.current?.postMessage(bundle);
  }, [bundle]);

  const dirty = draft !== lastExternal.current;
  const reset = useCallback(() => setDraft(lastExternal.current), []);

  return {
    ref, draft, setDraft, bundle, building, error, height, logs, dirty, armed,
    arm: () => setArmed(true), reset, clearLogs: () => setLogs([]),
  };
}
