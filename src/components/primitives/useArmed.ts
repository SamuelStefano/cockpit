import { useEffect, useState } from 'react';

// Two taps for a destructive button: the first arms it (the caller relabels it
// "confirmar?"), the second within `ms` runs the action. One mis-tap on a phone
// no longer deletes a card or a flow.
export function useArmed(ms = 3000): { armed: boolean; fire: (action: () => void) => void } {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ms);
    return () => clearTimeout(t);
  }, [armed, ms]);
  const fire = (action: () => void) => {
    if (armed) { setArmed(false); action(); } else setArmed(true);
  };
  return { armed, fire };
}
