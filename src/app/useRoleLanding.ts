import { useEffect, useRef } from 'react';
import type { Route } from '../useRoute';
import { studentRedirect } from '../components/chrome/nav-routes';

// Waits for caps: redirecting before the role is known would kick an admin out of
// the URL they opened. Admin is never moved.
export function useRoleLanding({ route, chatId, capsKnown, isAdmin, nav }: {
  route: Route; chatId: string; capsKnown: boolean; isAdmin: boolean; nav: (to: Route) => void;
}) {
  const landed = useRef(false);
  useEffect(() => {
    if (!capsKnown || isAdmin) return;
    const to = studentRedirect(route, chatId, !landed.current);
    landed.current = true;
    if (to) nav(to);
  }, [route, chatId, capsKnown, isAdmin, nav]);
}
