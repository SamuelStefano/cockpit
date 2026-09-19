import { looksLikeOomKill, type MemInfo } from './mem-guard';

// Why a turn died, decided from the exit code/signal plus the box state at close
// time. The auto-resume path needs this distinction: a turn that CRASHED can be
// re-fired at once (the condition is gone with the process), while a turn killed
// by an EXTERNAL signal — a deploy restarting the box, an earlyoom sweep, a
// manual pkill — died from a condition that is still there. Re-firing into it
// burns the single AUTO_RESUME_CAP attempt in seconds and the turn is lost
// anyway: that is the run-error "claude saiu (143)" -> silent-death ->
// resume-exhausted chain seen on 2026-09-17T14:40Z across two sessions at once.
export type DeathCause = 'user-stop' | 'reaped' | 'oom' | 'external-signal' | 'crash';

export function classifyDeath(a: {
  exitCode?: number | null;
  signal?: string | null;
  userStopped?: boolean;
  reaped?: boolean;
  info: MemInfo;
}): DeathCause {
  if (a.userStopped) return 'user-stop';
  if (a.reaped) return 'reaped';
  // OOM is an external signal too, but it already has its own message, incident
  // and (memory-gated) resume path — keep it ahead so nothing changes for it.
  if (looksLikeOomKill(a)) return 'oom';
  const bySignal = a.signal === 'SIGTERM' || a.signal === 'SIGKILL';
  const byCode = a.exitCode === 143 || a.exitCode === 137;
  return bySignal || byCode ? 'external-signal' : 'crash';
}

// A deploy kills every `claude` child within the same second or two, and the new
// process comes up right after. Resuming has to wait for that wave to stop
// arriving, not for a fixed delay: on 2026-09-17 a second wave landed 2s and 5s
// after the first, so a fixed sleep would have raced the restart all the same.
export const EXTERNAL_QUIET_MS = 45_000;
// How often the wait loop re-checks. Small enough that a settled box resumes
// fast, large enough that the loop costs nothing.
export const EXTERNAL_POLL_MS = 15_000;
// Kills that keep arriving past this are not a deploy, they are a crash loop:
// stop waiting and hand the turn to the user instead of resuming forever.
export const EXTERNAL_WAIT_BUDGET_MS = 10 * 60_000;

let lastKillAt = 0;

export function noteExternalKill(at = Date.now()): void {
  if (at > lastKillAt) lastKillAt = at;
}

export function lastExternalKillAt(): number {
  return lastKillAt;
}

export function resetExternalKills(): void {
  lastKillAt = 0;
}

export type ExternalGate = 'go' | 'wait' | 'give-up';

// 'go' only once the box has been quiet for EXTERNAL_QUIET_MS since the LAST
// external kill — any sibling dying in the meantime pushes the window forward,
// which is what makes this track the wave instead of a timer.
export function externalResumeGate(a: {
  lastKillAt: number;
  now: number;
  waitedMs: number;
  quietMs?: number;
  budgetMs?: number;
}): ExternalGate {
  const quiet = a.quietMs ?? EXTERNAL_QUIET_MS;
  const budget = a.budgetMs ?? EXTERNAL_WAIT_BUDGET_MS;
  if (a.now - a.lastKillAt >= quiet) return 'go';
  if (a.waitedMs >= budget) return 'give-up';
  return 'wait';
}
