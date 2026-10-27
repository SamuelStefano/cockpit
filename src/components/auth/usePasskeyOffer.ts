import { useState } from 'react';
import { usePasskeySetup } from './usePasskeySetup';

const DISMISSED = 'deck-passkey-offer-dismissed';

function readDismissed(): boolean {
  try { return localStorage.getItem(DISMISSED) === '1'; } catch { return false; }
}

// Offered once the browser is sealed with a key the passkey could replace; "agora
// não" is remembered per browser.
export function usePasskeyOffer() {
  const pk = usePasskeySetup();
  const [dismissed, setDismissed] = useState(readDismissed);
  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED, '1'); } catch { /* storage blocked */ }
  };
  return { pk, show: !dismissed && (pk.offer || pk.busy), dismiss };
}
