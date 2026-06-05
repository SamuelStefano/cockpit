import { useState, useEffect, useRef } from 'react';
import { Icon, Badge, Markdown, CodeBlock } from './primitives';
import type { Session, Message, Block, ToolCall } from '../data/mock';
import type { PermMode } from '../../shared/protocol';

// --- ModeToggle ------------------------------------------------------------

const ACTIVE_TONE: Record<PermMode, string> = {
  plan: 'bg-neutral-800 text-neutral-100',
  auto: 'bg-amber-500/20 text-amber-300 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.4)]',
  acceptEdits: 'bg-orange-500/20 text-orange-300 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.4)]',
};

function ModeToggle({ mode, setMode, disabled }: { mode: PermMode; setMode: (m: PermMode) => void; disabled: boolean }) {
  const opts: { v: PermMode; label: string; hint: string }[] = [
    { v: 'plan', label: 'Planejar', hint: 'só descreve o plano — nada é executado' },
    { v: 'auto', label: 'Auto', hint: 'edita e lê arquivos sozinho — sem rodar comandos no shell' },
    { v: 'acceptEdits', label: 'Executar', hint: 'o agente edita arquivos e roda comandos' },
  ];
  return (
    <div className="inline-flex items-center rounded-lg border border-neutral-800 bg-neutral-950 p-0.5">
      {opts.map((o) => {
        const active = mode === o.v;
        return (
          <button
            key={o.v}
            type="button"
            disabled={disabled}
            onClick={() => setMode(o.v)}
            title={o.hint}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50
              ${active ? ACTIVE_TONE[o.v] : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// --- ContextMeter ----------------------------------------------------------

// Janela de contexto dos modelos atuais ~200K tokens. O medidor mostra quanto
// do contexto o último turno ocupou; perto do teto, sugere abrir nova sessão.
const CONTEXT_LIMIT = 200_000;

function ContextMeter({ tokens, onNew }: { tokens: number; onNew?: () => void }) {
  if (tokens <= 0) return null;
  const pct = Math.min(100, Math.round((tokens / CONTEXT_LIMIT) * 100));
  const high = pct >= 75;
  const mid = pct >= 50;
  const color = high ? 'bg-red-500' : mid ? 'bg-amber-500' : 'bg-neutral-600';
  const text = high ? 'text-red-400' : mid ? 'text-amber-400' : 'text-neutral-500';
  const k = (tokens / 1000).toFixed(0);
  return (
    <div className="ml-auto flex items-center gap-2">
      <div
        className="flex items-center gap-1.5"
        title={`contexto: ~${tokens.toLocaleString()} tokens de ~${CONTEXT_LIMIT.toLocaleString()} (${pct}%)`}
      >
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[11px] tabular-nums ${text}`}>{k}k</span>
      </div>
      {high && onNew && (
        <button
          onClick={onNew}
          title="Contexto quase cheio — comece uma sessão nova para respostas mais rápidas e baratas"
          className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-red-300 transition hover:bg-red-500/20"
        >
          <Icon name="plus" size={11} /> nova sessão
        </button>
      )}
    </div>
  );
}

// --- ToolCallCard ----------------------------------------------------------

interface ToolCallCardProps {
  tool: ToolCall;
}

function ToolCallCard({ tool }: ToolCallCardProps) {
  const [open, setOpen] = useState(!!tool.expanded);
  const { status } = tool;
  const lines = tool.output || [];

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

  return (
    <div className={`my-2 overflow-hidden rounded-xl border ${ring} bg-neutral-900/70`}>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${status === 'error' ? 'bg-red-500/15 text-red-400' : 'bg-neutral-800 text-orange-400'}`}>
          <Icon name="terminal" size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[12px] font-medium text-neutral-200">{tool.label}</span>
            <span className="shrink-0">{statusEl}</span>
          </div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-[#0c0c0c] px-2.5 py-1.5">
          <span className="select-none font-mono text-[11px] text-orange-500/70">$</span>
          <code className="scroll-thin overflow-x-auto whitespace-nowrap font-mono text-[11.5px] text-neutral-300">{tool.command}</code>
        </div>
      </div>
      {lines.length > 0 && (
        <div className="border-t border-neutral-800">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] text-neutral-500 transition hover:text-neutral-300"
          >
            <Icon name="chevronDown" size={13} className="transition-transform duration-200" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
            {open ? 'ocultar output' : `mostrar output (${lines.length} linhas)`}
          </button>
          <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
            <pre className="scroll-thin max-h-52 overflow-auto border-t border-neutral-800 bg-[#070707] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-neutral-400">
              {lines.map((l, i) => (
                <div key={i} className={l.startsWith('##') || l.startsWith('?') ? 'text-sky-400/80' : l.startsWith(' M') ? 'text-orange-400/80' : ''}>{l || ' '}</div>
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
}

function AssistantBlocks({ blocks, caretOnLast }: AssistantBlocksProps) {
  return (
    <div className="space-y-1">
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1;
        if (b.type === 'text') return <Markdown key={i} md={b.md} caret={caretOnLast && isLast} />;
        if (b.type === 'code') return <CodeBlock key={i} code={b.code} lang={b.lang} />;
        if (b.type === 'tool') return <ToolCallCard key={i} tool={b.tool} />;
        return null;
      })}
    </div>
  );
}

// --- MessageRow ------------------------------------------------------------

interface MessageRowProps {
  msg: Message;
  caretOnLast: boolean;
}

function MessageRow({ msg, caretOnLast }: MessageRowProps) {
  if (msg.role === 'user') {
    return (
      <div className="fade-up flex justify-end gap-2.5">
        <div className="max-w-[82%] rounded-2xl rounded-br-md border border-neutral-700/60 bg-neutral-800 px-3.5 py-2.5 text-[14px] leading-relaxed text-neutral-100 shadow-sm shadow-black/20 [text-wrap:pretty]">
          {msg.text}
        </div>
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-400">
          <Icon name="user" size={14} />
        </div>
      </div>
    );
  }
  return (
    <div className="fade-up flex gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-neutral-950 shadow-sm shadow-orange-500/20">
        <Icon name="sparkles" size={14} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <AssistantBlocks blocks={msg.blocks} caretOnLast={caretOnLast} />
      </div>
    </div>
  );
}

// --- Thinking --------------------------------------------------------------

function Thinking() {
  return (
    <div className="fade-up flex gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-neutral-950">
        <Icon name="sparkles" size={14} />
      </div>
      <div className="flex items-center gap-2 pt-1.5">
        <div className="flex items-center gap-1">
          <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '0ms' }} />
          <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '160ms' }} />
          <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '320ms' }} />
        </div>
        <span className="text-[12px] text-neutral-500">pensando…</span>
      </div>
    </div>
  );
}

// --- ChatEmpty -------------------------------------------------------------

interface ChatEmptyProps {
  onPrompt: (text: string) => void;
}

function ChatEmpty({ onPrompt }: ChatEmptyProps) {
  const examples = [
    'Por que meu git push deu "rejected"?',
    'Configurar deploy com webhook na VPS',
    'O psql travou num lock — como destravo?',
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-neutral-950 shadow-lg shadow-orange-500/25">
        <Icon name="sparkles" size={22} />
      </div>
      <h2 className="text-[17px] font-semibold text-neutral-200">Em que vamos trabalhar?</h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-snug text-neutral-500">
        Converse com o agente e ele pode rodar comandos nos seus terminais da VPS.
      </p>
      <div className="mt-5 flex w-full max-w-sm flex-col gap-2">
        {examples.map((e) => (
          <button key={e} onClick={() => onPrompt(e)}
            className="group flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-left text-[12.5px] text-neutral-400 transition hover:border-neutral-700 hover:bg-neutral-900 hover:text-neutral-200">
            <span>{e}</span>
            <Icon name="arrowUp" size={13} className="rotate-90 text-neutral-600 transition group-hover:text-orange-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

// --- ChatInput -------------------------------------------------------------

interface ChatInputProps {
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  value: string;
  setValue: (v: string) => void;
  mode: PermMode;
  setMode: (m: PermMode) => void;
}

function ChatInput({ disabled, onSend, onStop, value, setValue, mode, setMode }: ChatInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const submit = () => {
    const v = value.trim();
    if (!v || disabled) return;
    onSend(v); setValue('');
    if (taRef.current) taRef.current.style.height = 'auto';
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };
  const grow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };
  return (
    <div className="shrink-0 border-t border-neutral-800 bg-neutral-900/60 px-3 py-3 backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <ModeToggle mode={mode} setMode={setMode} disabled={disabled} />
        {mode === 'auto' && (
          <span className="flex items-center gap-1 text-[10.5px] text-amber-400/70">
            <Icon name="zap" size={11} /> edita sozinho, sem shell
          </span>
        )}
        {mode === 'acceptEdits' && (
          <span className="flex items-center gap-1 text-[10.5px] text-orange-400/70">
            <Icon name="zap" size={11} /> executa de verdade
          </span>
        )}
      </div>
      <div className={`flex items-end gap-2 rounded-xl border bg-neutral-950 px-3 py-2 transition
        ${disabled ? 'border-neutral-800 opacity-80' : 'border-neutral-700 focus-within:border-orange-500/50 focus-within:ring-2 focus-within:ring-orange-500/15'}`}>
        <textarea
          ref={taRef}
          rows={1}
          disabled={disabled}
          value={value}
          onChange={grow}
          onKeyDown={onKey}
          placeholder={disabled ? 'Aguarde a resposta…' : 'Pergunte ou peça um comando…  (↵ envia, ⇧↵ quebra linha)'}
          className="scroll-thin max-h-[140px] w-full resize-none bg-transparent py-1 text-[14px] leading-relaxed text-neutral-100 placeholder-neutral-600 outline-none disabled:cursor-not-allowed disabled:text-neutral-500"
        />
        {disabled ? (
          <button
            onClick={onStop}
            title="Interromper resposta"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-200 transition hover:bg-red-500/20 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <Icon name="square" size={13} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim()}
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40
              ${value.trim()
                ? 'bg-orange-500 text-neutral-950 hover:bg-orange-400'
                : 'bg-neutral-800 text-neutral-600'}`}
          >
            <Icon name="arrowUp" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// --- ChatPanel -------------------------------------------------------------

export type Phase = 'idle' | 'thinking' | 'streaming';

export interface ChatPanelProps {
  session: Session | null;
  messages: Message[];
  phase: Phase;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void;
  onPrompt: (text: string) => void;
  onStop: () => void;
  mode: PermMode;
  setMode: (m: PermMode) => void;
  contextTokens: number;
  onNew: () => void;
}

export function ChatPanel({ session, messages, phase, draft, setDraft, onSend, onPrompt, onStop, mode, setMode, contextTokens, onNew }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const streaming = phase === 'streaming';
  const disabled = phase !== 'idle';

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    pinnedRef.current = near;
    setAtBottom(near);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, phase]);

  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex h-full flex-col bg-neutral-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
        <Icon name="message" size={14} className="text-neutral-500" />
        <span className="truncate text-[12.5px] font-medium text-neutral-300">{session ? session.title : 'Nova sessão'}</span>
        {session?.hasTerminal && <Badge tone="green" dot className="ml-0.5">terminal</Badge>}
        <ContextMeter tokens={contextTokens} onNew={onNew} />
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="scroll-thin flex-1 overflow-y-auto">
        {isEmpty && phase === 'idle' ? (
          <ChatEmpty onPrompt={onPrompt} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-5">
            {messages.map((m, i) => (
              <MessageRow key={m.id} msg={m} caretOnLast={streaming && i === messages.length - 1 && m.role === 'assistant'} />
            ))}
            {phase === 'thinking' && <Thinking />}
          </div>
        )}
      </div>

      {!atBottom && !isEmpty && (
        <button
          onClick={scrollToBottom}
          title="Ir para o fim"
          className="fade-up absolute bottom-[84px] left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-300 shadow-lg shadow-black/40 transition hover:bg-neutral-700 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
        >
          <Icon name="chevronDown" size={16} />
        </button>
      )}

      <ChatInput disabled={disabled} onSend={onSend} onStop={onStop} value={draft} setValue={setDraft} mode={mode} setMode={setMode} />
    </div>
  );
}
