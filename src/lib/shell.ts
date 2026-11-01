// The App Store build wraps the web app in a native WebView that injects
// window.ReactNativeWebView. This is the ONE place that tells the two apart; every
// shell-only difference asks here, and outside the shell nothing changes.
interface ShellGlobal { ReactNativeWebView?: { postMessage?: (data: string) => void } }

export function inShell(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as ShellGlobal).ReactNativeWebView;
}

// What the web side may ask the native shell to do.
export type ShellMessage =
  | { type: 'notify'; kind: 'turn-done' | 'turn-error'; title: string; body: string; tag: string };

export function postToShell(msg: ShellMessage): boolean {
  if (!inShell()) return false;
  try {
    (window as unknown as ShellGlobal).ReactNativeWebView!.postMessage?.(JSON.stringify(msg));
    return true;
  } catch {
    return false;
  }
}
