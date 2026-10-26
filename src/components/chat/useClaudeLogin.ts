import { useEffect, useState } from 'react';
import type { ClaudeLoginView } from '../../../shared/protocol';

interface Options {
  login?: ClaudeLoginView;
  onStart?: () => void;
  onCode?: (code: string) => void;
  onCancel?: () => void;
}

export const LOGIN_REPLY_TIMEOUT_MS = 15_000;

export function useClaudeLogin({ login = { state: 'idle' }, onStart, onCode, onCancel }: Options) {
  const [code, setCode] = useState('');
  const [noReply, setNoReply] = useState(false);
  const trimmed = code.trim();
  const awaitingReply = login.optimistic === true;

  // An agent older than the frame never answers; without this the button spins forever.
  useEffect(() => {
    if (!awaitingReply) { setNoReply(false); return; }
    const timer = setTimeout(() => setNoReply(true), LOGIN_REPLY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [awaitingReply]);

  const busy = !noReply && (login.state === 'waiting-url' || login.state === 'verifying');

  const start = () => { setCode(''); setNoReply(false); onStart?.(); };
  const submit = () => {
    if (!trimmed || login.state !== 'url') return;
    onCode?.(trimmed);
    setCode('');
  };
  const reset = () => { setCode(''); setNoReply(false); onCancel?.(); };

  return {
    state: noReply ? ('error' as const) : login.state,
    url: login.url,
    error: login.error,
    noReply,
    code,
    setCode,
    busy,
    canSubmit: login.state === 'url' && trimmed.length > 0,
    start,
    submit,
    reset,
  };
}
