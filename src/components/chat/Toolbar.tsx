import { Icon } from '../primitives';
import type { Message } from '../../data/mock';
import type { PermMode, ModelAlias, EffortLevel, TurnStats } from '../../../shared/protocol';
import { threadToMarkdown, download, fileSlug } from '../../lib/export';

// --- ExportMenu ------------------------------------------------------------

// Export 100% client-side: os dados já vivem em messages[]. .md serializa a
// thread; PDF usa o print nativo do browser (@media print isola .print-thread).
export function ExportMenu({ title, messages }: { title: string; messages: Message[] }) {
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

export function ModeToggle({ mode, setMode, disabled }: { mode: PermMode; setMode: (m: PermMode) => void; disabled: boolean }) {
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

export function ModelPicker({ model, setModel, effort, setEffort, budget, setBudget, disabled }: {
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

export function TurnStat({ stats }: { stats?: TurnStats }) {
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

export function ContextMeter({ tokens, onNew }: { tokens: number; onNew?: () => void }) {
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
