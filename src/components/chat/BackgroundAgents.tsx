import { Icon } from '../primitives';
import { Badge } from '../primitives/Badge';
import { fmtTokensK } from './Thinking';
import { useBackgroundAgents, type ViewAgent } from './use-background-agents';
import type { BgAgent } from '../../../shared/protocol';

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${String(s % 60).padStart(2, '0')}s`;
}

function AgentChip({ a }: { a: ViewAgent }) {
  const done = a.status === 'done';
  const failed = a.status === 'failed';
  const tone = failed ? 'red' : done ? 'green' : 'orange';
  return (
    <Badge tone={tone} className="max-w-full gap-1.5 px-2 py-[3px]">
      {done ? (
        <Icon name="check" size={11} />
      ) : failed ? (
        <Icon name="x" size={11} />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-current" />
      )}
      <span className="truncate font-medium" title={a.label}>{a.label}</span>
      <span className="shrink-0 font-mono tabular-nums opacity-80">
        {done ? 'concluído' : failed ? 'falhou' : fmtElapsed(a.elapsedMs)}
        {a.tokens > 0 && ` · ${fmtTokensK(a.tokens)}`}
      </span>
    </Badge>
  );
}

// Faixa de agentes de FUNDO (Task em background): espelha o terminal — label +
// tempo decorrido + tokens ao vivo, com flip pra "✓ concluído" no fim. Só aparece
// com ≥1 agente visível. Mora logo acima do composer.
export function BackgroundAgents({ agents }: { agents?: BgAgent[] }) {
  const view = useBackgroundAgents(agents);
  if (!view.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-1.5 pt-1">
      <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-neutral-500">
        <Icon name="sparkles" size={11} /> fundo
      </span>
      {view.map((a) => (
        <AgentChip key={a.id} a={a} />
      ))}
    </div>
  );
}
