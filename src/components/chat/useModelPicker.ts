import { useEffect, useState } from 'react';
import type { ModelInfo } from '../../../shared/protocol';
import { normalizeModelId } from './toolbar-format';
import { pickerGroups } from './model-options';
import { usePersisted } from '../../lib/persist';
import { CUSTOM_MODELS_KEY, HIDDEN_MODELS_KEY } from '../../lib/account-prefs';
import { openAdminTab } from '../../lib/admin-nav';

export const ADD_OPTION = '__add__';
export const MANAGE_OPTION = '__manage__';

export function useModelPicker({ model, setModel, models, onRefreshModels }: {
  model: string; setModel: (m: string) => void; models: ModelInfo[]; onRefreshModels: () => void;
}) {
  const [customIds, setCustomIds] = usePersisted<string[]>(CUSTOM_MODELS_KEY, []);
  const [hidden] = usePersisted<string[]>(HIDDEN_MODELS_KEY, []);
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

  const groups = pickerGroups(models, model, customIds, hidden);

  // Inline field instead of window.prompt: a home-screen PWA (iOS standalone)
  // can suppress native dialogs, and the prompt covered the whole screen.
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState('');
  const onChange = (value: string) => {
    if (value === MANAGE_OPTION) { openAdminTab('models'); return; }
    if (value !== ADD_OPTION) { setModel(value); return; }
    setCustom('');
    setAdding(true);
  };
  const commitCustom = () => {
    const id = normalizeModelId(custom);
    setAdding(false);
    if (!id) return;
    if (!groups.all.some((o) => o.id === id)) setCustomIds([...customIds, id]);
    setModel(id);
  };
  const cancelCustom = () => setAdding(false);

  return { groups, refreshing, refresh, adding, custom, setCustom, onChange, commitCustom, cancelCustom };
}
