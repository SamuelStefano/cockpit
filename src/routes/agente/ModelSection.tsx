import { useState, type ReactNode } from 'react';
import type { ModelInfo } from '../../../shared/protocol';
import { describeModel, PROVIDERS, shortModelName } from '../../../shared/model-catalog';
import { isAgentModel } from '../../../shared/agents';
import { modelOptions } from '../../components/chat/model-options';
import { ModelPanel, type NoneOption } from '../../components/chat/ModelPanel';
import { Icon, Sheet, tokens } from '../../components/primitives';
import { useConnectionsCtx } from '../../cockpit/ConnectionsContext';
import { openConexoes } from '../../lib/conexoes-nav';

const sel = 'inline-flex h-[34px] max-w-full items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-950 pl-3 pr-2.5 text-[13px] text-neutral-100 transition hover:border-neutral-600';

function Chooser({ label, value, models, none, fallbackFor, noAgents, onChange }: {
  label: string; value: string; models: ModelInfo[]; none: NoneOption; fallbackFor?: ReturnType<typeof describeModel>['providerId'];
  noAgents: boolean; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const conns = useConnectionsCtx();
  const opts = modelOptions(models, value).filter((o) => o.id !== '' && !(noAgents && isAgentModel(o.id)));
  const meta = value ? describeModel(value, models.find((m) => m.id === value)?.displayName) : null;
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onClose={close} label={label} side="bottom" align="end" className="w-[380px]"
      content={
        <ModelPanel
          options={opts} current={value} connections={conns.connections} none={none} fallbackFor={fallbackFor} trackRecent={false}
          onPick={(id) => { onChange(id); close(); }}
          onAdd={() => { close(); openConexoes(true); }}
          onExpired={() => { close(); openConexoes(); }}
        />
      }>
      <button type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { if (!open) conns.refresh(); setOpen((o) => !o); }} className={`${sel} ${tokens.focusRing}`}>
        {meta && (
          <span className="inline-flex size-[18px] items-center justify-center rounded-[5px] text-[9px] font-semibold"
            style={{ background: PROVIDERS[meta.providerId].bg, color: PROVIDERS[meta.providerId].fg }}>{PROVIDERS[meta.providerId].logo}</span>
        )}
        <span className="truncate">{value ? shortModelName(value, models.find((m) => m.id === value)?.displayName) : none.title}</span>
        <Icon name="chevronDown" size={12} className="shrink-0 text-neutral-500" />
      </button>
    </Sheet>
  );
}

function Row({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-[60%]">
        <div className="text-[13px] font-medium text-neutral-200">{title}</div>
        <div className="text-[12px] text-neutral-500">{sub}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function ModelSection({ model, fallbackModel, models, noAgents, onModel, onFallback }: {
  model: string; fallbackModel: string; models: ModelInfo[]; noAgents: boolean;
  onModel: (id: string) => void; onFallback: (id: string) => void;
}) {
  const mainProvider = model ? describeModel(model, models.find((m) => m.id === model)?.displayName).providerId : 'claude';
  return (
    <section aria-label="Modelo" className="flex flex-col gap-2">
      <div className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <Row title="Principal" sub="Quem responde normalmente">
          <Chooser label="Modelo" value={model} models={models} noAgents={noAgents} onChange={onModel}
            none={{ title: 'Modelo do chat', sub: 'segue o seletor da conversa' }} />
        </Row>
        <Row title="Reserva" sub="Fica guardada para quando o principal estiver sem cota ou fora do ar.">
          <Chooser label="Reserva" value={fallbackModel} models={models} noAgents={noAgents} onChange={onFallback} fallbackFor={mainProvider}
            none={{ title: 'Nenhuma', sub: 'se o principal falhar, o agente para e avisa' }} />
        </Row>
      </div>
      <p className="text-[12px] text-neutral-500">Dica: reserva de outro provedor vale mais — se a cota do Claude acabar, Haiku acaba junto.</p>
    </section>
  );
}
