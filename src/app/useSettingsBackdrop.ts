import { useCallback, useRef } from 'react';
import type { Route } from '../useRoute';
import { navigateTo } from '../lib/route-nav';

export const isSettingsRoute = (route: Route): boolean => route === '/configuracoes' || route.startsWith('/configuracoes/');

interface Backdrop { route: Route; url: string }

// Settings keep their URLs (deep links, ⌘K, legacy /uso) but render as a modal over the
// screen you came from, so the chat underneath never unmounts. A cold load straight into
// a settings URL has no previous screen: the chat is the backdrop.
export function useSettingsBackdrop(route: Route) {
  const open = isSettingsRoute(route);
  const last = useRef<Backdrop>({ route: '/', url: '/' });
  if (!open && typeof location !== 'undefined') last.current = { route, url: location.pathname + location.search + location.hash };
  const close = useCallback(() => navigateTo(last.current.url), []);
  return { open, viewRoute: open ? last.current.route : route, close };
}
