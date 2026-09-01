import { Badge, Button, Icon, Switch } from '../../components/primitives';
import type { HarnessConfig, HarnessMode } from '../../../shared/protocol';
import { useHarnessDraft } from './useHarnessDraft';
import { ModelSelect } from './ModelSelect';

interface Props {
  config: HarnessConfig | null;
  running: boolean;
  onRun: (prompt: string, draft: ReturnType<typeof useHarnessDraft>) => void;
}

const MODES: { id: HarnessMode; label: string; icon: 'zap' | 'claude' | 'command' }[] = [
  { id: 'auto', label: 'Auto', icon: 'zap' },
  { id: 'model', label: 'Modelo', icon: 'claude' },
  { id: 'orchestrated', label: 'Orquestrado', icon: 'command' },
];

const STRONG = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'complex' as const },
  { id: 'claude-fable-5', label: 'Fable 5', tier: 'complex' as const },
];

export function HarnessComposer({ config, running, onRun }: Props) {
  const d = useHarnessDraft(config);
  const native = config?.nativeModels ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <textarea
        value={d.prompt}
        onChange={(e) => d.setPrompt(e.target.value)}
        placeholder="Descreva a tarefa…"
        rows={5}
        className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-[13px] leading-relaxed text-neutral-200 placeholder-neutral-600 outline-hidden transition focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/15"
      />

      <div className="grid grid-cols-3 gap-1.5">
        {MODES.map((m) => (
          <Button
            key={m.id}
            variant={d.mode === m.id ? 'primary' : 'secondary'}
            size="sm"
            icon={m.icon}
            onClick={() => d.setMode(m.id)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      {d.nativeMode && (
        <div>
          <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-500">Rodar no</span>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant={d.via === 'plan' ? 'primary' : 'secondary'} size="sm" icon="claude" onClick={() => d.setVia('plan')}>
              Plano · grátis
            </Button>
            <Button variant={d.via === 'api' ? 'primary' : 'secondary'} size="sm" icon="zap" onClick={() => d.setVia('api')}>
              API · centavos
            </Button>
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-neutral-600">
            {d.via === 'plan'
              ? 'Roda pelo seu plano (cota que você já paga, US$0). Carrega ~10k tokens de scaffolding por task.'
              : 'Roda na API pay-as-you-go (centavos por task, contexto enxuto).'}
          </p>
        </div>
      )}

      {d.mode === 'auto' && (
        <p className="text-[11.5px] leading-relaxed text-neutral-500">
          Um classificador barato (Haiku) lê o prompt, sugere a complexidade e escolhe o modelo
          nativo do tier. A decisão aparece ao vivo antes da resposta.
        </p>
      )}
      {d.mode === 'model' && (
        <ModelSelect label="Modelo nativo" value={d.model} onChange={d.setModel} models={native} />
      )}
      {d.mode === 'orchestrated' && (
        <div className="grid grid-cols-2 gap-2">
          <ModelSelect label="Executor (barato)" value={d.executor} onChange={d.setExecutor} models={native} />
          <ModelSelect label="Advisor (forte)" value={d.advisor} onChange={d.setAdvisor} models={STRONG} />
        </div>
      )}

      <Switch
        checked={d.pentest}
        onChange={() => d.setPentest(!d.pentest)}
        label="Contexto de pentest autorizado"
        hint="Enquadra a tarefa como teste de segurança legítimo"
        icon="shield"
      />

      <div className="flex items-center justify-between gap-2">
        {/* O toggle de pentest NÃO se desarma depois de rodar (só o prompt é limpo), então
            sem este aviso ao lado do botão a task seguinte sairia com o mesmo system prompt
            sem ninguém perceber. */}
        {d.blocked
          ? <Badge tone="yellow">{d.blocked}</Badge>
          : d.pentest
            ? <Badge tone="orange"><Icon name="shield" size={9} />contexto de pentest ligado</Badge>
            : <span className="text-[11px] text-neutral-600">tudo selecionável, nada roda sozinho</span>}
        <Button
          variant="primary"
          icon="play"
          loading={running}
          disabled={!d.canRun || running}
          onClick={() => { onRun(d.prompt, d); d.setPrompt(''); }}
        >
          Rodar
        </Button>
      </div>
    </div>
  );
}
