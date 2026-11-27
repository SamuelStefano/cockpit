import { useCallback } from 'react';
import { usePersisted } from '../../../lib/persist';

export const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = usePersisted<boolean>(SIDEBAR_COLLAPSED_KEY, false);
  return { collapsed, toggle: useCallback(() => setCollapsed((c) => !c), [setCollapsed]) };
}
