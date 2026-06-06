import { useState, useEffect, useMemo } from 'react';
import { Icon, Markdown, CodeBlock } from '../primitives';
import { ClaudeAvatar, UserAvatar } from '../Avatar';
import type { Message, Block, ToolCall } from '../../data/mock';
import type { ToolDiff } from '../../../shared/protocol';
import { messageToText } from '../../lib/export';

// --- DiffView --------------------------------------------------------------

export type DiffRow = { t: 'ctx' | 'add' | 'del'; s: string };

// LCS de linhas pra um diff interleaved. O(n*m) — limitado a trechos pequenos
// (Edit/Write costumam ser curtos); acima do teto cai pro before/after simples.
export function lineDiff(oldText: string, newText: string): DiffRow[] {
  const a = oldText === '' ? [] : oldText.split('\n');
  const b = newText === '' ? [] : newText.split('\n');
  if (a.length === 0) return b.map((s) => ({ t: 'add' as const, s }));
  if (b.length === 0) return a.map((s) => ({ t: 'del' as const, s }));
  if (a.length > 300 || b.length > 300) {
    return [...a.map((s) => ({ t: 'del' as const, s })), ...b.map((s) => ({ t: 'add' as const, s }))];
  }
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffRow[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: 'ctx', s: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: 'del', s: a[i] }); i++; }
    else { out.push({ t: 'add', s: b[j] }); j++; }
  }
  while (i < n) out.push({ t: 'del', s: a[i++] });
  while (j < m) out.push({ t: 'add', s: b[j++] });
  return out;
}

function DiffView({ diff, signal }: { diff: ToolDiff; signal?: ToolSignal }) {
  const rows = useMemo(() => lineDiff(diff.old, diff.new), [diff.old, diff.new]);
  const adds = rows.filter((r) => r.t === 'add').length;
  const dels = rows.filter((r) => r.t === 'del').length;
  const [open, setOpen] = useState(true);
  useEffect(() => { if (signal && signal.n > 0) setOpen(signal.open); }, [signal]);
  return (
    <div className="px-3 pb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-1 flex w-full items-center gap-1.5 text-[11px] text-neutral-500 transition hover:text-neutral-300"
      >
        <Icon name="chevronDown" size={13} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
        diff
        <span className="text-emerald-400/80">+{adds}</span>
        <span className="text-red-400/80">-{dels}</span>
      </button>
      {open && (
        <pre className="scroll-thin max-h-72 overflow-auto rounded-md border border-neutral-800 bg-[#070707] py-1.5 font-mono text-[11.5px] leading-relaxed">
          {(() => {
            let oldLn = 0, newLn = 0;
            return rows.map((r, i) => {
              const o = r.t !== 'add' ? ++oldLn : 0;
              const n = r.t !== 'del' ? ++newLn : 0;
              return (
                <div
                  key={i}
                  className={
                    r.t === 'add' ? 'bg-emerald-500/10 text-emerald-300'
                      : r.t === 'del' ? 'bg-red-500/10 text-red-300'
                        : 'text-neutral-500'
                  }
                >
                  <span className="select-none pl-2 pr-1 text-right text-neutral-700" style={{ display: 'inline-block', width: '2.4em' }}>{o || ''}</span>
                  <span className="select-none pr-1 text-right text-neutral-700" style={{ display: 'inline-block', width: '2.4em' }}>{n || ''}</span>
                  <span className="select-none px-1.5 text-neutral-600">{r.t === 'add' ? '+' : r.t === 'del' ? '-' : ' '}</span>
                  {r.s || ' '}
                </div>
              );
            });
          })()}
        </pre>
      )}
    </div>
  );
}

// --- ToolCallCard ----------------------------------------------------------

export interface ToolSignal { open: boolean; n: number }

interface ToolCallCardProps {
  tool: ToolCall;
  signal?: ToolSignal;
}

