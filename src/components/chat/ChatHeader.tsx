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
import type { ChatAgentHeader } from './chat-panel-props';

export type ChatHeaderAgent = ChatAgentHeader & { name: string };

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
  // An agent's thread: its mascot and name stand in for the editable session title.
  agent?: ChatHeaderAgent;
  // Phone: the single top bar owns the drawer button (☰ · title · one action).
  onMenu?: () => void;
}

export function ChatHeader({ session, messages, isEmpty, contextTokens, contextModel = null, lastTurn, onNew, fullLoaded, truncated, onOpenFull, onLoadOlder, onOpenSummary, setFullLoaded, beforeGrow, onTerminal, terminalRunning, onRename, keyboardOpen = false, selectedModel, agent, onMenu }: ChatHeaderProps) {
  const menu = useHeaderMenu();
  const title = agent?.name ?? (session ? session.title : 'Nova sessão');
  if (keyboardOpen) return <ChatHeaderCompact title={title} onTerminal={onTerminal} terminalRunning={terminalRunning} />;

  const saved = !!session && !session.id.startsWith('new-');
  const ranOn = selectedModel ? ranOnOtherModel(selectedModel, messages) : null;
  const history = !isEmpty && saved && onOpenFull
    ? { sessionId: session.id, fullLoaded, truncated, onOpenFull, onLoadOlder, onOpenSummary, setFullLoaded, beforeGrow }
    : null;
  const canExport = !isEmpty;
  const profile = agent?.onProfile ? { open: !!agent.profileOpen, toggle: agent.onProfile } : null;
  const phone = !!onMenu;
  const hasMenu = !!turnStatParts(lastTurn) || !!ranOn || !!history || canExport || !!profile || (phone && !!onTerminal);
  const moreMenu = hasMenu && (
    <Popover
      open={menu.open} onClose={menu.close} side="bottom" align="end" label="Mais ações da conversa"
      content={
        <ChatHeaderMenu
          title={session?.title || 'sessao'} messages={messages} lastTurn={lastTurn} ranOn={ranOn}
          selectedModel={selectedModel} history={history} canExport={canExport} profile={profile} onDone={menu.close}
          onTerminal={phone ? onTerminal : undefined} terminalRunning={terminalRunning}
        />
      }
    >
      <IconButton icon="ellipsis" label="Mais ações da conversa" side="bottom" aria-expanded={menu.open} aria-haspopup="dialog" onClick={menu.toggle} />
    </Popover>
  );

  if (phone) {
    const fresh = !agent && isEmpty;
    return (
      <div className="flex h-[52px] shrink-0 items-center gap-1 px-2">
        <IconButton icon="menu" label="Menu" side="bottom" onClick={onMenu} className="pointer-coarse:h-11 pointer-coarse:w-11" />
        {agent ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {agent.avatar}
            <span className="truncate text-[15px] font-medium text-neutral-100">{agent.name}</span>
          </span>
        ) : fresh ? (
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-neutral-100">Deck</span>
        ) : (
          <div className="min-w-0 flex-1"><EditableTitle id={session?.id} title={title} editable={saved} onRename={onRename} /></div>
        )}
        {agent?.actions}
        {fresh ? <IconButton icon="plus" label="Nova conversa" side="bottom" onClick={onNew} className="pointer-coarse:h-11 pointer-coarse:w-11" /> : moreMenu}
      </div>
    );
  }

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-800 px-4">
      {agent ? (
        <span className="flex min-w-0 items-center gap-2">
          {agent.avatar}
          <span className="truncate text-[14px] font-medium text-neutral-100">{agent.name}</span>
        </span>
      ) : (
        <EditableTitle id={session?.id} title={title} editable={saved} onRename={onRename} />
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2 pointer-coarse:gap-3">
        {agent?.actions}
        <ContextRing tokens={contextTokens} model={contextModel} onNew={onNew} />
        {onTerminal && (
          <span className="relative inline-flex">
            <IconButton icon="terminal" label="Abrir terminais" side="bottom" onClick={onTerminal} />
            {terminalRunning && (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-green-500" style={{ boxShadow: '0 0 6px var(--ok)' }} />
            )}
          </span>
        )}
        {moreMenu}
      </div>
    </div>
  );
}
