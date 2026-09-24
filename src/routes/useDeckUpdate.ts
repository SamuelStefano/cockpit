import { useEffect, useState } from 'react';

export type DeckUpdateBusy = 'cli' | 'restart' | null;

// `claude update` demora (download); sem trava o botão aceitava double-click.
// O backend sempre responde com adminOp, então qualquer resultado rearma. O
// backstop cobre o WS caindo no meio — inclusive o restart 'now', que derruba o
// próprio socket antes de qualquer resposta chegar.
export function useDeckUpdate(adminOp: { ok: boolean; message: string } | null, onCliUpdate: () => void, onDeckRestart: (mode: 'idle' | 'now') => void) {
  const [busy, setBusy] = useState<DeckUpdateBusy>(null);
  const [confirmNow, setConfirmNow] = useState(false);

  // Only a RESULT releases the lock. adminOp auto-resets to null 4–8s after the
  // previous op, and treating that reset as a result re-enabled the buttons in the
  // middle of `claude update` (a second update, or a restart mid-update).
  useEffect(() => { if (adminOp) setBusy(null); }, [adminOp]);
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
