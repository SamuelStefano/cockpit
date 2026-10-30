import { ChatPanel } from '../components/Chat';
import type { ChatPanelProps } from '../components/chat/chat-panel-props';
import type { QueueItem } from '../useCockpit';
import type { Session } from '../data/types';
import { Badge, Button, RouteHeader } from '../components/primitives';
import { usePersisted } from '../lib/persist';
import { MesaFila } from './MesaFila';
import { MesaMudancas } from './MesaMudancas';
import { MesaPalco } from './MesaPalco';
import { useTalkOnce } from './mesa/talk';

interface Props {
  chat: ChatPanelProps;
  sessions: Session[];
  running: Set<string>;
  queue: QueueItem[];
  onOpen: (id: string) => void;
  leadId: string;
  leadName: string;
  onTalk: () => void;
}

export function Mesa({ chat, sessions, running, queue, onOpen, leadId, leadName, onTalk }: Props) {
  useTalkOnce(leadId, onTalk);
  const [fila, setFila] = usePersisted('mesa.fila', false);
  const [lado, setLado] = usePersisted('mesa.lado', false);
  const activeId = chat.session?.id ?? '';
  const grid = fila && lado
    ? 'lg:grid-cols-[240px_minmax(0,1fr)_300px]'
    : fila
      ? 'lg:grid-cols-[240px_minmax(0,1fr)]'
      : lado
        ? 'lg:grid-cols-[minmax(0,1fr)_300px]'
        : 'lg:grid-cols-1';
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <RouteHeader
        variant="bar"
        title="mesa"
        icon="layers"
        badge={<Badge tone="orange" dot>{running.size} em campo</Badge>}
        subtitle={leadName ? `falando com ${leadName}` : 'falando com quem comanda'}
        actions={
          <div className="flex gap-1.5">
            <Button size="sm" variant={fila ? 'primary' : 'secondary'} aria-pressed={fila} onClick={() => setFila(!fila)}>Fila</Button>
            <Button size="sm" variant={lado ? 'primary' : 'secondary'} aria-pressed={lado} onClick={() => setLado(!lado)}>Ao vivo</Button>
          </div>
        }
      />
      <div className={`grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden ${grid}`}>
        {fila && (
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
        )}
        <div className="order-1 min-h-[58vh] min-w-0 lg:order-2 lg:h-full lg:min-h-0 lg:overflow-hidden">
          <ChatPanel {...chat} hideQueue onMesa={undefined} />
        </div>
        {lado && (
          <div className="order-3 flex min-h-0 flex-col lg:h-full lg:overflow-hidden">
            <MesaMudancas messages={chat.messages} />
            <MesaPalco />
          </div>
        )}
      </div>
    </div>
  );
}
