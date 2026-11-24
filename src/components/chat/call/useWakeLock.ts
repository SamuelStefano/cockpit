import { useEffect } from 'react';

interface WakeLockSentinelLike { release(): Promise<void> }
type WakeLockNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };

// Keeps the screen on during a call (the mic dies when the phone locks). Browsers
// drop the lock when the tab hides, so it is re-requested on return.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const api = (navigator as WakeLockNav).wakeLock;
    if (!active || !api) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let alive = true;
    const acquire = () => {
      api.request('screen').then((s) => {
        if (alive) sentinel = s; else void s.release();
      }).catch(() => undefined);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [active]);
}
