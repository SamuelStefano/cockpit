import { useState } from 'react';
import { IconButton, Popover } from '../primitives';
import { ConfirmArchive } from '../sessions/ConfirmArchive';
import { ChatHeaderCompact } from './ChatHeaderCompact';
import { ChatHeaderMenu } from './ChatHeaderMenu';
import { ContextRing } from './ContextRing';
import { EditableTitle } from './EditableTitle';
import { useHeaderMenu } from './useHeaderMenu';
import type { Session, Message } from '../../data/types';
import { ranOnOtherModel } from '../../cockpit/session-model';
import { contextMeter, turnStatParts } from './toolbar-format';
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
  onDelete?: (id: string) => void;
  keyboardOpen?: boolean;
  selectedModel?: string;
  // An agent's thread: its mascot and name stand in for the editable session title.
  agent?: ChatHeaderAgent;
}

export function ChatHeader({ session, messages, isEmpty, contextTokens, contextModel = null, lastTurn, onNew, fullLoaded, truncated, onOpenFull, onLoadOlder, onOpenSummary, setFullLoaded, beforeGrow, onTerminal, terminalRunning, onRename, onDelete, keyboardOpen = false, selectedModel, agent }: ChatHeaderProps) {
  const menu = useHeaderMenu();
  const [renameSignal, setRenameSignal] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const title = agent?.name ?? (session ? session.title : 'Nova sessão');
  if (keyboardOpen) return <ChatHeaderCompact title={title} onTerminal={onTerminal} terminalRunning={terminalRunning} />;

  const saved = !!session && !session.id.startsWith('new-');
  const ranOn = selectedModel ? ranOnOtherModel(selectedModel, messages) : null;
  const history = !isEmpty && saved && onOpenFull
    ? { sessionId: session.id, fullLoaded, truncated, onOpenFull, onLoadOlder, onOpenSummary, setFullLoaded, beforeGrow }
    : null;
  const canExport = !isEmpty;
  const profile = agent?.onProfile ? { open: !!agent.profileOpen, toggle: agent.onProfile } : null;
  const canRename = saved && !agent && !!onRename;
  const canDelete = saved && !agent && !!onDelete;
  const ctx = contextMeter(contextTokens, contextModel);
  const hasMenu = !!ctx || !!turnStatParts(lastTurn) || !!ranOn || !!history || canExport || !!profile || !!onTerminal || canRename || canDelete;

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 px-4">
      {agent ? (
        <span className="flex min-w-0 items-center gap-2">
          {agent.avatar}
          <span className="truncate text-[14px] font-medium text-neutral-100">{agent.name}</span>
        </span>
      ) : (
        <EditableTitle id={session?.id} title={title} editable={saved} onRename={onRename} startSignal={renameSignal} />
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2 pointer-coarse:gap-3">
        {agent?.actions}
        <ContextRing tokens={contextTokens} model={contextModel} onNew={onNew} />
        {hasMenu && (
          <Popover
            open={menu.open} onClose={menu.close} side="bottom" align="end" label="Mais ações da conversa"
            content={
              <ChatHeaderMenu
                title={session?.title || 'sessao'} messages={messages} lastTurn={lastTurn} ranOn={ranOn}
                selectedModel={selectedModel} history={history} canExport={canExport} profile={profile} onDone={menu.close}
                contextPct={ctx?.pct ?? null} onRename={canRename ? () => setRenameSignal((n) => n + 1) : undefined}
                onTerminal={onTerminal} terminalRunning={terminalRunning} onDelete={canDelete ? () => setConfirmDelete(true) : undefined}
              />
            }
          >
            <span className="relative inline-flex">
              <IconButton icon="ellipsis" label="Mais ações da conversa" side="bottom" aria-expanded={menu.open} aria-haspopup="dialog" onClick={menu.toggle} />
              {terminalRunning && (
                <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-green-500" />
              )}
            </span>
          </Popover>
        )}
      </div>
      {confirmDelete && session && onDelete && (
        <ConfirmArchive
          mode="delete" title={session.title || 'esta sessão'}
          onConfirm={() => { onDelete(session.id); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
