import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, Badge } from './primitives';
import { ClaudeAvatar } from './Avatar';
import { MessageRow, Thinking, type ToolSignal } from './chat/MessageView';
import type { Session, Message } from '../data/mock';
import type { PermMode, ModelAlias, EffortLevel, TurnStats } from '../../shared/protocol';
import type { Attachment } from '../useCockpit';
import { threadToMarkdown, download, fileSlug } from '../lib/export';
import { usePersisted } from '../lib/persist';

// --- ExportMenu ------------------------------------------------------------

// Export 100% client-side: os dados já vivem em messages[]. .md serializa a
// thread; PDF usa o print nativo do browser (@media print isola .print-thread).
function ExportMenu({ title, messages }: { title: string; messages: Message[] }) {
  const exportMd = () => download(`${fileSlug(title)}.md`, 'text/markdown', threadToMarkdown(title, messages));
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={exportMd}
        title="Baixar conversa em Markdown"
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
      >
        <Icon name="download" size={13} /> .md
      </button>
      <button
        onClick={() => window.print()}
        title="Exportar como PDF (impressão do navegador)"
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
      >
        <Icon name="download" size={13} /> pdf
      </button>
    </div>
  );
}

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

// --- ModelPicker -----------------------------------------------------------

// Modelo + esforço de raciocínio por sessão. Repassados como --model/--effort
// pro CLI (validados por allow-list no backend). Opus/high é o default.
const MODEL_OPTS: { v: ModelAlias; label: string; hint: string }[] = [
  { v: 'opus', label: 'Opus', hint: 'mais capaz e caro' },
  { v: 'sonnet', label: 'Sonnet', hint: 'equilíbrio custo/qualidade' },
  { v: 'haiku', label: 'Haiku', hint: 'rápido e barato' },
];
const EFFORT_OPTS: { v: EffortLevel; label: string }[] = [
  { v: 'low', label: 'baixo' },
  { v: 'medium', label: 'médio' },
  { v: 'high', label: 'alto' },
  { v: 'xhigh', label: 'x-alto' },
  { v: 'max', label: 'máx' },
];

