import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import type { VersionKind, VersionMeta } from '../../shared/versions';
import { toast } from '../components/primitives/toast-bus';

export interface VersionDiff { from: string; to: string; text: string; error?: string }

export interface VersionsApi {
  id: string | null;
  items: VersionMeta[];
  loading: boolean;
  diff: VersionDiff | null;
  restoring: boolean;
  open: (id: string) => void;
  close: () => void;
  showDiff: (from: string, to: string) => void;
  restore: (version: string) => void;
}

export function useVersions(send: (m: ClientMsg) => boolean, kind: VersionKind) {
  const [id, setId] = useState<string | null>(null);
  const [items, setItems] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [restoring, setRestoring] = useState(false);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t === 'versions' && msg.kind === kind) {
      if (msg.id === id) { setItems(msg.items); setLoading(false); }
      return true;
    }
    if (msg.t === 'versions-diff' && msg.kind === kind) {
      if (msg.id === id) setDiff({ from: msg.from, to: msg.to, text: msg.diff, error: msg.ok ? undefined : msg.message });
      return true;
    }
    if (msg.t === 'versions-restore-result' && msg.kind === kind) {
      setRestoring(false);
      toast(msg.ok ? 'Versão restaurada' : msg.message, msg.ok ? undefined : { tone: 'error' });
      if (msg.ok) setDiff(null);
      return true;
    }
    return false;
  }, [kind, id]);

  const api: VersionsApi = {
    id, items, loading, diff, restoring,
    open: useCallback((target: string) => {
      setId(target);
      setItems([]);
      setDiff(null);
      setLoading(send({ t: 'versions-list', kind, id: target }));
    }, [send, kind]),
    close: useCallback(() => { setId(null); setItems([]); setDiff(null); }, []),
    showDiff: useCallback((from: string, to: string) => {
      if (id) send({ t: 'versions-diff', kind, id, from, to });
    }, [send, kind, id]),
    restore: useCallback((version: string) => {
      if (!id) return;
      if (send({ t: 'versions-restore', kind, id, version })) setRestoring(true);
      else toast('Sem conexão com o servidor', { tone: 'error' });
    }, [send, kind, id]),
  };
  return { api, onMsg };
}
