import { useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { download, codeExt } from '../../lib/export';

function highlightBash(code: string): ReactNode[] {
  return code.split('\n').map((line, i) => {
    if (line.trim().startsWith('#')) {
      return <div key={i} className="text-neutral-500">{line}</div>;
    }
    const parts = line.split(/(\s+)/);
    return (
      <div key={i}>
        {parts.map((p, j) => {
          if (j === 0 && p === 'git') return <span key={j} className="text-orange-400">{p}</span>;
          if (/^--?[a-z]/.test(p)) return <span key={j} className="text-sky-400">{p}</span>;
          if (j === 2 && parts[0] === 'git') return <span key={j} className="text-green-400">{p}</span>;
          return <span key={j} className="text-neutral-300">{p}</span>;
        })}
      </div>
    );
  });
}

const CODE_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'import', 'from', 'export', 'default', 'class', 'extends', 'new',
  'async', 'await', 'yield', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of',
  'def', 'lambda', 'pass', 'with', 'as', 'elif', 'self', 'type', 'interface', 'enum', 'struct',
  'fn', 'match', 'impl', 'use', 'pub', 'mut', 'public', 'private', 'protected', 'static', 'void',
  'true', 'false', 'null', 'none', 'nil', 'undefined', 'True', 'False', 'None',
]);

const CODE_TOKEN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/.*)|(\b\d[\w.]*\b)|([A-Za-z_$][\w$]*)/g;

// Realce genérico leve pra linguagens não-shell (js/ts/py/json…): strings, comentários,
// números e um set de keywords. O highlightBash misturava heurística de git/flags em
// qualquer código; aqui cada lang ganha um realce coerente.
function highlightGeneric(code: string): ReactNode[] {
  return code.split('\n').map((line, i) => {
    if (/^\s*#/.test(line)) return <div key={i} className="text-neutral-500">{line || ' '}</div>;
    const nodes: ReactNode[] = [];
    let last = 0, j = 0, m: RegExpExecArray | null;
    const re = new RegExp(CODE_TOKEN.source, 'g');
    while ((m = re.exec(line))) {
      if (m.index > last) nodes.push(<span key={j++}>{line.slice(last, m.index)}</span>);
      const [tok, str, comment, num, word] = m;
      if (str) nodes.push(<span key={j++} className="text-green-400">{tok}</span>);
      else if (comment) nodes.push(<span key={j++} className="text-neutral-500">{tok}</span>);
      else if (num) nodes.push(<span key={j++} className="text-amber-300">{tok}</span>);
      else if (word && CODE_KEYWORDS.has(word)) nodes.push(<span key={j++} className="text-sky-400">{tok}</span>);
      else nodes.push(<span key={j++} className="text-neutral-300">{tok}</span>);
      last = m.index + tok.length;
    }
    if (last < line.length) nodes.push(<span key={j++}>{line.slice(last)}</span>);
    return <div key={i}>{nodes.length ? nodes : ' '}</div>;
  });
}

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'console', 'shell-session', 'shellscript']);

interface CodeBlockProps {
  code: string;
  lang?: string;
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };
  const save = () => {
    download(`snippet.${codeExt(lang || '')}`, 'text/plain', code);
  };
  // Fence sem linguagem não é shell — rotula "text" e usa o highlighter genérico
  // (antes caía no default 'bash', rotulando tudo BASH e colorindo como shell).
  const isShell = SHELL_LANGS.has((lang || '').toLowerCase());
  return (
    <div className="group/code my-1 overflow-hidden rounded-lg border border-neutral-800 bg-[#0c0c0c]">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{lang || 'text'}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={save} title="Baixar trecho" className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300">
            <Icon name="download" size={11} />
          </button>
          <button onClick={copy} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300">
            <Icon name={copied ? 'check' : 'copy'} size={11} />
            {copied ? 'copiado' : 'copiar'}
          </button>
        </div>
      </div>
      <pre className="scroll-thin overflow-x-auto px-3 py-2.5 text-[12.5px] leading-relaxed">
        <code className="font-mono">{isShell ? highlightBash(code) : highlightGeneric(code)}</code>
      </pre>
    </div>
  );
}
