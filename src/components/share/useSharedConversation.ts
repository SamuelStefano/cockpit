import { useEffect, useState } from 'react';
import { parseSharePath, parseShareSnapshot, type ShareSnapshot } from '../../lib/share';

export type SharedState = { status: 'loading' } | { status: 'invalid' } | { status: 'ready'; snap: ShareSnapshot };

export function useSharedConversation(pathname: string): SharedState {
  const [state, setState] = useState<SharedState>({ status: 'loading' });
  useEffect(() => {
    const ref = parseSharePath(pathname);
    const base = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
    if (!ref || !base) { setState({ status: 'invalid' }); return; }
    const ctl = new AbortController();
    fetch(`${base}/storage/v1/object/public/shares/${ref.uid}/${ref.id}.json`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const snap = parseShareSnapshot(data);
        setState(snap ? { status: 'ready', snap } : { status: 'invalid' });
      })
      .catch((e) => { if (!ctl.signal.aborted) setState({ status: 'invalid' }); void e; });
    return () => ctl.abort();
  }, [pathname]);
  return state;
}
