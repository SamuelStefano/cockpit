export function filterCommands<T extends { label: string; group: string }>(commands: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return commands;
  return commands.filter((c) => c.label.toLowerCase().includes(needle) || c.group.toLowerCase().includes(needle));
}

export function groupByOrder<T extends { group: string }>(items: T[]): { name: string; items: T[] }[] {
  const groups: { name: string; items: T[] }[] = [];
  for (const c of items) {
    let g = groups.find((x) => x.name === c.group);
    if (!g) { g = { name: c.group, items: [] }; groups.push(g); }
    g.items.push(c);
  }
  return groups;
}

// With no query the palette lists only the most recent sessions; with a query
// every session is searchable (it used to search only the first 40).
export const SESSIONS_IDLE = 40;
export const SESSIONS_MATCHED = 100;

export function capSessions<T extends { group: string }>(items: T[], query: string, group = 'Sessões'): T[] {
  const max = query.trim() ? SESSIONS_MATCHED : SESSIONS_IDLE;
  let n = 0;
  return items.filter((c) => c.group !== group || n++ < max);
}
