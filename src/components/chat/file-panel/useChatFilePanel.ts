import { useCallback, useMemo, useRef, useState } from 'react';
import { sessionFileKey, type SessionFileData } from '../../../cockpit/useSessionFiles';
import type { FilePathOpener } from '../../primitives/markdown/file-path-context';

export interface SessionFilesApi {
  data: Record<string, SessionFileData>;
  get: (sessionId: string, path: string) => void;
}

interface OpenFile { sessionId: string; path: string; line?: number; seq: number }

// Which file the panel shows. The open file remembers its session, so switching
// chats hides it in the same render: the path belongs to the old cwd.
export function useChatFilePanel(sessionId: string | undefined, api: SessionFilesApi | undefined) {
  const [file, setFile] = useState<OpenFile | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const get = api?.get;
  const open = useCallback((path: string, line?: number) => {
    if (!sessionId || !get) return;
    if (document.activeElement instanceof HTMLElement) trigger.current = document.activeElement;
    setFile((prev) => ({ sessionId, path, line, seq: (prev?.seq ?? 0) + 1 }));
    get(sessionId, path);
  }, [sessionId, get]);
  // Focus goes back to the link that opened the panel, when it is still on screen.
  const close = useCallback(() => {
    setFile(null);
    if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    trigger.current = null;
  }, []);
  const opener = useMemo<FilePathOpener | null>(() => (sessionId && get ? { open } : null), [sessionId, get, open]);
  const shown = file && file.sessionId === sessionId ? file : null;
  const data = shown ? api?.data[sessionFileKey(shown.sessionId, shown.path)] : undefined;
  return { file: shown, data, opener, close };
}
