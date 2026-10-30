import { useEffect, useRef } from 'react';

// One shot after the team list arrives. A later render must not pull the
// open chat back to the lead while the person is looking at another card.
export function useTalkOnce(leadId: string, onTalk: () => void) {
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !leadId) return;
    opened.current = true;
    onTalk();
  }, [leadId, onTalk]);
}
