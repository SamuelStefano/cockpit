import { useState } from 'react';
import { Icon } from './Icon';
import { download, codeExt } from '../../lib/export';
import { useCopied } from '../../lib/useCopied';
import { useShikiTokens } from './useShikiTokens';
import { renderTokens } from './shiki-render';
import { LivePreview } from './livepreview/LivePreview';

// Linguagens que viram tela viva no chat em vez de bloco realçado.
const PREVIEW_LANGS = new Set(['preview', 'preview-html', 'preview-native']);

interface CodeBlockProps {
  code: string;
  lang?: string;
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  if (lang && PREVIEW_LANGS.has(lang)) return <LivePreview code={code} lang={lang} />;
  return <HighlightedCode code={code} lang={lang} />;
}

function HighlightedCode({ code, lang }: CodeBlockProps) {
  const [copied, copy, failed] = useCopied(1200);
  const [wrap, setWrap] = useState(false);
  const tokens = useShikiTokens(code, lang);
  const save = () => download(`snippet.${codeExt(lang || '')}`, 'text/plain', code);
  return (
    <div className="group/code my-1 rounded-lg border border-neutral-800 bg-[#0c0c0c]">
      {/* Header sticky: em bloco longo o copiar/quebra fica visível ao rolar (paridade ChatGPT). */}
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-neutral-800 bg-[#0c0c0c] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{lang || 'text'}</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setWrap((w) => !w)}
            title={wrap ? 'Não quebrar linhas' : 'Quebrar linhas longas'}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] transition hover:bg-neutral-800 ${wrap ? 'text-orange-300' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <Icon name="wrapText" size={11} />
          </button>
          <button onClick={save} title="Baixar trecho" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300">
            <Icon name="download" size={11} />
          </button>
          <button onClick={() => copy(code)} className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] transition hover:bg-neutral-800 ${failed ? 'text-red-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Icon name={copied ? 'check' : failed ? 'x' : 'copy'} size={11} />
            {copied ? 'copiado' : failed ? 'falhou' : 'copiar'}
          </button>
        </div>
      </div>
      <pre className={`scroll-thin overflow-x-auto px-3 py-2.5 text-[12.5px] leading-relaxed ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>
        {/* Sem tokens (carregando/offline) = texto puro, sem flash nem erro. */}
        <code className="font-mono text-neutral-200">{tokens ? renderTokens(tokens) : code}</code>
      </pre>
    </div>
  );
}
