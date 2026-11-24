import { Tooltip } from '../../primitives';
import type { Session } from '../../../data/types';
import { railInitial, railTint } from './rail-chats';

interface RailChatProps {
  session: Session;
  active: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
}

export function RailChat({ session, active, busy, onSelect }: RailChatProps) {
  const title = session.title || 'Conversa';
  return (
    <Tooltip label={busy ? `${title} · trabalhando` : title} side="right" className="inline-flex">
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        aria-label={title}
        aria-current={active ? 'true' : undefined}
        data-busy={busy || undefined}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 ${active ? 'bg-orange-500/12 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.3)]' : 'hover:bg-neutral-800/50'}`}
      >
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg font-display text-[15px] font-bold leading-none ${railTint(session.id)}`}>{railInitial(title)}</span>
        {busy && <span aria-hidden className="rail-busy-ring pointer-events-none absolute inset-0.5 rounded-xl" />}
        {busy && <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-neutral-950" />}
      </button>
    </Tooltip>
  );
}
