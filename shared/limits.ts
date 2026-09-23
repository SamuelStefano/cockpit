// Single source of truth for wire limits shared by client and server, so a
// client-side pre-check (e.g. the canvas prompt bar, useCockpit.onSendTo)
// can never drift from the server's own gate (server/config.ts
// CONFIG.maxPromptBytes, enforced in server/ws/runs.ts and server/ws/parked.ts).
export const MAX_PROMPT_BYTES = 100_000;
