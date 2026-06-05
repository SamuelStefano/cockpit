import { useState } from 'react';

// --- Icon ------------------------------------------------------------------

type IconName =
  | 'terminal' | 'plus' | 'search' | 'menu' | 'send' | 'arrowUp'
  | 'chevronDown' | 'chevronRight' | 'check' | 'x' | 'square' | 'play'
  | 'rotate' | 'message' | 'pencil' | 'zap' | 'trash' | 'sparkles'
  | 'panelRight' | 'circle' | 'user' | 'copy' | 'command' | 'grip';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  terminal: <><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  send: <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></>,
  arrowUp: <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>,
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  chevronRight: <polyline points="9 6 15 12 9 18" />,
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
  panelRight: <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" /></>,
  circle: <circle cx="12" cy="12" r="9" />,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  command: <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 0 0 3-3z" />,
  grip: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
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
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={`${keyBase}-t${i++}`}>{text.slice(last, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(<strong key={`${keyBase}-b${i++}`} className="font-semibold text-neutral-100">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      nodes.push(
        <code key={`${keyBase}-c${i++}`} className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[0.86em] text-orange-300">
          {tok.slice(1, -1)}
        </code>
      );
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

export function Markdown({ md, caret = false }: MarkdownProps) {
  const blocks = md.split('\n\n');
  const lastIdx = blocks.length - 1;
  return (
    <div className="space-y-3 text-[14px] leading-relaxed text-neutral-300">
      {blocks.map((block, idx) => {
        const showCaret = caret && idx === lastIdx;
        const lines = block.split('\n');

        const heading = /^(#{1,3})\s+(.*)$/.exec(block.trim());
        if (heading && lines.length === 1) {
          const level = heading[1].length;
          const cls = level === 1 ? 'text-[17px] font-semibold text-neutral-100'
            : level === 2 ? 'text-[15px] font-semibold text-neutral-100'
            : 'text-[14px] font-semibold text-neutral-200';
          return <p key={idx} className={cls}>{renderInline(heading[2], `${idx}-h`)}{showCaret && <span className="caret" />}</p>;
        }

        if (block.trim().startsWith('>')) {
          const inner = lines.map((l) => l.replace(/^\s*>\s?/, '')).join('\n');
          return (
            <blockquote key={idx} className="border-l-2 border-orange-500/40 pl-3 text-neutral-400 [text-wrap:pretty]">
              {inner.split('\n').map((l, li) => (
                <React.Fragment key={li}>{renderInline(l, `${idx}-q${li}`)}{li < inner.split('\n').length - 1 && <br />}</React.Fragment>
              ))}
              {showCaret && <span className="caret" />}
            </blockquote>
          );
        }

        const isOrdered = lines.every((l) => /^\s*\d+\.\s+/.test(l));
        const isUnordered = lines.every((l) => /^\s*[-*]\s+/.test(l));
        if ((isOrdered || isUnordered) && lines.length > 0 && lines[0].trim() !== '') {
          const items = lines.map((l) => l.replace(/^\s*(?:\d+\.|[-*])\s+/, ''));
          const ListTag = isOrdered ? 'ol' : 'ul';
          return (
            <ListTag key={idx} className={`space-y-1 pl-5 [text-wrap:pretty] ${isOrdered ? 'list-decimal' : 'list-disc'} marker:text-neutral-500`}>
              {items.map((it, li) => <li key={li}>{renderInline(it, `${idx}-i${li}`)}</li>)}
            </ListTag>
          );
        }

        return (
          <p key={idx} className="[text-wrap:pretty]">
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {renderInline(line, `${idx}-${li}`)}
                {li < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
            {showCaret && <span className="caret" />}
          </p>
        );
      })}
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
  return (
    <div className="group/code my-1 overflow-hidden rounded-lg border border-neutral-800 bg-[#0c0c0c]">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300">
          <Icon name={copied ? 'check' : 'copy'} size={11} />
          {copied ? 'copiado' : 'copiar'}
        </button>
      </div>
      <pre className="scroll-thin overflow-x-auto px-3 py-2.5 text-[12.5px] leading-relaxed">
        <code className="font-mono">{highlightBash(code)}</code>
      </pre>
    </div>
  );
}
