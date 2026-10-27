import { IconButton, Popover } from '../primitives';
import { ChatHeaderCompact } from './ChatHeaderCompact';
import { ChatHeaderMenu } from './ChatHeaderMenu';
import { ContextRing } from './ContextRing';
import { EditableTitle } from './EditableTitle';
import { useHeaderMenu } from './useHeaderMenu';
import type { Session, Message } from '../../data/types';
import { ranOnOtherModel } from '../../cockpit/session-model';
import { turnStatParts } from './toolbar-format';
import type { TurnStats } from '../../../shared/protocol';

interface ChatHeaderProps {
  session: Session | null;
  messages: Message[];
  isEmpty: boolean;
  isMobile: boolean;
  contextTokens: number;
  contextModel?: string | null;
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
  selectedModel?: string;
}

export function ChatHeader({ session, messages, isEmpty, contextTokens, contextModel = null, lastTurn, onNew, fullLoaded, truncated, onOpenFull, onLoadOlder, onOpenSummary, setFullLoaded, beforeGrow, onTerminal, terminalRunning, onRename, keyboardOpen = false, selectedModel }: ChatHeaderProps) {
  const menu = useHeaderMenu();
  const title = session ? session.title : 'Nova sessão';
  if (keyboardOpen) return <ChatHeaderCompact title={title} onTerminal={onTerminal} terminalRunning={terminalRunning} />;

  const saved = !!session && !session.id.startsWith('new-');
  const ranOn = selectedModel ? ranOnOtherModel(selectedModel, messages) : null;
  const history = !isEmpty && saved && onOpenFull
    ? { sessionId: session.id, fullLoaded, truncated, onOpenFull, onLoadOlder, onOpenSummary, setFullLoaded, beforeGrow }
    : null;
  const canExport = !isEmpty;
  const hasMenu = !!turnStatParts(lastTurn) || !!ranOn || !!history || canExport;

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-800 px-4">
      <EditableTitle id={session?.id} title={title} editable={saved} onRename={onRename} />
      <div className="ml-auto flex shrink-0 items-center gap-2 pointer-coarse:gap-3">
        <ContextRing tokens={contextTokens} model={contextModel} onNew={onNew} />
        {onTerminal && (
          <span className="relative inline-flex">
            <IconButton icon="terminal" label="Abrir terminais" side="bottom" onClick={onTerminal} />
            {terminalRunning && (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-green-500" style={{ boxShadow: '0 0 6px var(--ok)' }} />
            )}
          </span>
        )}
        {hasMenu && (
          <Popover
            open={menu.open} onClose={menu.close} side="bottom" align="end" label="Mais ações da conversa"
            content={
              <ChatHeaderMenu
                title={session?.title || 'sessao'} messages={messages} lastTurn={lastTurn} ranOn={ranOn}
                selectedModel={selectedModel} history={history} canExport={canExport} onDone={menu.close}
              />
            }
          >
            <IconButton icon="ellipsis" label="Mais ações da conversa" side="bottom" aria-expanded={menu.open} aria-haspopup="dialog" onClick={menu.toggle} />
          </Popover>
        )}
      </div>
    </div>
  );
}
