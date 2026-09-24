export const DRAFTS_SAVE_MS = 400;

// Only real sessions (uuid keys) with text survive a reload: `new-…` keys are
// ephemeral and never match again after one.
export function persistableDrafts(drafts: Record<string, string>): Record<string, string> {
  const keep: Record<string, string> = {};
  for (const [k, v] of Object.entries(drafts)) if (v && !k.startsWith('new-')) keep[k] = v;
  return keep;
}
