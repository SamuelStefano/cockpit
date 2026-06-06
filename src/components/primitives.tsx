import { useState } from 'react';
import { download, codeExt } from '../lib/export';

// --- Icon ------------------------------------------------------------------

type IconName =
  | 'terminal' | 'plus' | 'search' | 'menu' | 'send' | 'arrowUp'
  | 'chevronDown' | 'chevronRight' | 'chevronLeft' | 'check' | 'x' | 'square' | 'play'
  | 'rotate' | 'message' | 'pencil' | 'zap' | 'trash' | 'sparkles' | 'claude'
  | 'panelRight' | 'circle' | 'user' | 'copy' | 'command' | 'grip' | 'download' | 'paperclip' | 'clock' | 'star';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  terminal: <><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  send: <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></>,
  arrowUp: <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>,
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  chevronRight: <polyline points="9 6 15 12 9 18" />,
  chevronLeft: <polyline points="15 6 9 12 15 18" />,
  check: <polyline points="20 6 9 17 4 12" />,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  square: <rect x="6" y="6" width="12" height="12" rx="1" />,
  play: <polygon points="6 4 20 12 6 20 6 4" />,
  rotate: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  sparkles: <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />,
  claude: <><line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="5.6" y1="5.6" x2="18.4" y2="18.4" /><line x1="18.4" y1="5.6" x2="5.6" y2="18.4" /><line x1="7.5" y1="4" x2="16.5" y2="20" /><line x1="16.5" y1="4" x2="7.5" y2="20" /></>,
  panelRight: <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" /></>,
  circle: <circle cx="12" cy="12" r="9" />,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  command: <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 0 0 3-3z" />,
  grip: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
  paperclip: <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
  star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>,
};

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 16, stroke = 2, className = '', style }: IconProps) {
  const fillIcons = ['play', 'square', 'sparkles'];
  const isFill = fillIcons.includes(name);
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={isFill ? 'currentColor' : 'none'}
      stroke={isFill ? 'none' : 'currentColor'}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// --- Badge -----------------------------------------------------------------

type BadgeTone = 'neutral' | 'orange' | 'green' | 'red' | 'yellow';

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}

export function Badge({ children, tone = 'neutral', className = '', dot = false }: BadgeProps) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    green: 'bg-green-500/15 text-green-400 border-green-500/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] text-[10px] font-medium leading-none ${tones[tone]} ${className}`}>
      {dot && <span className="h-1 w-1 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// --- ConnDot ---------------------------------------------------------------

export type ConnState = 'connected' | 'reconnecting' | 'down';

const CONN_META: Record<ConnState, { color: string; label: string }> = {
  connected:    { color: 'var(--ok)',   label: 'conectado' },
  reconnecting: { color: 'var(--warn)', label: 'reconectando…' },
  down:         { color: 'var(--err)',  label: 'caiu' },
};

interface ConnDotProps {
  label: string;
  state: ConnState;
  compact?: boolean;
}

export function ConnDot({ label, state, compact }: ConnDotProps) {
  const meta = CONN_META[state];
  const pulse = state === 'reconnecting';
  return (
    <div className="group relative flex items-center gap-1.5">
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{
          background: meta.color,
          boxShadow: `0 0 6px ${meta.color}`,
          ['--ring' as string]: meta.color + '88',
          animation: pulse ? 'pulseRing 1.1s ease-out infinite' : 'none',
        }}
      />
      {!compact && <span className="text-[11px] font-medium text-neutral-400">{label}</span>}
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-[10px] text-neutral-200 shadow-xl group-hover:block">
        {label} · {meta.label}
      </span>
    </div>
  );
}

// --- Skeleton --------------------------------------------------------------

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`shimmer rounded ${className}`} />;
}

