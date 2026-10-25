// The admin sub-tab lives in the URL hash so another screen (the version picker)
// can deep-link into it. useRoute only listens to popstate, so a programmatic
// push has to emit one for the view to switch.
export function adminTabFromHash(hash: string, known: readonly string[]): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  return known.includes(id) ? id : null;
}

export function openAdminTab(tab: string): void {
  history.pushState(null, '', `/admin#${encodeURIComponent(tab)}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function replaceAdminTabHash(tab: string): void {
  history.replaceState(null, '', `${location.pathname}#${encodeURIComponent(tab)}`);
}
