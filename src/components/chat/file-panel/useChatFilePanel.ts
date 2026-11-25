import { useCallback, useEffect, useMemo, useState } from 'react';
import { sessionFileKey, type SessionFileData } from '../../../cockpit/useSessionFiles';
import type { FilePathOpener } from '../../primitives/markdown/file-path-context';

export interface SessionFilesApi {
  data: Record<string, SessionFileData>;
  get: (sessionId: string, path: string, force?: boolean) => void;
}

// Which file the panel shows. A new session closes it: the path belongs to the old cwd.
export function useChatFilePanel(sessionId: string | undefined, api: SessionFilesApi | undefined) {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => { setPath(null); }, [sessionId]);
  const get = api?.get;
  const open = useCallback((p: string) => {
    if (!sessionId || !get) return;
    setPath(p);
    get(sessionId, p);
  }, [sessionId, get]);
  const close = useCallback(() => setPath(null), []);
  const opener = useMemo<FilePathOpener | null>(() => (sessionId && get ? { open } : null), [sessionId, get, open]);
  const data = path && sessionId ? api?.data[sessionFileKey(sessionId, path)] : undefined;
  return { path, data, opener, close };
}
