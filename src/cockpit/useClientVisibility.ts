import { useEffect } from 'react';
import type { Caps, ClientMsg } from '../../shared/protocol';

// A hidden tab or tray window tells its box to stop the display-only loops. caps
// arrives once per connection, so this also reports the state after a reconnect.
export function useClientVisibility(caps: Caps | null, send: (m: ClientMsg) => boolean): void {
  const supported = caps?.clientVisibility === true;
  useEffect(() => {
    if (!supported) return;
    const report = () => send({ t: 'client-visibility', hidden: document.visibilityState === 'hidden' });
    const onChange = () => {
      report();
      if (document.visibilityState === 'visible') send({ t: 'list' });
    };
    report();
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [caps, supported, send]);
}
