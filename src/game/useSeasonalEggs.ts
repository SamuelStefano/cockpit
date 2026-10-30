import { useEffect } from 'react';
import { toast } from '../components/primitives/toast-bus';
import { fireConfetti } from '../components/primitives/confetti-bus';
import { claimGameOnce } from './game-bus';
import { foundEgg } from './found-egg';
import { dayKey } from './engine';
import { isHalloween, isNewYear, isProgrammersDay, isFridayAfternoon } from './eggs';

const CHECK_MS = 10 * 60 * 1000;

export function checkSeasonal(now: Date): void {
  const year = String(now.getFullYear());
  if (isHalloween(now) && claimGameOnce('halloween', year)) foundEgg('halloween', '🎃 Doce ou travessura! O Bit vestiu a abóbora.');
  if (isNewYear(now) && claimGameOnce('newyear', year)) {
    fireConfetti({ count: 120 });
    toast('Feliz ano novo! 🎆', { durationMs: 4000 });
  }
  if (isProgrammersDay(now) && claimGameOnce('programmers-toast', year)) {
    toast('Dia do Programador (256º dia do ano): o primeiro turno de hoje vale +100 XP.', { durationMs: 6000 });
  }
  if (isFridayAfternoon(now) && claimGameOnce('friday', dayKey(now))) foundEgg('friday', 'Sexta depois das 16h. Deploy? Coragem.');
}

// Re-checked on an interval so a tab left open since Friday 15:50 still catches 16:00.
export function useSeasonalEggs(): void {
  useEffect(() => {
    const run = () => { try { checkSeasonal(new Date()); } catch { /* best-effort */ } };
    run();
    const id = window.setInterval(run, CHECK_MS);
    return () => window.clearInterval(id);
  }, []);
}
