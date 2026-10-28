import { useState } from 'react';
import type { ModelInfo } from '../../../shared/protocol';
import { shortModelName } from '../../../shared/model-catalog';
import { useModelPicker } from './useModelPicker';
import { ModelPanel } from './ModelPanel';
import { Icon, Sheet, tokens } from '../primitives';
import { useConnectionsCtx } from '../../cockpit/ConnectionsContext';
import { openAdminTab } from '../../lib/admin-nav';
import { openConexoes } from '../../lib/conexoes-nav';

const chip = 'inline-flex h-10 max-w-28 cursor-pointer items-center gap-1 truncate rounded-md border-0 bg-transparent pl-2 pr-1.5 text-[13px] text-neutral-400 outline-hidden transition hover:bg-neutral-800 hover:text-neutral-100 sm:max-w-44';
const boxed = 'inline-flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-[12px] font-medium text-neutral-300 transition hover:border-neutral-700';
const tag = 'hidden text-[12px] font-semibold uppercase tracking-wide text-neutral-600 sm:inline';

const nameOf = (id: string, models: ModelInfo[]) => shortModelName(id, models.find((m) => m.id === id)?.displayName);

export function ModelPicker({ model, setModel, models, onRefreshModels, canManage = false, locked, compact = false }: {
  model: string; setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
  canManage?: boolean;
  locked?: string;
  compact?: boolean;
}) {
  if (locked) return <LockedModel model={model} models={models} reason={locked} compact={compact} />;
  return <ModelSelect model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels} canManage={canManage} compact={compact} />;
}

function LockedModel({ model, models, reason, compact }: { model: string; models: ModelInfo[]; reason: string; compact: boolean }) {
  if (compact) {
    return (
      <span className="hidden max-w-28 shrink-0 items-center gap-1 truncate px-2 text-[13px] text-neutral-400 sm:inline-flex sm:max-w-44" title={`Modelo ${reason} — troque no perfil do bot`}>
        <Icon name="lock" size={10} />
        {nameOf(model, models)}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1" title={`Modelo ${reason} — troque no perfil do bot`}>
      <span className={tag}>versão</span>
      <span className="inline-flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[12px] font-medium text-neutral-300">
        <Icon name="lock" size={10} />
        {nameOf(model, models)}
        <span className="text-neutral-600">· {reason}</span>
      </span>
    </span>
  );
}

function ModelSelect({ model, setModel, models, onRefreshModels, canManage, compact }: {
  model: string; setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
  canManage: boolean;
  compact: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { options, refreshing, refresh, rememberCustom } = useModelPicker({ model, models, onRefreshModels });
  const conns = useConnectionsCtx();
  const toggle = () => { if (!open) conns.refresh(); setOpen((o) => !o); };
  const close = () => setOpen(false);

  return (
    <span className={`relative shrink-0 items-center gap-1 ${compact ? 'hidden sm:inline-flex' : 'inline-flex'}`} title="Versão do agente do próximo prompt">
      {!compact && <span className={tag}>versão</span>}
      <Sheet open={open} onClose={close} label="Escolher modelo" side="top" align="end" className="w-[380px]"
        content={
          <ModelPanel
            options={options} current={model} connections={conns.connections}
            onPick={(id) => { rememberCustom(id); setModel(id); close(); }}
            onAdd={() => { close(); openConexoes(true); }}
            onExpired={() => { close(); openConexoes(); }}
            onRefresh={refresh} refreshing={refreshing}
            onManage={canManage ? () => { close(); openAdminTab('models'); } : undefined}
            allowCustomId
          />
        }>
        <button type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open}
          aria-label="Versão do agente do próximo prompt"
          className={`${compact ? chip : boxed} ${tokens.focusRing}`}>
          <span className="truncate">{nameOf(model, models)}</span>
          <Icon name="chevronDown" size={12} className="shrink-0 text-neutral-500" />
        </button>
      </Sheet>
    </span>
  );
}