function ToolCallCard({ tool, signal }: ToolCallCardProps) {
  const [open, setOpen] = useState(!!tool.expanded);
  const { status } = tool;
  const lines = tool.output || [];

  // Toggle global "recolher/expandir ferramentas" (signal.n incrementa a cada clique).
  useEffect(() => { if (signal && signal.n > 0) setOpen(signal.open); }, [signal]);

  const statusEl = {
    running: (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
        <Icon name="rotate" size={12} className="spin text-orange-400" /> running…
      </span>
    ),
    done: (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-400">
        <Icon name="check" size={13} /> done {((tool.durationMs ?? 0) / 1000).toFixed(1)}s
      </span>
    ),
    error: (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-red-400">
        <Icon name="x" size={13} /> exit {tool.exit ?? 1}
      </span>
    ),
  }[status];

  const ring = status === 'error' ? 'border-red-500/30' : status === 'running' ? 'border-orange-500/30' : 'border-neutral-800';

  // Bash mostra prompt `$`; ferramentas de arquivo (Read/Edit/…) trazem um path
  // no campo command — `$` ali confunde, então usam ícone de arquivo.
  const kind = (tool.name || tool.label || '').toLowerCase();
  const isShell = kind === 'bash' || kind === 'shell' || kind === 'sh';
  const headIcon = isShell ? 'terminal'
    : kind === 'read' ? 'file'
    : kind === 'edit' || kind === 'write' || kind === 'multiedit' || kind === 'notebookedit' ? 'pencil'
    : kind === 'grep' || kind === 'glob' || kind === 'websearch' || kind === 'webfetch' ? 'search'
    : kind === 'task' ? 'sparkles'
    : kind === 'todowrite' ? 'check'
    : 'terminal';

  return (
    <div className={`my-2 overflow-hidden rounded-xl border ${ring} bg-neutral-900/70`}>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${status === 'error' ? 'bg-red-500/15 text-red-400' : 'bg-neutral-800 text-orange-400'}`}>
          <Icon name={headIcon} size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[12px] font-medium text-neutral-200">{tool.label}</span>
            <span className="shrink-0">{statusEl}</span>
          </div>
        </div>
      </div>
      {tool.command && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-[#0c0c0c] px-2.5 py-1.5">
            {isShell
              ? <span className="select-none font-mono text-[11px] text-orange-500/70">$</span>
              : <Icon name="file" size={12} className="shrink-0 text-neutral-500" />}
            <code className="scroll-thin overflow-x-auto whitespace-nowrap font-mono text-[11.5px] text-neutral-300">{tool.command}</code>
          </div>
        </div>
      )}
      {tool.diff && <DiffView diff={tool.diff} signal={signal} />}
      {tool.markdown && (
        <div className="px-3 pb-2">
          <div className="rounded-md border border-neutral-800 bg-[#0c0c0c] px-3 py-2 text-[13px] leading-relaxed text-neutral-300">
            <Markdown md={tool.markdown} />
          </div>
        </div>
      )}
      {lines.length > 0 && (
        <div className="border-t border-neutral-800">
          <div className="flex items-center pr-2">
            <button
              onClick={() => setOpen(o => !o)}
              className="flex flex-1 items-center gap-1.5 px-3 py-1.5 text-[11px] text-neutral-500 transition hover:text-neutral-300"
            >
              <Icon name="chevronDown" size={13} className="transition-transform duration-200" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
              {open ? 'ocultar output' : `mostrar output (${lines.length} linhas)`}
            </button>
            {open && <CopyTextButton text={lines.join('\n')} />}
          </div>
          <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
            <pre className="scroll-thin max-h-52 overflow-auto border-t border-neutral-800 bg-[#070707] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-neutral-400">
              {lines.map((l, i) => (
                <div key={i} className={l.startsWith('##') || l.startsWith('?') ? 'text-sky-400/80' : l.startsWith(' M') ? 'text-orange-400/80' : ''}>{l || ' '}</div>
              ))}
            </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- AssistantBlocks -------------------------------------------------------

interface AssistantBlocksProps {
  blocks: Block[];
  caretOnLast: boolean;
  toolSignal?: ToolSignal;
}

function ThinkingCard({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04]">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Pensamento interno do modelo (extended thinking) — não faz parte da resposta final"
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
      >
        <Icon name="chevronRight" size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        <Icon name="zap" size={11} className="text-violet-400/70" />
        raciocínio interno
        {!open && <span className="ml-1 truncate font-normal text-neutral-600">{text.slice(0, 60)}…</span>}
      </button>
      {open && (
        <div className="border-t border-violet-500/15">
          <p className="px-3 pt-1.5 text-[10px] italic text-neutral-600">
            Pensamento interno do modelo — não é a resposta.
          </p>
          <pre className="scroll-thin max-h-64 overflow-y-auto whitespace-pre-wrap px-3 pb-2 pt-1 text-[11.5px] leading-snug text-neutral-400">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

function AssistantBlocks({ blocks, caretOnLast, toolSignal }: AssistantBlocksProps) {
  return (
    <div className="space-y-1">
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1;
        if (b.type === 'text') return <Markdown key={i} md={b.md} caret={caretOnLast && isLast} />;
        if (b.type === 'code') return <CodeBlock key={i} code={b.code} lang={b.lang} />;
        if (b.type === 'tool') return <ToolCallCard key={i} tool={b.tool} signal={toolSignal} />;
        if (b.type === 'thinking') return <ThinkingCard key={i} text={b.text} />;
        return null;
      })}
    </div>
  );
}

// --- MessageRow ------------------------------------------------------------

interface MessageRowProps {
  msg: Message;
  caretOnLast: boolean;
  onEditUser?: (text: string) => void;
  onQuote?: (text: string) => void;
  toolSignal?: ToolSignal;
}

export function MessageRow({ msg, caretOnLast, onEditUser, onQuote, toolSignal }: MessageRowProps) {
  if (msg.role === 'user') {
    return (
      <div className="fade-up group/u flex items-start justify-end gap-2.5">
        <div className="mt-1 flex shrink-0 items-center gap-0.5 opacity-100 transition group-hover/u:opacity-100 sm:opacity-0 sm:group-hover/u:opacity-100">
          {msg.ts && <time className="mr-1 text-[10px] tabular-nums text-neutral-600">{fmtClock(msg.ts)}</time>}
          <CopyTextButton text={msg.text} />
          {onQuote && <QuoteButton onClick={() => onQuote(msg.text)} />}
          {onEditUser && (
            <button
              onClick={() => onEditUser(msg.text)}
              title="Editar e reenviar"
              className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-300"
            >
              <Icon name="pencil" size={12} />
            </button>
          )}
        </div>
        <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-neutral-700/60 bg-neutral-800 px-3.5 py-2.5 text-[14px] leading-relaxed text-neutral-100 shadow-sm shadow-black/20">
          {msg.text}
        </div>
        <div className="mt-0.5">
          <UserAvatar size={28} />
        </div>
      </div>
    );
  }
  const hasText = msg.blocks.some((b) => b.type === 'text' || b.type === 'code');
  return (
    <div className="fade-up group/msg flex gap-2.5">
      <div className="mt-0.5">
        <ClaudeAvatar size={28} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <AssistantBlocks blocks={msg.blocks} caretOnLast={caretOnLast} toolSignal={toolSignal} />
        {hasText && !caretOnLast && (
          <div className="mt-1 flex items-center gap-2 opacity-100 transition group-hover/msg:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100">
            <CopyMessageButton blocks={msg.blocks} />
            {onQuote && <QuoteButton onClick={() => onQuote(messageToText(msg.blocks))} withLabel />}
            {msg.ts && <time className="text-[10px] tabular-nums text-neutral-600">{fmtClock(msg.ts)}</time>}
          </div>
        )}
      </div>
    </div>
  );
}

function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <button
      onClick={copy}
      title="Copiar mensagem"
      className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-300"
    >
      <Icon name={copied ? 'check' : 'copy'} size={12} />
    </button>
  );
}

function QuoteButton({ onClick, withLabel }: { onClick: () => void; withLabel?: boolean }) {
  if (withLabel) {
    return (
      <button
        onClick={onClick}
        title="Citar esta mensagem no compositor"
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
      >
        <Icon name="message" size={11} /> citar
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      title="Citar esta mensagem no compositor"
      className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-300"
    >
      <Icon name="message" size={12} />
    </button>
  );
}

function CopyMessageButton({ blocks }: { blocks: Block[] }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(messageToText(blocks)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <button
      onClick={copy}
      title="Copiar resposta"
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
    >
      <Icon name={copied ? 'check' : 'copy'} size={11} /> {copied ? 'copiado' : 'copiar'}
    </button>
  );
}

// --- Thinking --------------------------------------------------------------

export function Thinking() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fade-up flex gap-2.5">
      <div className="mt-0.5">
        <ClaudeAvatar size={28} />
      </div>
      <div className="flex items-center gap-2 pt-1.5">
        <div className="flex items-center gap-1">
          <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '0ms' }} />
          <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '160ms' }} />
          <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '320ms' }} />
        </div>
        <span className="text-[12px] text-neutral-500">pensando…</span>
        {secs >= 3 && <span className="text-[11px] tabular-nums text-neutral-600">{fmtElapsed(secs)}</span>}
      </div>
    </div>
  );
}

function fmtElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

// Horário do turno (HH:MM). Mostra dia quando não é hoje.
function fmtClock(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return hm;
  return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${hm}`;
}
