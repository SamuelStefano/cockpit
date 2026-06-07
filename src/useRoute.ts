import { useState, useEffect, useCallback } from 'react';

// Router minúsculo (sem dep): só troca a VIEW principal. useCockpit fica ACIMA
// deste switch no App, então o WebSocket/terminais nunca desmontam ao navegar.
export type Route = '/' | '/contextos' | '/skills' | '/uso' | '/admin' | '/docs';

const ROUTES: Route[] = ['/', '/contextos', '/skills', '/uso', '/admin', '/docs'];

function current(): Route {
  const p = location.pathname as Route;
  return ROUTES.includes(p) ? p : '/';
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(current());
  useEffect(() => {
    const onPop = () => setRoute(current());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const nav = useCallback((to: Route) => {
    if (to === current()) return;
    history.pushState(null, '', to);
    setRoute(to);
  }, []);
  return { route, nav };
}
