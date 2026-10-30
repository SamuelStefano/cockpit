import { useCallback, useEffect, useRef, useState } from 'react';
import type { BitState } from './bit-state';
import { usePlayAllowed } from './play/usePlayAllowed';
import { PET_MS, SLEEP_AFTER_MS, WAKE_MS, registerClick } from './logo-bit';

// The sidebar logo has a life of its own: it dozes off after 3 idle minutes and
// wakes with a start on the next pointer move, is petted by 3 quick clicks (hearts),
// and startles when the app state turns into an error.
export function useLogoBit(base: BitState) {
  const allowed = usePlayAllowed();
  const [override, setOverride] = useState<BitState | null>(null);
  const [hearts, setHearts] = useState(0);
  const [startle, setStartle] = useState(false);
  const asleep = useRef(false);
  const clicks = useRef<number[]>([]);
  const timers = useRef<number[]>([]);
  const baseRef = useRef(base);
  baseRef.current = base;
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  useEffect(() => {
    if (!allowed) { asleep.current = false; setOverride(null); return; }
    let sleepTimer = 0;
    const arm = () => {
      window.clearTimeout(sleepTimer);
      sleepTimer = window.setTimeout(() => {
        if (baseRef.current !== 'idle') { arm(); return; }
        asleep.current = true;
        setOverride('sleeping');
      }, SLEEP_AFTER_MS);
    };
    const onActivity = () => {
      if (asleep.current) {
        asleep.current = false;
        setOverride('surprised');
        setStartle(true);
        later(() => { setOverride(null); setStartle(false); }, WAKE_MS);
      }
      arm();
    };
    const events = ['pointermove', 'pointerdown', 'keydown'] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true, capture: true });
    arm();
    return () => { window.clearTimeout(sleepTimer); for (const e of events) window.removeEventListener(e, onActivity, { capture: true }); };
  }, [allowed]);

  useEffect(() => {
    if (base !== 'error' || !allowed) return;
    setStartle(true);
    later(() => setStartle(false), 650);
  }, [base, allowed]);

  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);

  const pet = useCallback(() => {
    if (!allowed) return;
    const r = registerClick(clicks.current, Date.now());
    clicks.current = r.times;
    if (!r.pet) return;
    setOverride('happy');
    setHearts((n) => n + 1);
    later(() => setOverride(null), PET_MS);
  }, [allowed]);

  return { state: override ?? base, startle, hearts, pet };
}
