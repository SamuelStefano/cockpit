// When the agent announced a planned restart (self-update). The offline latch reads
// it to show a neutral notice instead of the red "backend unreachable" banner.
let announcedAt: number | null = null;

export const RESTART_NOTICE_MS = 60_000;

export function markAgentRestarting(now = Date.now()): void { announcedAt = now; }
export function restartAnnouncedRecently(now = Date.now()): boolean {
  return announcedAt !== null && now - announcedAt < RESTART_NOTICE_MS;
}
export function clearAgentRestarting(): void { announcedAt = null; }
