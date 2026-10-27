import { Badge } from '../primitives';
import type { NavRole } from './nav-routes';
import { roleBadge } from './role-badge';

// Hidden below sm like the ConnDot: at 360–390px the right cluster already fills
// the header. The wrapper owns the display: Badge's own `inline-flex` beats a
// `hidden` passed through className, so the badge used to stay on phones.
export function RoleBadge({ role }: { role: NavRole }) {
  const b = roleBadge(role);
  if (!b) return null;
  return (
    <span className="hidden shrink-0 sm:inline-flex">
      <Badge tone={b.tone} title={b.title} className="font-mono">{b.label}</Badge>
    </span>
  );
}
