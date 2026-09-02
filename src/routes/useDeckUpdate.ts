import { useEffect, useState } from 'react';

export type DeckUpdateBusy = 'cli' | 'restart' | null;

// `claude update` demora (download); sem trava o botão aceitava double-click.
// O backend sempre responde com adminOp, então qualquer resultado rearma. O
// backstop cobre o WS caindo no meio — inclusive o restart 'now', que derruba o
// próprio socket antes de qualquer resposta chegar.
export function useDeckUpdate(adminOp: { ok: boolean; message: string } | null, onCliUpdate: () => void, onDeckRestart: (mode: 'idle' | 'now') => void) {
  const [busy, setBusy] = useState<DeckUpdateBusy>(null);
  const [confirmNow, setConfirmNow] = useState(false);

  useEffect(() => { setBusy(null); }, [adminOp]);
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(null), busy === 'cli' ? 200_000 : 30_000);
    return () => clearTimeout(t);
  }, [busy]);

  return {
    busy,
    confirmNow,
    updateCli: () => { setBusy('cli'); onCliUpdate(); },
    restartIdle: () => { setBusy('restart'); onDeckRestart('idle'); },
    askRestartNow: () => setConfirmNow(true),
    cancelRestartNow: () => setConfirmNow(false),
    restartNow: () => { setConfirmNow(false); setBusy('restart'); onDeckRestart('now'); },
  };
}
