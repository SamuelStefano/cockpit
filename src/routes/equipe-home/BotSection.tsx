import type { TeamStateBot } from '../../../shared/team-state';
import { BotRow } from './BotRow';

interface Props {
  title: string;
  bots: TeamStateBot[];
  recording: boolean;
  onOpen: (id: string) => void;
}

export function BotSection({ title, bots, recording, onOpen }: Props) {
  if (!bots.length) return null;
  return (
    <section aria-label={title} className="mb-6">
      <h2 className="mb-2 text-[12px] font-medium uppercase tracking-wider text-neutral-500">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
        {bots.map((b) => <BotRow key={b.id} bot={b} recording={recording} onOpen={() => onOpen(b.id)} />)}
      </div>
    </section>
  );
}
