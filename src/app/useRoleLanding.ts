import { useEffect } from 'react';
import type { Route } from '../useRoute';
import { roleRedirect, type NavRole } from '../components/chrome/nav-routes';

// Waits for caps: redirecting before the role is known would kick an admin out of
// the URL they opened. Root is never moved; an admin only leaves a root route.
export function useRoleLanding({ route, capsKnown, role, nav }: {
  route: Route; capsKnown: boolean; role: NavRole; nav: (to: Route) => void;
}) {
  useEffect(() => {
    if (!capsKnown) return;
    const to = roleRedirect(role, route);
    if (to) nav(to);
  }, [route, capsKnown, role, nav]);
}
