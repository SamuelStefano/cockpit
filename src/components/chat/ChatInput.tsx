import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '../primitives';
import { ClaudeAvatar } from '../Avatar';
import { ModeToggle, ModelPicker } from './Toolbar';
import type { PermMode, ModelAlias, EffortLevel } from '../../../shared/protocol';
import type { Attachment } from '../../useCockpit';
import { usePersisted } from '../../lib/persist';

// --- ChatEmpty -------------------------------------------------------------

interface ChatEmptyProps {
  onPrompt: (text: string) => void;
}

export function ChatEmpty({ onPrompt }: ChatEmptyProps) {
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
  onShowHelp?: () => void;
}

const MAX_UPLOAD = 15_000_000;

// Comandos interceptados pelo app (executam local, ver runSlash). O resto da
// lista segue pro Claude como texto — marcamos no palette pra ficar claro.
const SLASH_HINTS: Record<string, string> = {
  help: 'mostra os atalhos de teclado',
  clear: 'limpa e começa uma sessão nova',
  new: 'começa uma sessão nova',
  'model opus': 'troca esta sessão pro Opus',
  'model sonnet': 'troca esta sessão pro Sonnet',
  'model haiku': 'troca esta sessão pro Haiku',
  plan: 'modo planejar — só descreve, não executa',
  auto: 'modo auto — edita/lê arquivos, sem shell',
  execute: 'modo executar — edita e roda comandos',
  'effort low': 'esforço de raciocínio baixo',
  'effort medium': 'esforço de raciocínio médio',
  'effort high': 'esforço de raciocínio alto',
  'effort xhigh': 'esforço de raciocínio extra-alto',
  'effort max': 'esforço de raciocínio máximo',
};
const EFFORT_BY_SLASH: Record<string, EffortLevel> = {
  low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max',
};
const isLocalSlash = (c: string) => c in SLASH_HINTS;
const slashHint = (c: string) => SLASH_HINTS[c] ?? 'enviado ao Claude como texto';

export type SlashAction =
  | { kind: 'help' }
  | { kind: 'new' }
  | { kind: 'model'; model: 'opus' | 'sonnet' | 'haiku' }
  | { kind: 'mode'; mode: 'plan' | 'auto' | 'acceptEdits' }
  | { kind: 'effort'; effort: EffortLevel }
  | null;

// Decisão PURA de qual ação app-side um slash dispara (ou null = passa pro
// Claude como texto). runSlash só despacha os efeitos colaterais a partir disto.
export function classifySlash(raw: string): SlashAction {
  const m = raw.match(/^\/(\S+)\s*(.*)$/);
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const arg = m[2].trim().toLowerCase();
  if (cmd === 'help') return { kind: 'help' };
  if (cmd === 'clear' || cmd === 'new') return { kind: 'new' };
  if (cmd === 'model' && (arg === 'opus' || arg === 'sonnet' || arg === 'haiku')) return { kind: 'model', model: arg };
  if (cmd === 'plan') return { kind: 'mode', mode: 'plan' };
  if (cmd === 'auto') return { kind: 'mode', mode: 'auto' };
  if (cmd === 'execute') return { kind: 'mode', mode: 'acceptEdits' };
  if (cmd === 'effort' && arg in EFFORT_BY_SLASH) return { kind: 'effort', effort: EFFORT_BY_SLASH[arg] };
  return null;
}

export function ChatInput({ disabled, onSend, onStop, value, setValue, mode, setMode, model, setModel, effort, setEffort, budget, setBudget, slashCommands, attachments, onUpload, onRemoveAttachment, focusSignal, queued, onQueue, onCancelQueue, history, pendingConfirm, onNew, onShowHelp }: ChatInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasAtt = attachments.length > 0;
  const [sel, setSel] = useState(0);
  // "/" sozinho lista tudo; espaços continuam filtrando (comandos multi-palavra
  // como "model opus"/"effort low"). Newline = mensagem de verdade, não comando.
  const slashOpen = !disabled && value.startsWith('/') && !value.includes('\n');
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
    const a = classifySlash(raw);
    if (!a) return false;
    switch (a.kind) {
      case 'help': onShowHelp?.(); break;
      case 'new': onNew(); break;
      case 'model': setModel(a.model); break;
      case 'mode': setMode(a.mode); break;
      case 'effort': setEffort(a.effort); break;
    }
    return true;
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
        // Enter num comando app-side runnable dispara a ação direto; Tab (e os que
        // seguem pro Claude) só completam o texto pra revisão antes de enviar.
        if (e.key === 'Enter' && runSlash('/' + matches[sel])) {
          setValue('');
          if (taRef.current) taRef.current.style.height = 'auto';
          return;
        }
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
          {matches.map((c, i) => {
            const local = isLocalSlash(c);
            return (
              <button
                key={c}
                onMouseDown={(e) => { e.preventDefault(); complete(c); }}
                onMouseEnter={() => setSel(i)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${i === sel ? 'bg-orange-500/15' : ''}`}
              >
                <span className={`font-mono text-[12.5px] ${i === sel ? 'text-orange-200' : 'text-neutral-300'}`}>
                  <span className="text-neutral-600">/</span>{c}
                </span>
                {local && (
                  <span className="rounded bg-emerald-500/15 px-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-300/90">app</span>
                )}
                <span className="ml-auto truncate text-[10.5px] text-neutral-500">{slashHint(c)}</span>
              </button>
            );
          })}
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
