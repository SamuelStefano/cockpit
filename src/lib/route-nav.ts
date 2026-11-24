export function navigateTo(path: string): void {
  if (location.pathname === path) return;
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
