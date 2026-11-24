import type { Session } from '../../../data/types';
import { RailChat } from './RailChat';
import { railChats } from './rail-chats';
import './rail.css';

interface RailChatsProps {
  sessions: Session[];
  running?: Set<string>;
  activeId: string;
  onSelect: (id: string) => void;
}

export function RailChats({ sessions, running, activeId, onSelect }: RailChatsProps) {
  const items = railChats(sessions, running, activeId);
  if (!items.length) return <div className="flex-1" />;
  return (
    <nav aria-label="Conversas" className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-hidden py-1">
      {items.map((s) => <RailChat key={s.id} session={s} active={s.id === activeId} busy={!!running?.has(s.id)} onSelect={onSelect} />)}
    </nav>
  );
}
