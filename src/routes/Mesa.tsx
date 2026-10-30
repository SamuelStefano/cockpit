import { ChatPanel } from '../components/Chat';
import type { ChatPanelProps } from '../components/chat/chat-panel-props';
import type { QueueItem } from '../useCockpit';
import type { Session } from '../data/types';
import { Badge, RouteHeader } from '../components/primitives';
import { MesaFila } from './MesaFila';
import { MesaMudancas } from './MesaMudancas';
import { MesaPalco } from './MesaPalco';

interface Props {
  chat: ChatPanelProps;
  sessions: Session[];
  running: Set<string>;
  queue: QueueItem[];
  onOpen: (id: string) => void;
}

export function Mesa({ chat, sessions, running, queue, onOpen }: Props) {
  const activeId = chat.session?.id ?? '';
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <RouteHeader
        variant="bar"
        title="mesa"
        icon="layers"
        badge={<Badge tone="orange" dot>{running.size} em campo</Badge>}
        subtitle="chat, fila e o que está mudando"
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[300px_minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
        <MesaFila
          sessions={sessions}
          running={running}
          activeId={activeId}
          onOpen={onOpen}
          todos={chat.sessionTodos ?? []}
          queue={queue}
          onMove={chat.queueMove}
          onRemove={chat.queueRemove}
          onRunNow={chat.queueRunNow}
          onEdit={chat.queueEdit}
          paused={chat.queuePaused}
          onTogglePause={() => chat.queueSetPaused(!chat.queuePaused)}
        />
        <div className="order-1 min-h-[58vh] min-w-0 border-neutral-800 lg:order-2 lg:h-full lg:min-h-0 lg:overflow-hidden lg:border-r">
          <ChatPanel {...chat} hideQueue />
        </div>
        <div className="order-3 flex min-h-0 flex-col lg:h-full lg:overflow-hidden">
          <MesaMudancas messages={chat.messages} />
          <MesaPalco />
        </div>
      </div>
    </div>
  );
}
