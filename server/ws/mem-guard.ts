import { readFileSync } from 'node:fs';
import { freemem } from 'node:os';

// Single source of truth for "how much memory is left on this box". Used both by
// the health guard (server/agent.ts) and by the resume/admission gates below —
// having two readers of /proc/meminfo drifting apart was how D1/D2/D5 stayed
// unfixed: nobody could reuse the parsing to decide "is it safe to resume now".
export interface MemInfo {
  availMb: number;
  swapFreeMb: number;
  swapTotalMb: number;
}

// Pure parser: takes /proc/meminfo's raw text, returns null when MemAvailable is
// absent (non-Linux /proc, or a mocked FS in tests) so the caller can fall back.
export function parseMemInfoText(text: string): MemInfo | null {
  const avail = text.match(/MemAvailable:\s+(\d+)\s+kB/);
  if (!avail) return null;
  const swapTotal = text.match(/SwapTotal:\s+(\d+)\s+kB/);
  const swapFree = text.match(/SwapFree:\s+(\d+)\s+kB/);
  return {
    availMb: Math.round(Number(avail[1]) / 1024),
    swapTotalMb: swapTotal ? Math.round(Number(swapTotal[1]) / 1024) : 0,
    swapFreeMb: swapFree ? Math.round(Number(swapFree[1]) / 1024) : 0,
  };
}

// Reads MemAvailable from /proc (what actually drives the OOM killer on Linux);
// falls back to os.freemem() with swap reported as zero on FS without /proc.
export function readMemInfo(): MemInfo {
  try {
    const parsed = parseMemInfoText(readFileSync('/proc/meminfo', 'utf8'));
    if (parsed) return parsed;
  } catch { /* sem /proc */ }
  return { availMb: Math.round(freemem() / 1048576), swapFreeMb: 0, swapTotalMb: 0 };
}

export const DEFAULT_MIN_AVAIL_MB = 500;

function minAvailMb(): number {
  return Number(process.env.COCKPIT_MIN_AVAIL_MB ?? DEFAULT_MIN_AVAIL_MB);
}

function swapFreePct(info: MemInfo): number | null {
  if (info.swapTotalMb <= 0) return null;
  return (info.swapFreeMb / info.swapTotalMb) * 100;
}

// Pure verdict: 'low' triggers every gate below (D2 resume backoff, D2 drain
// pause, D5 admission cap). Two independent tripwires: MemAvailable itself, or
// swap almost exhausted WHILE MemAvailable is still tight (< 900MB) — a box can
// have decent MemAvailable but be seconds from earlyoom if swap is the only
// thing holding it up.
export function memoryVerdict(info: MemInfo, opts?: { minAvailMb?: number }): 'ok' | 'low' {
  const min = opts?.minAvailMb ?? minAvailMb();
  if (info.availMb < min) return 'low';
  const pct = swapFreePct(info);
  if (pct !== null && pct < 10 && info.availMb < 900) return 'low';
  return 'ok';
}

// Classifies a dead-without-result turn (runs.ts's `isSilentDeath`) as an OOM
// kill rather than a generic crash. exitCode 143/137 (SIGTERM/SIGKILL exit
// convention) or the raw signal, PLUS the box actually looking starved at the
// moment of death — a `claude` crash with a normal 143 on a healthy box is not
// an OOM kill, it's some other bug.
export function looksLikeOomKill(args: {
  exitCode?: number | null;
  signal?: string | null;
  userStopped?: boolean;
  reaped?: boolean;
  info: MemInfo;
}): boolean {
  if (args.userStopped || args.reaped) return false;
  const codeMatches = args.exitCode === 143 || args.exitCode === 137;
  const signalMatches = args.signal === 'SIGTERM' || args.signal === 'SIGKILL';
  if (!codeMatches && !signalMatches) return false;
  if (memoryVerdict(args.info) === 'low') return true;
  const pct = swapFreePct(args.info);
  return pct !== null && pct < 10;
}

// D2 backoff progression for the memory-aware auto-resume retry (does NOT count
// against AUTO_RESUME_CAP). 30s, 60s, 120s, then capped at 5min per step, until
// the running total would exceed ~30min — at which point the caller gives up
// waiting and falls through to the normal (capped) auto-resume attempt.
const RESUME_BACKOFF_STEPS_MS = [30_000, 60_000, 120_000];
const RESUME_BACKOFF_CAP_MS = 5 * 60_000;
const RESUME_BACKOFF_BUDGET_MS = 30 * 60_000;

export function nextResumeDelayMs(attempt: number): number | null {
  const n = Math.max(1, Math.floor(attempt));
  const delay = n <= RESUME_BACKOFF_STEPS_MS.length ? RESUME_BACKOFF_STEPS_MS[n - 1] : RESUME_BACKOFF_CAP_MS;
  const priorSteps = Math.min(n - 1, RESUME_BACKOFF_STEPS_MS.length);
  const priorCapped = Math.max(0, n - 1 - RESUME_BACKOFF_STEPS_MS.length);
  const elapsedBefore = RESUME_BACKOFF_STEPS_MS.slice(0, priorSteps).reduce((a, b) => a + b, 0)
    + priorCapped * RESUME_BACKOFF_CAP_MS;
  if (elapsedBefore + delay > RESUME_BACKOFF_BUDGET_MS) return null;
  return delay;
}

// D5 admission cap. MemAvailable already reflects the runs that are alive, so the
// budget is "live runs + how many MORE fit" (~350MB each, 400MB kept for the
// OS/agent). Never below 1 (a starved box still has to let one chat run) and never
// above the operator's own configured ceiling.
export function memoryRunCap(availMb: number, base: number, liveRuns = 0): number {
  const extra = Math.max(0, Math.floor((availMb - 400) / 350));
  return Math.min(base, Math.max(1, liveRuns + extra));
}
