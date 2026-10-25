import { Badge } from '../primitives';

// How many things on a route wait on the user (Equipe: bots with an open question).
export function NavCount({ count }: { count?: number }) {
  if (!count) return null;
  return <Badge tone="orange" className="ml-1" title={`${count} esperando você`}>{count}</Badge>;
}
