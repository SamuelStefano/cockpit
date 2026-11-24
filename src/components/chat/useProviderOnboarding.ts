import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentsApi } from '../../cockpit/useAgents';
import { buildProviderCards, defaultProviderSelection, requestAgentFocus, setupTargets, toggleProvider, type ProviderId } from '../../cockpit/provider-onboarding';
import { openAdminTab } from '../../lib/admin-nav';
import { usePersisted } from '../../lib/persist';

export const PROVIDER_ONBOARDING_DISMISSED_KEY = 'providerOnboardingDismissed';

export function useProviderOnboarding(agents: AgentsApi, claudeReady: boolean) {
  const { refresh, presets, items, loaded } = agents;
  useEffect(() => { refresh(); }, [refresh]);
  const [dismissed, setDismissed] = usePersisted<boolean>(PROVIDER_ONBOARDING_DISMISSED_KEY, false);
  const cards = useMemo(() => buildProviderCards(presets, items, claudeReady), [presets, items, claudeReady]);
  const [selected, setSelected] = useState<ProviderId[] | null>(null);
  const current = selected ?? defaultProviderSelection(cards);
  const toggle = useCallback((id: ProviderId) => setSelected(toggleProvider(selected ?? defaultProviderSelection(cards), id)), [selected, cards]);
  const open = useCallback((id: ProviderId) => { requestAgentFocus(id); openAdminTab('agents'); }, []);
  return {
    cards, loaded, dismissed, dismiss: () => setDismissed(true),
    selected: current, toggle, open,
    targets: setupTargets(cards, current),
  };
}