// --- Markdown --------------------------------------------------------------

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*\S[^*\n]*?\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>)\]]+)/g;
  let last = 0, i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={`${keyBase}-t${i++}`}>{text.slice(last, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(<strong key={`${keyBase}-b${i++}`} className="font-semibold text-neutral-100">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('~~')) {
      nodes.push(<span key={`${keyBase}-s${i++}`} className="text-neutral-500 line-through">{tok.slice(2, -2)}</span>);
    } else if (tok.startsWith('*')) {
      nodes.push(<em key={`${keyBase}-i${i++}`} className="italic text-neutral-200">{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith('`')) {
      nodes.push(
        <code key={`${keyBase}-c${i++}`} className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[0.86em] text-orange-300">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith('http')) {
      const trail = /[.,;:!?]+$/.exec(tok);
      const url = trail ? tok.slice(0, -trail[0].length) : tok;
      nodes.push(
        <a key={`${keyBase}-u${i++}`} href={url} target="_blank" rel="noreferrer"
          className="break-all text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:decoration-orange-400">
          {url}
        </a>
      );
      if (trail) nodes.push(<span key={`${keyBase}-tp${i++}`}>{trail[0]}</span>);
    } else {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      nodes.push(
        <a key={`${keyBase}-l${i++}`} href={mm[2]} target="_blank" rel="noreferrer"
          className="text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:decoration-orange-400">
          {mm[1]}
        </a>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(<span key={`${keyBase}-t${i++}`}>{text.slice(last)}</span>);
  return nodes;
}

interface MarkdownProps {
  md: string;
  caret?: boolean;
}

// Separa regiões de código cercado (```), que podem conter linhas em branco,
// ANTES do split por parágrafo. Sem isto, fence com linha vazia se partia em
// vários blocos e o código vinha como texto cru com os ``` à mostra.
function splitFences(md: string): Array<{ t: 'code'; lang: string; code: string } | { t: 'prose'; text: string }> {
  const lines = md.split('\n');
  const segs: Array<{ t: 'code'; lang: string; code: string } | { t: 'prose'; text: string }> = [];
  let prose: string[] = [];
  const flush = () => { if (prose.join('\n').trim()) segs.push({ t: 'prose', text: prose.join('\n') }); prose = []; };
  let i = 0;
  while (i < lines.length) {
    const open = /^```([a-zA-Z0-9_+#.-]*)$/.exec(lines[i].trim());
    if (open) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') { code.push(lines[i]); i++; }
      if (i < lines.length) i++; // pula a fence de fechamento
      segs.push({ t: 'code', lang: open[1], code: code.join('\n') });
    } else {
      prose.push(lines[i]);
      i++;
    }
  }
  flush();
  return segs;
}

function proseBlocks(md: string, keyBase: string, caret: boolean): React.ReactNode[] {
  const blocks = md.split('\n\n');
  const lastIdx = blocks.length - 1;
  return blocks.map((block, idx) => {
    const showCaret = caret && idx === lastIdx;
    const lines = block.split('\n');
    const k = `${keyBase}-${idx}`;

    if (lines.length === 1 && /^(?:-{3,}|\*{3,}|_{3,})$/.test(block.trim())) {
      return <hr key={k} className="border-neutral-800" />;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(block.trim());
    if (heading && lines.length === 1) {
      const level = heading[1].length;
      const cls = level === 1 ? 'text-[17px] font-semibold text-neutral-100'
        : level === 2 ? 'text-[15px] font-semibold text-neutral-100'
        : 'text-[14px] font-semibold text-neutral-200';
      return <p key={k} className={cls}>{renderInline(heading[2], `${k}-h`)}{showCaret && <span className="caret" />}</p>;
    }

    // Tabela GFM: header + separador |---|:--:| + linhas. Claude emite tabela
    // o tempo todo (comparações, schemas); sem isto vinha como texto cru.
    if (
      lines.length >= 2 &&
      lines[0].includes('|') &&
      lines[1].includes('-') &&
      /^[\s|:-]+$/.test(lines[1].trim())
    ) {
      const cells = (l: string) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const header = cells(lines[0]);
      const rows = lines.slice(2).map(cells);
      return (
        <div key={k} className="scroll-thin overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>{header.map((h, hi) => (
                <th key={hi} className="border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-left font-semibold text-neutral-200">{renderInline(h, `${k}-th${hi}`)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{header.map((_, ci) => (
                  <td key={ci} className="border border-neutral-800 px-2.5 py-1.5 align-top text-neutral-300">{renderInline(r[ci] ?? '', `${k}-td${ri}-${ci}`)}</td>
                ))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (block.trim().startsWith('>')) {
      const inner = lines.map((l) => l.replace(/^\s*>\s?/, '')).join('\n');
      return (
        <blockquote key={k} className="border-l-2 border-orange-500/40 pl-3 text-neutral-400 [text-wrap:pretty]">
          {inner.split('\n').map((l, li) => (
            <React.Fragment key={li}>{renderInline(l, `${k}-q${li}`)}{li < inner.split('\n').length - 1 && <br />}</React.Fragment>
          ))}
          {showCaret && <span className="caret" />}
        </blockquote>
      );
    }

    const isOrdered = lines.every((l) => /^\s*\d+\.\s+/.test(l));
    const isUnordered = lines.every((l) => /^\s*[-*]\s+/.test(l));
    if ((isOrdered || isUnordered) && lines.length > 0 && lines[0].trim() !== '') {
      const items = lines.map((l) => ({
        depth: Math.min(4, Math.floor((/^\s*/.exec(l)![0].length) / 2)),
        text: l.replace(/^\s*(?:\d+\.|[-*])\s+/, ''),
      }));
      const ListTag = isOrdered ? 'ol' : 'ul';
      return (
        <ListTag key={k} className={`space-y-1 pl-5 [text-wrap:pretty] ${isOrdered ? 'list-decimal' : 'list-disc'} marker:text-neutral-500`}>
          {items.map((it, li) => (
            <li key={li} style={it.depth ? { marginLeft: it.depth * 16 } : undefined}>{renderInline(it.text, `${k}-i${li}`)}</li>
          ))}
        </ListTag>
      );
    }

    return (
      <p key={k} className="[text-wrap:pretty]">
        {lines.map((line, li) => (
          <React.Fragment key={li}>
            {renderInline(line, `${k}-${li}`)}
            {li < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
        {showCaret && <span className="caret" />}
      </p>
    );
  });
}

export function Markdown({ md, caret = false }: MarkdownProps) {
  const segs = splitFences(md);
  let lastProse = -1;
  for (let i = segs.length - 1; i >= 0; i--) { if (segs[i].t === 'prose') { lastProse = i; break; } }
  return (
    <div className="space-y-3 text-[14px] leading-relaxed text-neutral-300">
      {segs.map((s, si) =>
        s.t === 'code'
          ? <CodeBlock key={`seg${si}`} code={s.code} lang={s.lang || undefined} />
          : <React.Fragment key={`seg${si}`}>{proseBlocks(s.text, `s${si}`, caret && si === lastProse)}</React.Fragment>
      )}
    </div>
  );
}

import React from 'react';

// --- CodeBlock -------------------------------------------------------------

function highlightBash(code: string): React.ReactNode[] {
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
function highlightGeneric(code: string): React.ReactNode[] {
  return code.split('\n').map((line, i) => {
    if (/^\s*#/.test(line)) return <div key={i} className="text-neutral-500">{line || ' '}</div>;
    const nodes: React.ReactNode[] = [];
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
    return <div key={i}>{nodes.length ? nodes : ' '}</div>;
  });
}

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'console', 'shell-session', 'shellscript']);

interface CodeBlockProps {
  code: string;
  lang?: string;
}

export function CodeBlock({ code, lang = 'bash' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };
  const save = () => {
    download(`snippet.${codeExt(lang)}`, 'text/plain', code);
  };
  return (
    <div className="group/code my-1 overflow-hidden rounded-lg border border-neutral-800 bg-[#0c0c0c]">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{lang}</span>
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
        <code className="font-mono">{SHELL_LANGS.has((lang || '').toLowerCase()) ? highlightBash(code) : highlightGeneric(code)}</code>
      </pre>
    </div>
  );
}
