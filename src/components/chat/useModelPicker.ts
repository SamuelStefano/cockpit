import { useEffect, useState } from 'react';
import type { ModelInfo } from '../../../shared/protocol';
import { pickerGroups } from './model-options';
import { usePersisted } from '../../lib/persist';
import { CUSTOM_MODELS_KEY, HIDDEN_MODELS_KEY } from '../../lib/account-prefs';

export function useModelPicker({ model, models, onRefreshModels }: {
  model: string; models: ModelInfo[]; onRefreshModels: () => void;
}) {
  const [customIds, setCustomIds] = usePersisted<string[]>(CUSTOM_MODELS_KEY, []);
  const [hidden] = usePersisted<string[]>(HIDDEN_MODELS_KEY, []);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { setRefreshing(false); }, [models]);
  useEffect(() => {
    if (!refreshing) return;
    const t = setTimeout(() => setRefreshing(false), 8000);
    return () => clearTimeout(t);
  }, [refreshing]);
  const refresh = () => { if (refreshing) return; setRefreshing(true); onRefreshModels(); };
  const groups = pickerGroups(models, model, customIds, hidden);
  const rememberCustom = (id: string) => { if (!groups.all.some((o) => o.id === id)) setCustomIds([...customIds, id]); };
  return { options: groups.all, refreshing, refresh, rememberCustom };
}
