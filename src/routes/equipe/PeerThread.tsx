import { Button, EmptyState, Icon } from '../../components/primitives';
import { Mascot } from '../../components/team/Mascot';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';
import { PeerBubble } from './PeerBubble';
import { usePeerThread } from './usePeerThread';

interface PeerThreadProps { a: TeamBot; b: TeamBot; log: TeamMessage[]; byId: Map<string, TeamBot>; onBack: () => void }

// Read-only: the two bots talk through team_send, a person only watches.
export function PeerThread({ a, b, log, byId, onBack }: PeerThreadProps) {
  const items = usePeerThread(log, a.id, b.id);
  return (
    <div className="flex h-full min-w-0 flex-col bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <Button variant="ghost" size="sm" icon="chevronLeft" square aria-label={`Voltar pra ${a.name}`} onClick={onBack} />
        <div className="mx-auto flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 py-1 pl-1.5 pr-3.5 text-[14px] font-medium text-neutral-100">
          <Mascot mascot={a.mascot} size={22} name={a.name} />
          {a.name}
          <Icon name="swap" size={13} className="text-neutral-500" />
          <Mascot mascot={b.mascot} size={22} name={b.name} />
          {b.name}
        </div>
        <span className="w-8" />
      </div>
      <div role="log" aria-label={`Conversa entre ${a.name} e ${b.name}`} className="scroll-thin flex-1 overflow-y-auto">
        {items.length === 0
          ? <EmptyState icon="message" title="Sem mensagens" description={`${a.name} e ${b.name} ainda não trocaram mensagens.`} />
          : <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">{items.map((m) => <PeerBubble key={m.id} message={m} sender={byId.get(m.from)} />)}</div>}
      </div>
    </div>
  );
}
