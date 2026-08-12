import { useRef, type KeyboardEvent, type UIEvent } from 'react';
import { useShikiTokens } from '../useShikiTokens';
import { renderTokens } from '../shiki-render';

// Editor de código do live preview: textarea transparente por cima de um <pre>
// realçado pelo shiki (técnica clássica de overlay). O texto do textarea é
// invisível (só o caret laranja aparece), então o usuário vê o realce e edita ao
// vivo. Alinhamento depende de fonte/tamanho/leading/padding IDÊNTICOS nas duas
// camadas — por isso as classes são compartilhadas em BASE.
const BASE = 'font-mono text-[12.5px] leading-relaxed whitespace-pre';
const LANG_FOR: Record<string, string> = { react: 'tsx', native: 'tsx', html: 'html', svg: 'xml', test: 'tsx' };

export function CodeEditor({ value, onChange, mode, heightClass = 'max-h-[640px] min-h-[140px]' }: { value: string; onChange: (v: string) => void; mode: string; heightClass?: string }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const tokens = useShikiTokens(value, LANG_FOR[mode] ?? 'tsx');

  // Rola o realce junto com o textarea (as duas camadas têm o mesmo conteúdo).
  const onScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    const pre = preRef.current;
    if (!pre) return;
    pre.scrollTop = e.currentTarget.scrollTop;
    pre.scrollLeft = e.currentTarget.scrollLeft;
  };

  // Tab insere 2 espaços em vez de sair do campo (edição de código de verdade).
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta = e.currentTarget;
    const s = ta.selectionStart, en = ta.selectionEnd;
    const next = value.slice(0, s) + '  ' + value.slice(en);
    onChange(next);
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
  };

  return (
    <div className={`relative overflow-hidden bg-[#0c0c0c] ${heightClass}`}>
      <pre ref={preRef} aria-hidden className={`scroll-thin pointer-events-none absolute inset-0 overflow-auto px-3 py-2.5 text-neutral-200 ${BASE}`}>
        <code>{tokens ? renderTokens(tokens) : value}{'\n'}</code>
      </pre>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={`scroll-thin absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent px-3 py-2.5 text-transparent caret-orange-400 outline-none ${BASE}`}
      />
    </div>
  );
}
