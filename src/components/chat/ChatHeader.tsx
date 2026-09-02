import { Button, Icon, Badge } from '../primitives';
import { ChatHeaderCompact } from './ChatHeaderCompact';
import { EditableTitle } from './EditableTitle';
import { HistoryControls } from './HistoryControls';
import { ExportMenu } from './ExportMenu';
import { TurnStat } from './TurnStat';
import { ContextMeter } from './ContextMeter';
import type { Session, Message } from '../../data/types';
import type { TurnStats } from '../../../shared/protocol';

interface ChatHeaderProps {
  session: Session | null;
  messages: Message[];
  isEmpty: boolean;
  isMobile: boolean;
  contextTokens: number;
  lastTurn?: TurnStats;
  onNew: () => void;
  fullLoaded: boolean;
  truncated?: boolean;
  onOpenFull?: (id: string) => void;
  onLoadOlder?: (id: string) => void;
  onOpenSummary?: (id: string) => void;
  setFullLoaded: (v: boolean) => void;
  beforeGrow?: () => void;
  onTerminal?: () => void;
  terminalRunning?: boolean;
  onRename?: (id: string, title: string) => void;
  keyboardOpen?: boolean;
}

export function ChatHeader({ session, messages, isEmpty, isMobile, contextTokens, lastTurn, onNew, fullLoaded, truncated, onOpenFull, onLoadOlder, onOpenSummary, setFullLoaded, beforeGrow, onTerminal, terminalRunning, onRename, keyboardOpen = false }: ChatHeaderProps) {
  if (keyboardOpen) {
    return (
      <ChatHeaderCompact
        title={session ? session.title : 'Nova sessão'}
        onTerminal={onTerminal}
        terminalRunning={terminalRunning}
      />
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
      <Icon name="message" size={14} className="text-neutral-500" />
      <EditableTitle
        id={session?.id}
        title={session ? session.title : 'Nova sessão'}
        editable={!!session && !session.id.startsWith('new-')}
        onRename={onRename}
      />
      {session?.hasTerminal && <Badge tone="green" dot className="ml-0.5">terminal</Badge>}
      {/* Cluster direito num só container: vários ml-auto irmãos se espalham
          (margens auto dividem o espaço livre); aqui só este wrapper empurra. */}
      <div className="ml-auto flex items-center gap-2">
        <TurnStat stats={lastTurn} />
        {!isMobile && <ContextMeter tokens={contextTokens} onNew={onNew} />}
        {!isEmpty && session && !session.id.startsWith('new-') && onOpenFull && (
          <HistoryControls
            sessionId={session.id} fullLoaded={fullLoaded} truncated={truncated}
            onOpenFull={onOpenFull} onLoadOlder={onLoadOlder} onOpenSummary={onOpenSummary}
            setFullLoaded={setFullLoaded} beforeGrow={beforeGrow}
          />
        )}
        {!isEmpty && !isMobile && <ExportMenu title={session?.title || 'sessao'} messages={messages} />}
        {onTerminal && (
          <Button variant="outline" size="sm" square icon="terminal" onClick={onTerminal} title="Abrir terminais" className="relative">
            {terminalRunning && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-green-500" style={{ boxShadow: '0 0 6px var(--ok)' }} />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
