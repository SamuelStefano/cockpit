import type { Route } from '../../../useRoute';

export const NAV_VISIBLE = 3;

// Collapsed nav keeps the first few routes, plus any hidden one that is active
// or has a pending count, so collapsing never hides where you are or what waits.
export function visibleNav<T extends { to: Route }>(items: T[], showAll: boolean, route: Route, counts?: Partial<Record<Route, number>>): T[] {
  if (showAll || items.length <= NAV_VISIBLE + 1) return items;
  return items.filter((i, idx) => idx < NAV_VISIBLE || route === i.to || route.startsWith(`${i.to}/`) || !!counts?.[i.to]);
}
