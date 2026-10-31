export type MischiefReason = 'idle' | 'thinking';

export interface MischiefTiming {
  idleMs: number;
  thinkMs: number;
  cooldownMs: number;
  // A skit never starts within this long of the user's last touch, even when the
  // long-thinking timer fires: they may be mid-sentence in the composer.
  quietMs: number;
}

export const MISCHIEF_TIMING: MischiefTiming = { idleMs: 45_000, thinkMs: 20_000, cooldownMs: 150_000, quietMs: 4_000 };

export interface MischiefHandlers {
  start: (reason: MischiefReason) => void;
  // The user came back while Bit was on stage: it has to leave now.
  interrupt: () => void;
}

// Decides WHEN Bit may play; knows nothing about the DOM or the skits. All time
// goes through setTimeout/Date.now so fake timers drive it in tests.
export class MischiefScheduler {
  private enabled = false;
  private thinking = false;
  private playing = false;
  private lastActivity = Date.now();
  private cooldownUntil = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private thinkTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private h: MischiefHandlers, private t: MischiefTiming = MISCHIEF_TIMING) {}

  get isPlaying() { return this.playing; }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) {
      this.clear();
      if (this.playing) { this.playing = false; this.h.interrupt(); }
      return;
    }
    this.lastActivity = Date.now();
    this.armIdle();
    if (this.thinking) this.armThink(this.t.thinkMs);
  }

  setThinking(on: boolean): void {
    if (on === this.thinking) return;
    this.thinking = on;
    if (this.thinkTimer) clearTimeout(this.thinkTimer);
    this.thinkTimer = null;
    if (on && this.enabled) this.armThink(this.t.thinkMs);
  }

  activity(): void {
    this.lastActivity = Date.now();
    if (this.playing) { this.playing = false; this.cooldownUntil = Date.now() + this.t.cooldownMs; this.h.interrupt(); }
    if (this.enabled) this.armIdle();
  }

  // The skit (or its hurried exit) left the stage.
  ended(): void {
    if (!this.playing) return;
    this.playing = false;
    this.cooldownUntil = Date.now() + this.t.cooldownMs;
    if (this.enabled) this.armIdle();
  }

  dispose(): void { this.clear(); }

  private clear() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.thinkTimer) clearTimeout(this.thinkTimer);
    this.idleTimer = this.thinkTimer = null;
  }

  private armIdle(delay = this.t.idleMs) {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => { this.idleTimer = null; this.tryStart('idle'); }, delay);
  }

  private armThink(delay: number) {
    if (this.thinkTimer) clearTimeout(this.thinkTimer);
    this.thinkTimer = setTimeout(() => { this.thinkTimer = null; this.tryStart('thinking'); }, delay);
  }

  private tryStart(reason: MischiefReason) {
    if (!this.enabled || this.playing) return;
    const now = Date.now();
    const wait = Math.max(this.cooldownUntil - now, this.lastActivity + this.t.quietMs - now, reason === 'idle' ? this.lastActivity + this.t.idleMs - now : 0);
    if (wait > 0) {
      if (reason === 'idle') this.armIdle(wait);
      else if (this.thinking) this.armThink(wait);
      return;
    }
    this.playing = true;
    this.clear();
    this.h.start(reason);
  }
}
