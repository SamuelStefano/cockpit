import { useEffect } from 'react';
import { usePersisted } from '../persist';
import { fireConfetti } from '../../components/primitives/confetti-bus';
import type { MonthCap } from '../../routes/pontos/month-cap';

export const CAP_CELEBRATED_KEY = 'gam.capCelebrated';

// The month bar filled exactly to the agreed cap (not past it) and that month has not been
// celebrated yet. A calm signal, not a game: once per month.
export function shouldCelebrateCap(cap: Pick<MonthCap, 'month' | 'state' | 'capCents'> | null, celebrated: string): boolean {
  return !!cap && cap.capCents > 0 && cap.state === 'full' && cap.month !== celebrated;
}

export function useCapCelebration(cap: MonthCap | null): void {
  const [celebrated, setCelebrated] = usePersisted<string>(CAP_CELEBRATED_KEY, '');
  useEffect(() => {
    if (!cap || !shouldCelebrateCap(cap, celebrated)) return;
    setCelebrated(cap.month);
    fireConfetti({ count: 70, spread: 0.8 });
  }, [cap, celebrated, setCelebrated]);
}
