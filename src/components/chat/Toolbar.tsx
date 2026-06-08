import { Icon } from '../primitives';
import type { Message } from '../../data/mock';
import type { PermMode, ModelInfo, TurnStats } from '../../../shared/protocol';
import { useState } from 'react';
import { threadToMarkdown, threadToPdf, download, fileSlug } from '../../lib/export';
import { turnStatParts, contextMeter, CONTEXT_LIMIT } from './toolbar.format';

// --- ExportMenu ------------------------------------------------------------

// Export 100% client-side: os dados já vivem em messages[]. .md serializa a
// thread; .pdf gera um arquivo real via jspdf (carregado sob demanda), sem o
// diálogo de impressão do navegador.
export function ExportMenu({ title, messages }: { title: string; messages: Message[] }) {
  const [busy, setBusy] = useState(false);
  const exportMd = () => download(`${fileSlug(title)}.md`, 'text/markdown', threadToMarkdown(title, messages));
  const exportPdf = async () => {
    setBusy(true);
    try { await threadToPdf(title, messages); }
    finally { setBusy(false); }
  };
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
        onClick={exportPdf}
        disabled={busy}
        title="Baixar conversa em PDF"
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300 disabled:opacity-50"
      >
        <Icon name={busy ? 'rotate' : 'download'} size={13} className={busy ? 'spin' : ''} /> pdf
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
    { v: 'acceptEdits', label: 'Executar', hint: 'o agente edita arquivos e roda comandos' },
    { v: 'auto', label: 'Auto', hint: 'edita e lê arquivos sozinho — sem rodar comandos no shell' },
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

// --- BypassToggle ----------------------------------------------------------

// Switch admin-only de bypassPermissions (#94, DR-011). Só é renderizado quando
// o servidor anuncia canBypass (admin + flag de env + loopback) — o caller já
// gateia por isso. Default OFF; o backend reimpõe via bypassAllowed. Visual de
// alerta: bypass = o agente roda QUALQUER comando sem pedir.
export function BypassToggle({ on, setOn, disabled }: { on: boolean; setOn: (b: boolean) => void; disabled: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => setOn(!on)}
      title={on
        ? 'BYPASS LIGADO — o agente roda qualquer comando sem aprovação. Desligue quando terminar.'
        : 'Bypass de permissões (admin): o agente roda qualquer comando sem pedir. Use com cuidado.'}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50
        ${on
          ? 'border-red-500/50 bg-red-500/15 text-red-300 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.4)]'
          : 'border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-300'}`}
    >
      <Icon name={on ? 'shield-off' : 'shield'} size={12} />
      bypass
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-red-400' : 'bg-neutral-700'}`} />
    </button>
  );
}

// --- ModelPicker -----------------------------------------------------------

// Versão concreta do agente por sessão (ex: Opus 4.8), puxada de /v1/models pelo
// backend. Repassada como --model (id validado por allow-list no servidor). Sem
// a lista (boot/offline) cai nos aliases opus/sonnet/haiku, que o CLI aceita.
const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'opus', displayName: 'Opus' },
  { id: 'sonnet', displayName: 'Sonnet' },
  { id: 'haiku', displayName: 'Haiku' },
];

// A conta pode expor só uma família concreta em /v1/models (ex: só Opus 4.8). Pra
// não deixar o seletor com uma opção só, completamos com os aliases das famílias
// ausentes (sonnet/haiku) — o CLI aceita o alias e resolve a versão mais recente.
function withFamilies(models: ModelInfo[]): ModelInfo[] {
  const have = new Set(models.map((m) => FALLBACK_MODELS.find((f) => m.id.includes(f.id))?.id));
  const extra = FALLBACK_MODELS.filter((f) => !have.has(f.id));
  return [...models, ...extra];
}

export function ModelPicker({ model, setModel, models, disabled }: {
  model: string; setModel: (m: string) => void;
  models: ModelInfo[];
  disabled: boolean;
}) {
  const sel = 'rounded-md border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[11px] font-medium text-neutral-300 outline-none transition hover:border-neutral-700 focus:border-orange-500/40 disabled:cursor-not-allowed disabled:opacity-50';
  const tag = 'text-[9px] font-semibold uppercase tracking-wide text-neutral-600';
  const opts = models.length ? withFamilies(models) : FALLBACK_MODELS;
  // Garante que o modelo atual apareça na lista mesmo que não esteja em /v1/models
  // (alias persistido, modelo descontinuado) — senão o select renderiza vazio.
  const list = opts.some((o) => o.id === model) ? opts : [{ id: model, displayName: model }, ...opts];
  return (
    <label className="inline-flex items-center gap-1" title="Versão do agente desta sessão">
      <span className={tag}>versão</span>
      <select
        value={model}
        disabled={disabled}
        onChange={(e) => setModel(e.target.value)}
        className={sel}
      >
        {list.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
      </select>
    </label>
  );
}

// --- TurnStat --------------------------------------------------------------

// Custo/duração REAIS do último turno (result.total_cost_usd do CLI), não a
// estimativa por preço de token. Ground-truth — some quando há um valor.
export function TurnStat({ stats }: { stats?: TurnStats }) {
  const fmt = turnStatParts(stats);
  if (!fmt) return null;
  const { parts, model } = fmt;
  return (
    <span
      title={`último turno (custo real do CLI)${stats?.numTurns ? ` · ${stats.numTurns} turnos` : ''}${stats?.model ? ` · modelo efetivo: ${stats.model}` : ''}`}
      className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-[10.5px] tabular-nums text-neutral-400"
    >
      <Icon name="zap" size={10} className="text-emerald-400/70" />
      {parts.join(' · ')}
      {model && <span className="text-neutral-500">· {model}</span>}
    </span>
  );
}

// --- ContextMeter ----------------------------------------------------------

// O medidor mostra quanto do contexto o último turno ocupou; perto do teto,
// sugere abrir nova sessão.
export function ContextMeter({ tokens, onNew }: { tokens: number; onNew?: () => void }) {
  const m = contextMeter(tokens);
  if (!m) return null;
  const { pct, high, mid, k } = m;
  const color = high ? 'bg-red-500' : mid ? 'bg-amber-500' : 'bg-neutral-600';
  const text = high ? 'text-red-400' : mid ? 'text-amber-400' : 'text-neutral-500';
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
