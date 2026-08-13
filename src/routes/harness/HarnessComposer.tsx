import { Badge, Button, Icon, Switch } from '../../components/primitives';
import type { HarnessConfig, HarnessMode } from '../../../shared/protocol';
import { useHarnessDraft } from './useHarnessDraft';
import { ModelSelect } from './ModelSelect';

interface Props {
  config: HarnessConfig | null;
  running: boolean;
  onRun: (prompt: string, draft: ReturnType<typeof useHarnessDraft>) => void;
}

const MODES: { id: HarnessMode; label: string; icon: 'zap' | 'claude' | 'link' | 'command' }[] = [
  { id: 'auto', label: 'Auto', icon: 'zap' },
  { id: 'model', label: 'Modelo', icon: 'claude' },
  { id: 'provider', label: 'Provedor', icon: 'link' },
  { id: 'orchestrated', label: 'Orquestrado', icon: 'command' },
];

const STRONG = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'complex' as const },
  { id: 'claude-fable-5', label: 'Fable 5', tier: 'complex' as const },
];

export function HarnessComposer({ config, running, onRun }: Props) {
  const d = useHarnessDraft(config);
  const native = config?.nativeModels ?? [];
  const providers = config?.providers ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <textarea
        value={d.prompt}
        onChange={(e) => d.setPrompt(e.target.value)}
        placeholder="Descreva a tarefa…"
        rows={5}
        className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-[13px] leading-relaxed text-neutral-200 placeholder-neutral-600 outline-none transition focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/15"
      />

      <div className="grid grid-cols-4 gap-1.5">
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

      {d.mode === 'auto' && (
        <p className="text-[11.5px] leading-relaxed text-neutral-500">
          Um classificador barato (Haiku) lê o prompt, sugere a complexidade e escolhe o modelo
          nativo do tier. A decisão aparece ao vivo antes da resposta.
        </p>
      )}
      {d.mode === 'model' && (
        <ModelSelect label="Modelo nativo" value={d.model} onChange={d.setModel} models={native} />
      )}
      {d.mode === 'provider' && (
        <label className="block">
          <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-500">Provedor terceiro</span>
          <select
            value={d.providerId}
            onChange={(e) => d.setProviderId(e.target.value)}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[12.5px] text-neutral-200 outline-none focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/15"
          >
            <option value="">selecione…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.configured}>
                {p.label}{p.configured ? '' : ' (sem chave)'}
              </option>
            ))}
          </select>
        </label>
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
        hint="Enquadra a tarefa como teste de segurança legítimo · força modelo nativo"
        icon="shield"
      />

      <div className="flex items-center justify-between gap-2">
        {d.blocked ? <Badge tone="yellow">{d.blocked}</Badge> : <span className="text-[11px] text-neutral-600">tudo selecionável, nada roda sozinho</span>}
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
