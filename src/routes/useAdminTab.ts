import { useCallback, useEffect, useState } from 'react';
import { adminTabFromHash, replaceAdminTabHash } from '../lib/admin-nav';

const DEFAULT_TAB = 'overview';

export function useAdminTab(known: readonly string[]): [string, (id: string) => void] {
  const [tab, setTab] = useState(() => adminTabFromHash(location.hash, known) ?? DEFAULT_TAB);
  useEffect(() => {
    // Admin stays mounted when the picker deep-links while /admin is already open.
    const onPop = () => setTab(adminTabFromHash(location.hash, known) ?? DEFAULT_TAB);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [known]);
  const select = useCallback((id: string) => { setTab(id); replaceAdminTabHash(id); }, []);
  return [tab, select];
}
