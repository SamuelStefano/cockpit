export type CatchId = 'fish' | 'bug' | 'token' | 'boot' | 'star';

export interface Catch { id: CatchId; emoji: string; label: string; weight: number }

export const CATCHES: Catch[] = [
  { id: 'fish', emoji: '🐟', label: 'peixe', weight: 38 },
  { id: 'bug', emoji: '🐛', label: 'bug', weight: 24 },
  { id: 'token', emoji: '🪙', label: 'token', weight: 22 },
  { id: 'boot', emoji: '👢', label: 'bota velha', weight: 14 },
  { id: 'star', emoji: '⭐', label: 'estrela', weight: 2 },
];

export const BITE_MIN_MS = 10_000;
export const BITE_MAX_MS = 25_000;
export const CLICK_COOLDOWN_MS = 5_000;
export const BITE_DELAY_DIP_MS = 800;
// Room Bit needs on one side of the message column: itself, the line and the bucket.
export const MIN_MARGIN_PX = 132;
export const COLUMN_MAX_PX = 760;
export const THREAD_PADDING_PX = 12;

type Rnd = () => number;

export const nextBiteDelay = (rnd: Rnd = Math.random): number => BITE_MIN_MS + rnd() * (BITE_MAX_MS - BITE_MIN_MS);

export function rollCatch(rnd: Rnd = Math.random): Catch {
  const total = CATCHES.reduce((n, c) => n + c.weight, 0);
  let r = rnd() * total;
  for (const c of CATCHES) {
    r -= c.weight;
    if (r < 0) return c;
  }
  return CATCHES[0];
}

export const clickAllowed = (now: number, lastCatchAt: number): boolean => now - lastCatchAt >= CLICK_COOLDOWN_MS;

// Free space beside the centred message column (the thread keeps a small gutter).
export function freeMargin(containerWidth: number): number {
  const column = Math.min(COLUMN_MAX_PX, Math.max(0, containerWidth - THREAD_PADDING_PX * 2));
  return Math.max(0, (containerWidth - column) / 2);
}

export const marginFits = (containerWidth: number): boolean => freeMargin(containerWidth) >= MIN_MARGIN_PX;

export type FishPhase = 'off' | 'enter' | 'fish' | 'reel' | 'wave' | 'leave';

export const PHASE_MS: Record<'enter' | 'reel' | 'wave' | 'leave', number> = { enter: 1100, reel: 800, wave: 1200, leave: 1500 };
