import { Badge, EmptyState, Icon, Markdown, Stat } from '../../components/primitives';
import type { HarnessEvent, HarnessTaskView } from '../../../shared/protocol';
import { fmtTaskCost } from './task-cost';

interface Props {
  task: HarnessTaskView | null;
  events: HarnessEvent[];
}

const TIER_TONE = { simple: 'green', medium: 'yellow', complex: 'orange' } as const;

export function HarnessFeed({ task, events }: Props) {
  if (!task) {
    return <EmptyState icon="zap" title="Nenhuma task ainda" description="Dispare uma tarefa no composer ao lado pra ver a orquestração ao vivo." />;
  }

  const streamed = events.filter((e) => e.kind === 'text').map((e) => e.text ?? '').join('');
  const text = task.status === 'running' ? streamed : (task.resultText ?? streamed);
  const errored = task.status === 'error';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={errored ? 'red' : task.status === 'running' ? 'orange' : 'green'} dot>
          {task.status === 'running' ? 'rodando' : errored ? 'erro' : 'concluída'}
        </Badge>
        <Badge tone="neutral">{task.mode}</Badge>
        {task.via === 'plan' && <Badge tone="green">plano</Badge>}
        {task.model && <Badge tone="neutral">{task.model}</Badge>}
        {task.tierReason && task.mode !== 'model' && <Badge tone={TIER_TONE[task.tier]}>{task.tier}</Badge>}
        {task.context === 'pentest' && <Badge tone="orange"><Icon name="shield" size={9} />pentest</Badge>}
      </div>

      {/* O contexto de pentest troca o system prompt da task (server/harness/prompt.ts).
          Era gravado no banco e trafegado em HarnessTaskView.context, mas nenhuma tela
          mostrava: depois de rodar não dava pra saber sob qual enquadramento a resposta
          saiu — justamente o dado que importa numa task de segurança. */}
      {task.context === 'pentest' && (
        <div className="flex items-start gap-1.5 rounded-lg border border-orange-500/20 bg-orange-500/[0.06] px-3 py-2">
          <Icon name="shield" size={12} className="mt-0.5 shrink-0 text-orange-400/80" />
          <span className="text-[11.5px] leading-relaxed text-orange-200/70">
            Rodou com o contexto de pentest autorizado no system prompt.
          </span>
        </div>
      )}

      {task.tierReason && task.tierReason !== 'seleção manual' && (
        <div className="flex items-start gap-1.5 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
          <Icon name="zap" size={12} className="mt-0.5 shrink-0 text-orange-400/70" />
          <span className="text-[11.5px] leading-relaxed text-neutral-400">{task.tierReason}</span>
        </div>
      )}

      {errored ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 text-[12px] text-red-300">
          {task.error}
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-3 text-[13px] leading-relaxed text-neutral-200">
          {text ? <Markdown md={text} caret={task.status === 'running'} /> : <span className="text-neutral-600">aguardando resposta…</span>}
        </div>
      )}

      {task.status === 'done' && (
        <div className="grid grid-cols-3 gap-2">
          {task.via === 'plan'
            ? <Stat label="custo" value="plano" sub="US$0 · cota" icon="claude" tone="green" />
            : <Stat label="custo" value={fmtTaskCost(task.costUsd)} sub="estimado" icon="zap" tone={task.costUsd ? 'orange' : 'green'} />}
          <Stat label="tokens" value={((task.inputTokens ?? 0) + (task.outputTokens ?? 0)).toLocaleString('pt-BR')} sub={`${task.outputTokens ?? 0} saída`} icon="claude" />
          <Stat label="duração" value={`${((task.durationMs ?? 0) / 1000).toFixed(1)}s`} icon="clock" />
        </div>
      )}
    </div>
  );
}
