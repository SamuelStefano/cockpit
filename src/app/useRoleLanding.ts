import { useEffect, useRef } from 'react';
import type { Route } from '../useRoute';
import { roleRedirect, type NavRole } from '../components/chrome/nav-routes';

// Waits for caps: redirecting before the role is known would kick an admin out of
// the URL they opened. Root is never moved; an admin only leaves a root route.
export function useRoleLanding({ route, chatId, capsKnown, role, nav }: {
  route: Route; chatId: string; capsKnown: boolean; role: NavRole; nav: (to: Route) => void;
}) {
  const landed = useRef(false);
  useEffect(() => {
    if (!capsKnown) return;
    const to = roleRedirect(role, route, chatId, !landed.current);
    landed.current = true;
    if (to) nav(to);
  }, [route, chatId, capsKnown, role, nav]);
}
