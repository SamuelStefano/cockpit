import { Button } from '../primitives';
import { PasskeyUnlock } from './PasskeyUnlock';
import { usePasskeyOffer } from './usePasskeyOffer';

// Shown inside the Deck on a browser enrolled with its random key: unlocking the
// passkey hands the box the passkey key over the sealed channel, and every
// browser where it syncs then opens this VPS with no code.
export function PasskeyOffer() {
  const { pk, show, dismiss } = usePasskeyOffer();
  if (!show) return null;
  return (
    <div className="fade-up pointer-events-none absolute left-1/2 top-2.5 z-40 w-[min(92vw,30rem)] -translate-x-1/2">
      <div className="pointer-events-auto rounded-lg border border-neutral-800 bg-neutral-900/95 px-3 pb-3 shadow-2xl shadow-black/40 backdrop-blur-md">
        <PasskeyUnlock pk={pk} />
        <div className="mt-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={dismiss}>Agora não</Button>
        </div>
      </div>
    </div>
  );
}
