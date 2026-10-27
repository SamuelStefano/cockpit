import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClaudeImportResult, ClaudeImportScan, ImportKind } from '../../shared/claude-import';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';

export interface ClaudeImportApi {
  scan: ClaudeImportScan | null;
  hint: string | null;
  result: ClaudeImportResult | null;
  busy: boolean;
  onScan: (path?: string) => void;
  onApply: (kinds: ImportKind[], path?: string) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

const BUSY_TIMEOUT_MS = 60_000;

export function useClaudeImport(send: (m: ClientMsg) => boolean): ClaudeImportApi {
  const [scan, setScan] = useState<ClaudeImportScan | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [result, setResult] = useState<ClaudeImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const begin = useCallback((m: ClientMsg) => {
    if (!send(m)) return;
    setBusy(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBusy(false), BUSY_TIMEOUT_MS);
  }, [send]);

  const onScan = useCallback((path?: string) => { setResult(null); begin({ t: 'claude-import-scan', path: path?.trim() || undefined }); }, [begin]);
  const onApply = useCallback((kinds: ImportKind[], path?: string) => begin({ t: 'claude-import-apply', kinds, path: path?.trim() || undefined }), [begin]);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'claude-import') return false;
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
    setScan(msg.scan);
    setHint(msg.hint ?? null);
    if (msg.result) setResult(msg.result);
    return true;
  }, []);

  return { scan, hint, result, busy, onScan, onApply, onMsg };
}
