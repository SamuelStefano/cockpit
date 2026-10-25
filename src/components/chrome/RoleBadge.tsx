import { Badge } from '../primitives';
import type { NavRole } from './nav-routes';
import { roleBadge } from './role-badge';

// Hidden below sm like the ConnDot: at 360–390px the right cluster already fills
// the header.
export function RoleBadge({ role }: { role: NavRole }) {
  const b = roleBadge(role);
  if (!b) return null;
  return <Badge tone={b.tone} title={b.title} className="hidden shrink-0 font-mono sm:inline-flex">{b.label}</Badge>;
}
