// Single source of truth for wire limits shared by client and server, so a
// client-side pre-check (e.g. the canvas prompt bar, useCockpit.onSendTo)
// can never drift from the server's own gate (server/config.ts
// CONFIG.maxPromptBytes, enforced in server/ws/runs.ts and server/ws/parked.ts).
export const MAX_PROMPT_BYTES = 100_000;

// Per-attachment cap (server/config.ts CONFIG.maxUploadBytes). 60MB fits a
// 3D model (.glb from Meshy/Tripo is usually 10-50MB); 15MB silently dropped them.
export const MAX_UPLOAD_BYTES = 60_000_000;

// Client watchdog for one upload: a hung upload must not spin forever, but a big
// file on a slow link is not hung. 75s floor, plus 1s per 200KB.
export function uploadWatchdogMs(bytes: number): number {
  return Math.max(75_000, Math.ceil(bytes / 200));
}
