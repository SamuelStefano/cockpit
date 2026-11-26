import { useEffect, useRef } from 'react';
import type { Route } from '../useRoute';
import { roleRedirect, TEAM_HOME, type NavRole } from '../components/chrome/nav-routes';

// Waits for caps: redirecting before the role is known would kick an admin out of
// the URL they opened. Root is never moved; an admin only leaves a root route.
// `landOnTeam`: the app was opened on the bare URL; root/admin then start on the Equipe
// home, once. Students keep the chat.
export function useRoleLanding({ route, capsKnown, role, nav, landOnTeam = false }: {
  route: Route; capsKnown: boolean; role: NavRole; nav: (to: Route) => void; landOnTeam?: boolean;
}) {
  const landed = useRef(false);
  useEffect(() => {
    if (!capsKnown) return;
    if (landOnTeam && !landed.current) {
      landed.current = true;
      if (role !== 'student' && (route === '/' || route.startsWith('/c/'))) { nav(TEAM_HOME); return; }
    }
    const to = roleRedirect(role, route);
    if (to) nav(to);
  }, [route, capsKnown, role, nav]);
}
