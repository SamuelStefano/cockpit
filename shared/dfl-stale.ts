// When the DFL snapshot counts as too old to act on (invoicing reads open/paid
// status from it). Shared so the browser can re-derive it: the server only
// computes `stale` when the snapshot is read, so a tab left open while the sync
// keeps failing would otherwise keep a `stale: false` forever.
export const DFL_STALE_MS = 35 * 60 * 1000;

export function isSnapshotStale(syncedAt: number, now: number): boolean {
  return now - syncedAt > DFL_STALE_MS;
}
