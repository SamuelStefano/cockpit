import { Icon, tokens } from '../primitives';
import { composerSummary } from './composer-summary';
import type { Effort, ModelInfo } from '../../../shared/protocol';

// O ponto vermelho repete o estado do bypass, que sai da barra no celular: esconder
// um interruptor que deixa o agente rodar qualquer comando seria pior que o scroll.
export function ComposerSummaryChip({ model, models, effort, bypass, onClick, className = '' }: {
  model: string;
  models: ModelInfo[];
  effort: Effort;
  bypass: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ajustes do próximo prompt"
      title="Modelo, esforço, skills, MCP e permissões do próximo prompt"
      className={`inline-flex min-w-0 shrink items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[11px] font-medium text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200 ${tokens.focusRing} ${className}`}
    >
      <Icon name="sliders" size={12} className="shrink-0" />
      <span className="truncate">{composerSummary(model, models, effort)}</span>
      {bypass && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />}
      <Icon name="chevronUp" size={11} className="shrink-0 text-neutral-600" />
    </button>
  );
}
