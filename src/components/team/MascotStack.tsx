import type { TeamMascot } from '../../../shared/protocol';
import { Mascot } from './Mascot';

interface MascotStackProps { mascots: { id: string; mascot: TeamMascot; name: string }[]; size?: number }

export function MascotStack({ mascots, size = 16 }: MascotStackProps) {
  return (
    <span className="inline-flex items-center">
      {mascots.slice(0, 4).map((m, i) => (
        <span key={m.id} className={`rounded-full ring-2 ring-neutral-900 ${i ? '-ml-1.5' : ''}`}>
          <Mascot mascot={m.mascot} size={size} name={m.name} />
        </span>
      ))}
    </span>
  );
}
