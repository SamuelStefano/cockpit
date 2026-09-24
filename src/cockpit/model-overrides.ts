// Which per-session model overrides to persist: never the ephemeral `new-` keys,
// and (once the session list is known) only sessions that still exist.
export function persistableModelOverrides(map: Record<string, string>, known: ReadonlySet<string> | null): Record<string, string> {
  const keep: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (k.startsWith('new-')) continue;
    if (known && !known.has(k)) continue;
    keep[k] = v;
  }
  return keep;
}
