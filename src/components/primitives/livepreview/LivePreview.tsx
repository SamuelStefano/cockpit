import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { tokens } from '../tokens';
import { IFRAME_HTML } from './iframeHtml';
import { transpile } from './transpile';
import { requestRefine } from './refine-bus';

type Tab = 'preview' | 'code';
type Msg = { type: 'deck:html'; html: string } | { type: 'deck:code'; code: string };

// Renderiza código do assistente como TELA rodando dentro de um iframe
// sandbox (origem opaca — não alcança o app pai). `preview` = componente
// React/TSX (transpila com sucrase antes de mandar); `preview-html` = HTML cru.
// Toggle Tela⇄Código e um input de refino que devolve o pedido pro chat.
export function LivePreview({ code, lang }: { code: string; lang: string }) {
  const isHtml = lang === 'preview-html';
  const ref = useRef<HTMLIFrameElement>(null);
  const [tab, setTab] = useState<Tab>('preview');
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState(180);
  const [refine, setRefine] = useState('');

  const payload = useMemo((): Msg | { error: string } => {
    if (isHtml) return { type: 'deck:html', html: code };
    const r = transpile(code);
    if ('error' in r) return { error: r.error };
    return { type: 'deck:code', code: r.code };
  }, [code, isHtml]);

  useEffect(() => {
    if ('error' in payload) { setError(payload.error); return; }
    setError(null);
    const msg = payload;
    const send = () => ref.current?.contentWindow?.postMessage(msg, '*');
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || !e.data) return;
      if (e.data.type === 'deck:ready') send();
      else if (e.data.type === 'deck:error') setError(String(e.data.message));
      else if (e.data.type === 'deck:height') setHeight(Math.min(640, Math.max(120, e.data.height + 4)));
    };
    window.addEventListener('message', onMsg);
    send();
    return () => window.removeEventListener('message', onMsg);
  }, [payload]);

  const submitRefine = () => { requestRefine(refine); setRefine(''); };

  return (
    <div className="my-1 overflow-hidden rounded-lg border border-orange-500/25 bg-[#0c0c0c]">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0c0c0c] px-3 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-orange-300/80">
          <Icon name="zap" size={11} /> live preview{isHtml ? ' · html' : ''}
        </span>
        <div className="flex items-center gap-0.5 rounded-md bg-neutral-900 p-0.5">
          {(['preview', 'code'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded px-2 py-0.5 text-[10px] transition ${tab === t ? 'bg-neutral-800 text-orange-200' : 'text-neutral-500 hover:text-neutral-300'} ${tokens.focusRing}`}>
              {t === 'preview' ? 'tela' : 'código'}
            </button>
          ))}
        </div>
      </div>
      {tab === 'preview' ? (
        <div className="relative bg-white">
          {error && (
            <div className="absolute inset-0 z-10 flex items-start bg-[#0c0c0c]/95 p-3">
              <pre className="scroll-thin max-h-full overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-snug text-red-400">{error}</pre>
            </div>
          )}
          <iframe ref={ref} title="live preview" sandbox="allow-scripts"
            srcDoc={IFRAME_HTML} style={{ height }} className="block w-full border-0" />
        </div>
      ) : (
        <pre className="scroll-thin max-h-[640px] overflow-auto px-3 py-2.5 text-[12.5px] leading-relaxed">
          <code className="font-mono whitespace-pre text-neutral-200">{code}</code>
        </pre>
      )}
      <div className="flex items-center gap-1.5 border-t border-neutral-800 px-2 py-1.5">
        <Icon name="zap" size={11} className="shrink-0 text-neutral-600" />
        <input value={refine} onChange={(e) => setRefine(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitRefine(); }}
          placeholder="refina esta tela… (ex: deixa mais escuro, adiciona um botão)"
          className={`min-w-0 flex-1 bg-transparent text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none`} />
        <button onClick={submitRefine} disabled={!refine.trim()}
          title="Enviar refino pro chat"
          className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition ${refine.trim() ? 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25' : 'text-neutral-600'} ${tokens.focusRing}`}>
          refinar
        </button>
      </div>
    </div>
  );
}
