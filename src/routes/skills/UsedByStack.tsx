import { Mascot } from '../../components/team/Mascot';
import type { TeamBot } from '../../../shared/protocol';
import { usedByLabel } from '../../lib/skill-view';

export function UsedByStack({ ids, bots }: { ids: string[]; bots: TeamBot[] }) {
  const users = ids.map((id) => bots.find((b) => b.id === id)).filter((b): b is TeamBot => !!b);
  if (users.length === 0) return <span className="text-[12px] text-neutral-600">{usedByLabel(0)}</span>;
  return (
    <span className="flex items-center">
      {users.slice(0, 3).map((b, i) => (
        <span key={b.id} className={`rounded-full ring-2 ring-neutral-900 ${i ? '-ml-1.5' : ''}`}><Mascot mascot={b.mascot} size={22} name={b.name} /></span>
      ))}
      <span className="ml-2 text-[12px] text-neutral-500">{users.length > 3 ? users.length : usedByLabel(users.length)}</span>
    </span>
  );
}