function ModelPicker({ model, setModel, effort, setEffort, budget, setBudget, disabled }: {
  model: ModelAlias; setModel: (m: ModelAlias) => void;
  effort: EffortLevel; setEffort: (e: EffortLevel) => void;
  budget: number; setBudget: (n: number) => void; disabled: boolean;
}) {
  const sel = 'rounded-md border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[11px] font-medium text-neutral-300 outline-none transition hover:border-neutral-700 focus:border-orange-500/40 disabled:cursor-not-allowed disabled:opacity-50';
  const tag = 'text-[9px] font-semibold uppercase tracking-wide text-neutral-600';
  return (
    <div className="inline-flex items-center gap-1.5">
      <label className="inline-flex items-center gap-1" title="Modelo desta sessão (Opus é o mais capaz)">
        <span className={tag}>modelo</span>
        <select
          value={model}
          disabled={disabled}
          onChange={(e) => setModel(e.target.value as ModelAlias)}
          className={sel}
        >
          {MODEL_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </label>
      <label className="inline-flex items-center gap-1" title="Esforço de raciocínio (extended thinking) — independente do modelo">
        <span className={tag}>raciocínio</span>
        <select
          value={effort}
          disabled={disabled}
          onChange={(e) => setEffort(e.target.value as EffortLevel)}
          className={sel}
        >
          {EFFORT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </label>
      <div
        title="Teto de gasto por turno em USD (vazio = sem limite). O turno para sozinho ao atingir o valor."
        className={`flex items-center rounded-md border bg-neutral-950 pl-1.5 transition focus-within:border-orange-500/40 ${budget > 0 ? 'border-emerald-500/40' : 'border-neutral-800 hover:border-neutral-700'}`}
      >
        <span className="text-[11px] text-neutral-500">$</span>
        <input
          type="number"
          min="0"
          step="0.1"
          value={budget > 0 ? budget : ''}
          placeholder="teto"
          onChange={(e) => { const v = parseFloat(e.target.value); setBudget(Number.isFinite(v) && v > 0 ? v : 0); }}
          className="w-12 bg-transparent px-1 py-1 text-[11px] font-medium text-neutral-300 outline-none placeholder-neutral-600"
        />
      </div>
    </div>
  );
}

// --- TurnStat --------------------------------------------------------------

// Custo/duração REAIS do último turno (result.total_cost_usd do CLI), não a
// estimativa por preço de token. Ground-truth — some quando há um valor.
// Modelo efetivo do CLI ("claude-opus-4-..." -> "opus"). Mostra o que o run de
// fato usou — sob --fallback-model pode divergir do escolhido no picker.
function shortModel(m?: string): string {
  if (!m) return '';
  const lo = m.toLowerCase();
  if (lo.includes('opus')) return 'opus';
  if (lo.includes('sonnet')) return 'sonnet';
  if (lo.includes('haiku')) return 'haiku';
  return m;
}

function TurnStat({ stats }: { stats?: TurnStats }) {
  if (!stats || (stats.costUsd === undefined && stats.durationMs === undefined)) return null;
  const parts: string[] = [];
  if (stats.costUsd !== undefined) parts.push('$' + stats.costUsd.toFixed(stats.costUsd < 0.01 ? 4 : 3));
  if (stats.durationMs !== undefined) parts.push((stats.durationMs / 1000).toFixed(1) + 's');
  const model = shortModel(stats.model);
  return (
    <span
      title={`último turno (custo real do CLI)${stats.numTurns ? ` · ${stats.numTurns} turnos` : ''}${stats.model ? ` · modelo efetivo: ${stats.model}` : ''}`}
      className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-[10.5px] tabular-nums text-neutral-400"
    >
      <Icon name="zap" size={10} className="text-emerald-400/70" />
      {parts.join(' · ')}
      {model && <span className="text-neutral-500">· {model}</span>}
    </span>
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
    <div className="flex items-center gap-2">
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
      <div className="mb-4">
        <ClaudeAvatar size={48} />
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

// --- TemplatesMenu ---------------------------------------------------------

// Prompts salvos (squad/SDD/checklist DFL rodam o tempo todo). 100% client:
// vivem no localStorage via usePersisted, sem backend. Inserir = preenche o
// rascunho atual; salvar = guarda o rascunho com um nome.
type Template = { id: string; name: string; text: string };

function TemplatesMenu({ draft, onInsert }: { draft: string; onInsert: (text: string) => void }) {
  const [templates, setTemplates] = usePersisted<Template[]>('templates', []);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);
  const saveCurrent = () => {
    const text = draft.trim();
    if (!text) return;
    const name = window.prompt('Nome do template:', text.slice(0, 40))?.trim();
    if (!name) return;
    setTemplates((prev) => [...prev, { id: Math.random().toString(36).slice(2), name, text }]);
  };
  const remove = (id: string) => setTemplates((prev) => prev.filter((t) => t.id !== id));
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Templates de prompt"
        className={`flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-neutral-800 ${open ? 'bg-neutral-800 text-amber-300' : 'text-neutral-500 hover:text-amber-300'}`}
      >
        <Icon name="star" size={13} />
      </button>
      {open && (
        <div className="scroll-thin absolute bottom-full right-0 z-30 mb-2 max-h-72 w-72 overflow-auto rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl shadow-black/50">
          {templates.length === 0 && (
            <p className="px-3 py-2 text-[11.5px] leading-snug text-neutral-500">
              Nenhum template salvo ainda. Escreva um prompt e salve abaixo.
            </p>
          )}
          {templates.map((t) => (
            <div key={t.id} className="group/tpl flex items-stretch">
              <button
                onClick={() => { onInsert(t.text); setOpen(false); }}
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-1.5 text-left transition hover:bg-neutral-800/70"
              >
                <span className="truncate text-[12.5px] font-medium text-neutral-200">{t.name}</span>
                <span className="line-clamp-1 w-full truncate text-[10.5px] text-neutral-600">{t.text}</span>
              </button>
              <button
                onClick={() => remove(t.id)}
                title="Excluir template"
                className="flex w-8 shrink-0 items-center justify-center text-neutral-600 opacity-0 transition hover:text-red-400 group-hover/tpl:opacity-100"
              >
                <Icon name="trash" size={12} />
              </button>
            </div>
          ))}
          <div className="mt-1 border-t border-neutral-800 pt-1">
            <button
              onClick={saveCurrent}
              disabled={!draft.trim()}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11.5px] text-neutral-400 transition hover:bg-neutral-800/70 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="plus" size={12} /> Salvar rascunho atual
            </button>
          </div>
        </div>
      )}
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
  model: ModelAlias;
  setModel: (m: ModelAlias) => void;
  effort: EffortLevel;
  setEffort: (e: EffortLevel) => void;
  budget: number;
  setBudget: (n: number) => void;
  slashCommands: string[];
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  focusSignal: number;
  queued: string;
  onQueue: (text: string) => void;
  onCancelQueue: () => void;
  history: string[];
  pendingConfirm?: () => void;
  onNew: () => void;
}

const MAX_UPLOAD = 15_000_000;

function ChatInput({ disabled, onSend, onStop, value, setValue, mode, setMode, model, setModel, effort, setEffort, budget, setBudget, slashCommands, attachments, onUpload, onRemoveAttachment, focusSignal, queued, onQueue, onCancelQueue, history, pendingConfirm, onNew }: ChatInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasAtt = attachments.length > 0;
  const [sel, setSel] = useState(0);
  const slashOpen = !disabled && /^\/[^\s]*$/.test(value);
  const slashQuery = slashOpen ? value.slice(1).toLowerCase() : '';
  const matches = useMemo(
    () => (slashOpen ? slashCommands.filter((c) => c.toLowerCase().includes(slashQuery)).slice(0, 8) : []),
    [slashOpen, slashQuery, slashCommands],
  );
  const [dismissed, setDismissed] = useState(false);
  const showPalette = matches.length > 0 && !dismissed;
  // Esc dispensa a palette mas preserva o texto; digitar de novo a traz de volta.
  useEffect(() => { setSel(0); setDismissed(false); }, [slashQuery, slashOpen]);
  const complete = (cmd: string) => {
    setValue('/' + cmd + ' ');
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  };
  useEffect(() => {
    if (focusSignal === 0) return;
    const el = taRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [focusSignal]);
  // Slash-commands emulados no app: o `claude -p` headless NÃO interpreta slash
  // (viram texto literal no prompt). Interceptamos um conjunto conhecido e
  // disparamos a ação local; tudo que não casa segue pro modelo como antes.
  const runSlash = (raw: string): boolean => {
    const m = raw.match(/^\/(\S+)\s*(.*)$/);
    if (!m) return false;
    const cmd = m[1].toLowerCase();
    const arg = m[2].trim().toLowerCase();
    if (cmd === 'clear' || cmd === 'new') { onNew(); return true; }
    if (cmd === 'model' && (arg === 'opus' || arg === 'sonnet' || arg === 'haiku')) { setModel(arg); return true; }
    return false;
  };
  const submit = () => {
    const v = value.trim();
    if (v.startsWith('/') && runSlash(v)) {
      setValue('');
      if (taRef.current) taRef.current.style.height = 'auto';
      return;
    }
    // Enquanto ocupado, anexos ficam fora da fila (são por-sessão); só texto.
    if (disabled) {
      if (!v) return;
      onQueue(v); setValue('');
    } else {
      if (!v && !hasAtt) return;
      onSend(v); setValue('');
    }
    if (taRef.current) taRef.current.style.height = 'auto';
  };
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      if (f.size > MAX_UPLOAD) continue; // teto de 15MB (espelha o backend)
      onUpload(f);
    }
    e.target.value = '';
  };
  const onKey = (e: React.KeyboardEvent) => {
    // IME em composição (dead key de acento, candidato CJK): o Enter/Tab confirma
    // o candidato, não envia a mensagem. Sem isto, digitar "ã" via ~+a no Linux
    // dispara um submit no meio da palavra.
    if (e.nativeEvent.isComposing && (e.key === 'Enter' || e.key === 'Tab')) return;
    if (showPalette) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % matches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s - 1 + matches.length) % matches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const c = matches[sel].toLowerCase();
        // Comando emulado sem argumento dispara direto; o resto só completa o texto.
        if (e.key === 'Enter' && (c === 'clear' || c === 'new')) { onNew(); setValue(''); return; }
        complete(matches[sel]);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setDismissed(true); return; }
    }
    // Esc com a composição vazia durante um turno = parar o run (atalho do botão stop).
    if (e.key === 'Escape' && disabled && !value) { e.preventDefault(); onStop(); return; }
    // Recall de histórico (↑/↓), só fora da palette de slash.
    if (history.length && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      if (e.key === 'ArrowUp') {
        if (histIdx === null) { if (value !== '') return; e.preventDefault(); recall(history.length - 1); return; }
        e.preventDefault(); recall(Math.max(0, histIdx - 1)); return;
      }
      if (histIdx === null) return; // ↓ sem recall ativo = cursor normal
      e.preventDefault();
      const next = histIdx + 1;
      if (next >= history.length) { setHistIdx(null); setValue(''); if (taRef.current) taRef.current.style.height = 'auto'; }
      else recall(next);
      return;
    }
    // Composição vazia + banner pendente: Enter confirma o banner em vez de ser
    // um submit no-op. Só quando idle (com run em curso a barra vira stop/queue).
    if (e.key === 'Enter' && !e.shiftKey && !disabled && !value.trim() && !hasAtt && pendingConfirm) {
      e.preventDefault(); pendingConfirm(); return;
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setHistIdx(null); submit(); }
  };
  const grow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (histIdx !== null) setHistIdx(null); // digitar sai do modo recall
    const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };
  // Recall estilo shell: ↑ no campo vazio puxa o último prompt enviado; ↑/↓
  // navegam o histórico; ↓ abaixo do fim limpa. Histórico = msgs do usuário.
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const recall = (idx: number) => {
    setHistIdx(idx);
    setValue(history[idx]);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    });
  };
  const insertTemplate = (text: string) => {
    setValue(text);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    });
  };
  return (
    <div className="shrink-0 border-t border-neutral-800 bg-neutral-900/60 px-3 py-3 backdrop-blur">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ModeToggle mode={mode} setMode={setMode} disabled={disabled} />
        {mode === 'auto' && (
          <span className="hidden items-center gap-1 text-[10.5px] text-amber-400/70 sm:flex">
            <Icon name="zap" size={11} /> edita sozinho, sem shell
          </span>
        )}
        {mode === 'acceptEdits' && (
          <span className="hidden items-center gap-1 text-[10.5px] text-orange-400/70 sm:flex">
            <Icon name="zap" size={11} /> executa de verdade
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <TemplatesMenu draft={value} onInsert={insertTemplate} />
          <ModelPicker model={model} setModel={setModel} effort={effort} setEffort={setEffort} budget={budget} setBudget={setBudget} disabled={false} />
        </div>
      </div>
      {hasAtt && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span key={a.path} className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/60 py-1 pl-2 pr-1 text-[11px] text-neutral-300">
              <Icon name="paperclip" size={11} />
              <span className="max-w-[160px] truncate">{a.name}</span>
              <button
                onClick={() => onRemoveAttachment(a.path)}
                title="Remover anexo"
                className="flex h-4 w-4 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-700 hover:text-neutral-200"
              >
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      {queued && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.06] px-2.5 py-1.5">
          <Icon name="clock" size={12} className="mt-0.5 shrink-0 text-orange-400/80" />
          <span className="flex-1 text-[11.5px] leading-snug text-neutral-300">
            <span className="font-medium text-orange-300/90">na fila</span> · {queued}
          </span>
          <button
            onClick={onCancelQueue}
            title="Cancelar mensagem na fila"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" multiple onChange={pick} className="hidden" />
      <div className="relative">
      {showPalette && (
        <div className="scroll-thin absolute bottom-full left-0 z-30 mb-2 max-h-60 w-full overflow-auto rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl shadow-black/50">
          {matches.map((c, i) => (
            <button
              key={c}
              onMouseDown={(e) => { e.preventDefault(); complete(c); }}
              onMouseEnter={() => setSel(i)}
              className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left font-mono text-[12.5px] transition ${i === sel ? 'bg-orange-500/15 text-orange-200' : 'text-neutral-300'}`}
            >
              <span className="text-neutral-600">/</span>{c}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 transition focus-within:border-orange-500/50 focus-within:ring-2 focus-within:ring-orange-500/15">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          title="Anexar arquivo"
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="paperclip" size={15} />
        </button>
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={grow}
          onKeyDown={onKey}
          placeholder={disabled ? 'Próxima mensagem (envia ao terminar)…' : 'Pergunte ou peça um comando…  (↵ envia, ⇧↵ quebra linha)'}
          className="scroll-thin max-h-[140px] w-full resize-none bg-transparent py-1 text-[14px] leading-relaxed text-neutral-100 placeholder-neutral-600 outline-none"
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
            disabled={!value.trim() && !hasAtt}
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40
              ${value.trim() || hasAtt
                ? 'bg-orange-500 text-neutral-950 hover:bg-orange-400'
                : 'bg-neutral-800 text-neutral-600'}`}
          >
            <Icon name="arrowUp" size={16} />
          </button>
        )}
      </div>
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
  onSend: (text: string, modeOverride?: PermMode) => void;
  onPrompt: (text: string) => void;
  onStop: () => void;
  mode: PermMode;
  setMode: (m: PermMode) => void;
  model: ModelAlias;
  setModel: (m: ModelAlias) => void;
  effort: EffortLevel;
  setEffort: (e: EffortLevel) => void;
  budget: number;
  setBudget: (n: number) => void;
  slashCommands: string[];
  contextTokens: number;
  lastTurn?: TurnStats;
  onNew: () => void;
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  onEditUser?: (text: string) => void;
  onQuote?: (text: string) => void;
  onOpenFull?: (id: string) => void;
  lastEnd?: string;
  focusSignal?: number;
}

export function ChatPanel({ session, messages, phase, draft, setDraft, onSend, onPrompt, onStop, mode, setMode, model, setModel, effort, setEffort, budget, setBudget, slashCommands, contextTokens, lastTurn, lastEnd, onNew, attachments, onUpload, onRemoveAttachment, onEditUser, onQuote, onOpenFull, focusSignal = 0 }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [queued, setQueued] = useState('');
  const [toolSignal, setToolSignal] = useState<ToolSignal>({ open: true, n: 0 });
  const [fullLoaded, setFullLoaded] = useState(false);
  useEffect(() => { setFullLoaded(false); }, [session?.id]);
  const streaming = phase === 'streaming';
  const disabled = phase !== 'idle';
  const hasTools = messages.some((m) => m.role === 'assistant' && m.blocks.some((b) => b.type === 'tool'));
  const sentHistory = useMemo(
    () => messages.filter((m) => m.role === 'user').map((m) => m.text).filter(Boolean),
    [messages],
  );

  // Fila stop-aware: mensagem digitada durante o turno dispara sozinha no idle.
  useEffect(() => {
    if (phase === 'idle' && queued) {
      const text = queued;
      setQueued('');
      onSend(text);
    }
  }, [phase, queued, onSend]);

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
  const planPending = phase === 'idle' && (() => {
    const last = messages[messages.length - 1];
    return !!last && last.role === 'assistant' && last.blocks.some((b) => b.type === 'tool' && b.tool.name === 'ExitPlanMode');
  })();
  const failed = phase === 'idle' && (() => {
    const last = messages[messages.length - 1];
    return !!last && last.role === 'assistant' && last.error === true;
  })();
  const retryLast = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user') { onSend(m.text); return; }
    }
  };
  // Enter na composição vazia confirma o banner visível (aprovar plano / retomar
  // / reenviar) — a ação que o usuário quase sempre quer ali. Mesma precedência
  // da renderização: falha > plano > corte de teto.
  const bannerConfirm = failed
    ? retryLast
    : planPending
      ? () => onSend('Plano aprovado — prossiga com a implementação.', 'acceptEdits')
      : (phase === 'idle' && lastEnd)
        ? () => onSend('Continue de onde você parou e termine a tarefa.')
        : undefined;

  return (
    <div className="relative flex h-full flex-col bg-neutral-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
        <Icon name="message" size={14} className="text-neutral-500" />
        <span className="truncate text-[12.5px] font-medium text-neutral-300">{session ? session.title : 'Nova sessão'}</span>
        {session?.hasTerminal && <Badge tone="green" dot className="ml-0.5">terminal</Badge>}
        {/* Cluster direito num só container: vários ml-auto irmãos se espalham
            (margens auto dividem o espaço livre); aqui só este wrapper empurra. */}
        <div className="ml-auto flex items-center gap-2">
          <TurnStat stats={lastTurn} />
          <ContextMeter tokens={contextTokens} onNew={onNew} />
          {hasTools && (
            <button
              onClick={() => setToolSignal((s) => ({ open: !s.open, n: s.n + 1 }))}
              title={toolSignal.open ? 'Recolher todas as ferramentas' : 'Expandir todas as ferramentas'}
              className="flex items-center gap-1 rounded-md border border-neutral-800 px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300"
            >
              <Icon name="terminal" size={11} />
              {toolSignal.open ? 'recolher' : 'expandir'}
            </button>
          )}
          {!isEmpty && session && !session.id.startsWith('new-') && onOpenFull && (
            <button
              onClick={() => { setFullLoaded(true); onOpenFull(session.id); }}
              disabled={fullLoaded}
              title="Recarrega todas as mensagens do arquivo, inclusive as anteriores a um /compact que somem do caminho ativo"
              className="flex items-center gap-1 rounded-md border border-neutral-800 px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300 disabled:opacity-50"
            >
              <Icon name="message" size={11} />
              {fullLoaded ? 'histórico completo' : 'ver tudo'}
            </button>
          )}
          {!isEmpty && <ExportMenu title={session?.title || 'sessao'} messages={messages} />}
        </div>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="print-thread scroll-thin flex-1 overflow-y-auto">
        {isEmpty && phase === 'idle' ? (
          <ChatEmpty onPrompt={onPrompt} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-5">
            {messages.map((m, i) => (
              <MessageRow key={m.id} msg={m} caretOnLast={streaming && i === messages.length - 1 && m.role === 'assistant'} onEditUser={onEditUser} onQuote={onQuote} toolSignal={toolSignal} />
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

      {failed && (
        <div className="flex shrink-0 items-center gap-2 border-t border-red-500/30 bg-red-500/[0.06] px-4 py-2">
          <Icon name="rotate" size={13} className="text-red-400" />
          <span className="text-[12px] text-red-200/90">O turno falhou. Reenviar a última mensagem?</span>
          <button
            onClick={retryLast}
            className="ml-auto rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11.5px] font-medium text-red-200 transition hover:bg-red-500/20"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {phase === 'idle' && lastEnd && !planPending && !failed && (
        <div className="flex shrink-0 items-center gap-2 border-t border-amber-500/30 bg-amber-500/[0.06] px-4 py-2">
          <Icon name="rotate" size={13} className="text-amber-400" />
          <span className="text-[12px] text-amber-200/90">
            {lastEnd.includes('budget') ? 'Interrompido pelo teto de gasto.' : 'Interrompido pelo limite de turnos.'} Retomar de onde parou?
          </span>
          <button
            onClick={() => onSend('Continue de onde você parou e termine a tarefa.')}
            className="ml-auto rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-medium text-amber-200 transition hover:bg-amber-500/20"
          >
            Continuar
          </button>
        </div>
      )}

      {planPending && (
        <div className="flex shrink-0 items-center gap-2 border-t border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-2">
          <Icon name="check" size={13} className="text-emerald-400" />
          <span className="text-[12px] text-emerald-200/90">Plano pronto para execução.</span>
          <button
            onClick={() => onSend('Plano aprovado — prossiga com a implementação.', 'acceptEdits')}
            className="ml-auto rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11.5px] font-medium text-emerald-200 transition hover:bg-emerald-500/20"
          >
            Aprovar &amp; executar
          </button>
        </div>
      )}

      <ChatInput disabled={disabled} onSend={onSend} onStop={onStop} value={draft} setValue={setDraft} mode={mode} setMode={setMode}
        model={model} setModel={setModel} effort={effort} setEffort={setEffort} budget={budget} setBudget={setBudget} slashCommands={slashCommands}
        attachments={attachments} onUpload={onUpload} onRemoveAttachment={onRemoveAttachment} focusSignal={focusSignal}
        queued={queued} onQueue={setQueued} onCancelQueue={() => setQueued('')} history={sentHistory} pendingConfirm={bannerConfirm} onNew={onNew} />
    </div>
  );
}
