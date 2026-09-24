import { useEffect, useState } from 'react';
import type { ModelInfo } from '../../../shared/protocol';
import { prettyModel, normalizeModelId } from './toolbar-format';
import { modelOptions } from './model-options';
import { usePersisted } from '../../lib/persist';
import { Icon, tokens } from '../primitives';

const ADD = '__add__';

export function ModelPicker({ model, setModel, models, onRefreshModels }: {
  model: string; setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
}) {
  const [customIds, setCustomIds] = usePersisted<string[]>('customModels', []);
  // The refresh used to give no sign it ran. Spin until the new list lands (the
  // server re-broadcasts `models`) or 8s pass.
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { setRefreshing(false); }, [models]);
  useEffect(() => {
    if (!refreshing) return;
    const t = setTimeout(() => setRefreshing(false), 8000);
    return () => clearTimeout(t);
  }, [refreshing]);
  const refresh = () => { if (refreshing) return; setRefreshing(true); onRefreshModels(); };
  const sel = 'max-w-[130px] rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[11px] font-medium text-neutral-300 outline-hidden transition hover:border-neutral-700 focus:border-orange-500/40 sm:max-w-none sm:px-1.5 sm:py-1';
  const tag = 'hidden text-[9px] font-semibold uppercase tracking-wide text-neutral-600 sm:inline';
  // Modelos digitados à mão (ex: um recém-lançado ainda fora do /v1/models da conta).
  const customOpts: ModelInfo[] = customIds.map((id) => ({ id, displayName: id }));
  const list = modelOptions(models, model, customOpts).filter((o, i, a) => a.findIndex((x) => x.id === o.id) === i);

  // Inline field instead of window.prompt: a home-screen PWA (iOS standalone)
  // can suppress native dialogs, and the prompt covered the whole screen.
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState('');
  const onChange = (value: string) => {
    if (value !== ADD) { setModel(value); return; }
    setCustom('');
    setAdding(true);
  };
  const commitCustom = () => {
    const id = normalizeModelId(custom);
    setAdding(false);
    if (!id) return;
    if (!list.some((o) => o.id === id)) setCustomIds([...customIds, id]);
    setModel(id);
  };

  return (
    <label className="inline-flex shrink-0 items-center gap-1" title="Versão do agente do próximo prompt">
      <span className={tag}>versão</span>
      {adding ? (
        <input
          autoFocus
          aria-label="ID do modelo"
          placeholder="claude-opus-5"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') { e.preventDefault(); commitCustom(); }
            else if (e.key === 'Escape') { e.preventDefault(); setAdding(false); }
          }}
          onBlur={commitCustom}
          className={`${sel} w-36 font-mono`}
        />
      ) : (
        <select
          // The visible "versão" tag is hidden on mobile, which left the select nameless.
          aria-label="Versão do agente do próximo prompt"
          value={model}
          onChange={(e) => onChange(e.target.value)}
          className={sel}
        >
          {list.map((o) => <option key={o.id} value={o.id}>{prettyModel(o.id, o.displayName)}</option>)}
          <option value={ADD}>+ outro modelo…</option>
        </select>
      )}
      <button
        type="button"
        onClick={refresh}
        disabled={refreshing}
        title="Buscar modelos novos da Anthropic agora"
        aria-label={refreshing ? 'Buscando modelos…' : 'Buscar modelos novos da Anthropic agora'}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-200 sm:h-[22px] sm:w-[22px] ${tokens.focusRing}`}
      >
        <Icon name="rotate" size={12} className={refreshing ? 'spin text-orange-400' : ''} />
      </button>
    </label>
  );
}
