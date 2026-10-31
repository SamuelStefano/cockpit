import { BITE_DELAY_DIP_MS, PHASE_MS, clickAllowed, nextBiteDelay, rollCatch, type Catch, type FishPhase } from './fishing';

export interface FishingHandlers {
  phase: (p: FishPhase) => void;
  // The bobber dips; the catch follows BITE_DELAY_DIP_MS later.
  bite: () => void;
  caught: (c: Catch) => void;
}

// WHEN Bit fishes: enter, fish while a turn runs, reel/wave/leave when it ends.
// Knows nothing about the DOM; all time goes through setTimeout/Date.now.
export class FishingSession {
  private phase: FishPhase = 'off';
  private lastBiteAt = -Infinity;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private biteTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private h: FishingHandlers, private rnd: () => number = Math.random) {}

  get current(): FishPhase { return this.phase; }

  setActive(on: boolean): void {
    if (on) {
      if (this.phase === 'enter' || this.phase === 'fish') return;
      this.clear();
      this.go('enter');
      this.after(PHASE_MS.enter, () => { this.go('fish'); this.scheduleBite(); });
      return;
    }
    if (this.phase !== 'enter' && this.phase !== 'fish') return;
    this.clear();
    this.go('reel');
    this.after(PHASE_MS.reel, () => {
      this.go('wave');
      this.after(PHASE_MS.wave, () => {
        this.go('leave');
        this.after(PHASE_MS.leave, () => this.go('off'));
      });
    });
  }

  // Straight off stage (play turned off, no room left, unmount).
  stop(): void {
    this.clear();
    if (this.phase !== 'off') this.go('off');
  }

  click(now = Date.now()): boolean {
    if (this.phase !== 'fish' || !clickAllowed(now, this.lastBiteAt)) return false;
    this.clearBite();
    this.bite();
    return true;
  }

  private go(p: FishPhase) { this.phase = p; this.h.phase(p); }

  private after(ms: number, fn: () => void) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
    return t;
  }

  private scheduleBite() {
    this.biteTimer = this.after(nextBiteDelay(this.rnd), () => { this.biteTimer = null; this.bite(); });
  }

  private clearBite() {
    if (!this.biteTimer) return;
    clearTimeout(this.biteTimer);
    this.timers.delete(this.biteTimer);
    this.biteTimer = null;
  }

  private bite() {
    this.lastBiteAt = Date.now();
    this.h.bite();
    this.biteTimer = this.after(BITE_DELAY_DIP_MS, () => {
      this.biteTimer = null;
      if (this.phase !== 'fish') return;
      this.h.caught(rollCatch(this.rnd));
      this.scheduleBite();
    });
  }

  private clear() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.biteTimer = null;
  }
}
