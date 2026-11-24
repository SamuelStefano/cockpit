import { isDrainerEnabled } from '../ws/runs';
import { runRound, type RoundResult } from './round';

export const ROUND_INTERVAL_MS = 60 * 60_000;
export const ROUND_FIRST_MS = 2 * 60_000;

let started = false;

async function safeRound(): Promise<RoundResult | null> {
  try { return await runRound(); } catch (e) { console.error('[village]', (e as Error).message); return null; }
}

export function startVillageRound(intervalMs = ROUND_INTERVAL_MS, firstMs = ROUND_FIRST_MS): void {
  if (started || !isDrainerEnabled()) return;
  started = true;
  const loop = () => { void safeRound().finally(() => { setTimeout(loop, intervalMs).unref(); }); };
  setTimeout(loop, firstMs).unref();
}

export function runRoundNow(): Promise<RoundResult | null> {
  return safeRound();
}
