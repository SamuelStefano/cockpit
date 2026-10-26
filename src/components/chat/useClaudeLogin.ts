import { useState } from 'react';
import type { ClaudeLoginView } from '../../../shared/protocol';

interface Options {
  login?: ClaudeLoginView;
  onStart?: () => void;
  onCode?: (code: string) => void;
  onCancel?: () => void;
}

export function useClaudeLogin({ login = { state: 'idle' }, onStart, onCode, onCancel }: Options) {
  const [code, setCode] = useState('');
  const trimmed = code.trim();
  const busy = login.state === 'waiting-url' || login.state === 'verifying';

  const start = () => { setCode(''); onStart?.(); };
  const submit = () => {
    if (!trimmed || login.state !== 'url') return;
    onCode?.(trimmed);
    setCode('');
  };
  const reset = () => { setCode(''); onCancel?.(); };

  return {
    state: login.state,
    url: login.url,
    error: login.error,
    code,
    setCode,
    busy,
    canSubmit: login.state === 'url' && trimmed.length > 0,
    start,
    submit,
    reset,
  };
}
