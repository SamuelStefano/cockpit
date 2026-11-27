import { useCallback, useRef, useState } from 'react';
import type { PermMode } from '../../../shared/protocol';
import { needsAiConsent, recordAiConsent } from '../../lib/aiConsent';

type Send = (text: string, modeOverride?: PermMode) => void;

// Holds the first send of an account until the consent sheet is agreed. Outside the
// shell needsAiConsent is always false, so the guard is a pass-through.
export function useAiConsent(accountId: string | undefined, send: Send, restoreDraft: (text: string) => void) {
  const [open, setOpen] = useState(false);
  const held = useRef<Parameters<Send> | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  const guarded = useCallback<Send>((text, modeOverride) => {
    if (needsAiConsent(accountId)) { held.current = [text, modeOverride]; setOpen(true); return; }
    sendRef.current(text, modeOverride);
  }, [accountId]);

  const agree = useCallback(() => {
    recordAiConsent(accountId);
    const h = held.current;
    held.current = null;
    setOpen(false);
    if (h) sendRef.current(h[0], h[1]);
  }, [accountId]);

  const decline = useCallback(() => {
    const h = held.current;
    held.current = null;
    setOpen(false);
    if (h) restoreDraft(h[0]);
  }, [restoreDraft]);

  return { send: guarded, open, agree, decline };
}
