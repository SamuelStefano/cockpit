// Turn start times come from the server, which is the only side that saw the
// turn begin. A reload restamps every running key with the client's clock (the
// timer effect fills gaps with Date.now()), so a server value always wins over
// whatever is there. Returns null when nothing changes, to skip a re-render.
export function seedRunStart(
  cur: Record<string, number>,
  starts: Record<string, number> | undefined,
  resolve: (serverKey: string) => string = (k) => k,
): Record<string, number> | null {
  if (!starts) return null;
  let next: Record<string, number> | null = null;
  for (const [serverKey, at] of Object.entries(starts)) {
    if (!Number.isFinite(at) || at <= 0) continue;
    const key = resolve(serverKey);
    if (cur[key] === at) continue;
    next ??= { ...cur };
    next[key] = at;
  }
  return next;
}
