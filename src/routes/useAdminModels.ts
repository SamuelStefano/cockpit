import { useMemo } from 'react';
import type { ModelInfo } from '../../shared/protocol';
import { usePersisted } from '../lib/persist';
import { CUSTOM_MODELS_KEY, HIDDEN_MODELS_KEY } from '../lib/account-prefs';
import { buildModelCatalog, toggleHidden } from '../lib/model-visibility';
import { catalogOptions } from '../components/chat/model-options';

export function useAdminModels(models: ModelInfo[]) {
  const [customIds] = usePersisted<string[]>(CUSTOM_MODELS_KEY, []);
  const [hidden, setHidden] = usePersisted<string[]>(HIDDEN_MODELS_KEY, []);
  const catalog = useMemo(() => buildModelCatalog(catalogOptions(models, customIds), hidden), [models, customIds, hidden]);
  return {
    catalog,
    hiddenCount: hidden.length,
    toggle: (key: string) => setHidden((prev) => toggleHidden(prev, key)),
    showAll: () => setHidden([]),
  };
}
