const HIDDEN_AT_KEY = 'cockpit:hiddenAt';
const AWAY_MS = 30 * 60_000;

interface Entry {
  path: string;
  navType: string | undefined;
  hiddenAt: number | null;
  now: number;
}

// A reload or a pasted /c/<id> link keeps the chat. Coming back after a long absence
// opens a new one: Safari reloads an evicted tab on its old /c/<id>, and waiting for that
// thread to load is not what someone opening the app came for.
export function opensNewChat({ path, navType, hiddenAt, now }: Entry): boolean {
  const isChatPath = path === '/' || path.startsWith('/c/');
  if (!isChatPath) return false;
  if (hiddenAt !== null && now - hiddenAt > AWAY_MS) return true;
  return path === '/' && navType !== 'reload';
}

function readEntry(): Entry {
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  const raw = sessionStorage.getItem(HIDDEN_AT_KEY);
  return { path: window.location.pathname, navType: nav?.type, hiddenAt: raw ? Number(raw) : null, now: Date.now() };
}

// sessionStorage: per tab, and it survives Safari evicting the tab.
export function trackTabHidden(): void {
  const mark = () => {
    if (document.visibilityState === 'hidden') sessionStorage.setItem(HIDDEN_AT_KEY, String(Date.now()));
  };
  document.addEventListener('visibilitychange', mark);
  window.addEventListener('pagehide', () => sessionStorage.setItem(HIDDEN_AT_KEY, String(Date.now())));
}

// Read once at boot: the URL and the hidden mark both change right after.
export const entryOpensNewChat: boolean = typeof window !== 'undefined' && opensNewChat(readEntry());
