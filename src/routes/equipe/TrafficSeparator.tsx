import { Button } from '../../components/primitives';
import { MascotStack } from '../../components/team/MascotStack';
import type { TeamBot } from '../../../shared/protocol';

interface TrafficSeparatorProps { count: number; peers: { id: string; bot: TeamBot | undefined }[]; onOpen: (peerId: string) => void }

export function TrafficSeparator({ count, peers, onOpen }: TrafficSeparatorProps) {
  const known = peers.flatMap((p) => (p.bot ? [{ id: p.id, mascot: p.bot.mascot, name: p.bot.name }] : []));
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 text-[12px] text-neutral-500">
      <span>{count} mensagens com</span>
      <MascotStack mascots={known} />
      {peers.map((p, i) => (
        <span key={p.id} className="inline-flex items-center gap-1">
          {i > 0 && <span>{i === peers.length - 1 ? 'e' : ','}</span>}
          <Button variant="ghost" size="xs" onClick={() => onOpen(p.id)} aria-label={`Abrir conversa com ${p.bot?.name ?? p.id}`}>
            <span className="text-neutral-300">{p.bot?.name ?? p.id}</span>
          </Button>
        </span>
      ))}
    </div>
  );
}
