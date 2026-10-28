import { useState, type ReactNode } from 'react';
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
import { UsageDock, readUsage, type UsageDockProps } from '../chrome/sidebar/UsageDock';

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
  terminalOpen?: boolean;
  usage?: UsageDockProps;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
  keyboardOpen?: boolean;
  selectedModel?: string;
  // An agent's thread: its mascot and name stand in for the editable session title.
  agent?: ChatHeaderAgent;
  // Phone: the single top bar owns the drawer button (☰ · title · one action).
  onMenu?: () => void;
  teamSlot?: ReactNode;
}

export function ChatHeader({ session, messages, isEmpty, contextTokens, contextModel = null, lastTurn, onNew, fullLoaded, truncated, onOpenFull, onLoadOlder, onOpenSummary, setFullLoaded, beforeGrow, onTerminal, terminalRunning, terminalOpen = false, usage, onRename, onDelete, keyboardOpen = false, selectedModel, agent, onMenu, teamSlot }: ChatHeaderProps) {
  const menu = useHeaderMenu();
  const [renameSignal, setRenameSignal] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const title = agent?.name ?? (session ? session.title : 'Nova conversa');
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
  const phoneMenu = !!onMenu;
  const reading = phoneMenu && usage ? readUsage(usage) : null;
  const usageHot = !!reading && (reading.paused || reading.warn || (reading.s.pct ?? 0) >= 85);
  const ctxHot = (ctx?.pct ?? 0) >= 85;
  const phone = phoneMenu
    ? {
        usage: reading ? { text: reading.s.pct === null ? 'Uso do plano: lendo' : `Uso do plano ${reading.s.pct}%`, hot: usageHot } : undefined,
        onTerminal, terminalOpen,
        onRestart: ctx && ctx.pct >= 70 ? onNew : undefined,
      }
    : undefined;
  const hasMenu = phoneMenu || !!ctx || !!turnStatParts(lastTurn) || !!ranOn || !!history || canExport || !!profile || !!agent?.pause || canRename || canDelete;

  const moreMenu = hasMenu && (
    <Popover
      open={menu.open} onClose={menu.close} side="bottom" align="end" label="Mais ações da conversa"
      content={
        <ChatHeaderMenu
          title={session?.title || 'sessao'} messages={messages} lastTurn={lastTurn} ranOn={ranOn}
          selectedModel={selectedModel} history={history} canExport={canExport} profile={profile} pause={agent?.pause} onDone={menu.close} phone={phone}
          contextPct={ctx?.pct ?? null} onRename={canRename ? () => setRenameSignal((n) => n + 1) : undefined}
          onDelete={canDelete ? () => setConfirmDelete(true) : undefined}
        />
      }
    >
      <span className="relative inline-flex">
        <IconButton icon="ellipsis" label="Mais ações da conversa" side="bottom" aria-expanded={menu.open} aria-haspopup="dialog" onClick={menu.toggle} />
        {(ctxHot || usageHot) && phoneMenu && <span aria-hidden className="pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full bg-red-400 ring-2 ring-neutral-950" />}
      </span>
    </Popover>
  );
  const terminalButton = onTerminal && (
    <span className="relative inline-flex">
      <IconButton icon="terminal" label="Abrir terminais" side="bottom" aria-pressed={terminalOpen} onClick={onTerminal} className={terminalOpen ? 'bg-neutral-800 text-neutral-100' : ''} />
      {terminalRunning && (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-green-500" />
      )}
    </span>
  );
  const confirm = confirmDelete && session && onDelete && (
    <ConfirmArchive
      mode="delete" title={session.title || 'esta sessão'}
      onConfirm={() => { onDelete(session.id); setConfirmDelete(false); }}
      onCancel={() => setConfirmDelete(false)}
    />
  );

  if (onMenu) {
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
          <div className="min-w-0 flex-1 overflow-hidden"><EditableTitle id={session?.id} title={title} editable={saved} onRename={onRename} startSignal={renameSignal} /></div>
        )}
        {agent?.actions}
        {teamSlot}
        <IconButton icon="plus" label="Nova conversa" side="bottom" onClick={onNew} className="pointer-coarse:h-11 pointer-coarse:w-11" />
        {!fresh && moreMenu}
        {confirm}
      </div>
    );
  }

  // Three columns, the outer two equal: the title sits on the body's center line, not after the actions.
  return (
    <div className="grid h-12 shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 px-4">
      <span />
      <div className="flex min-w-0 max-w-[min(560px,50vw)] justify-center">
        {agent ? (
          <span className="flex min-w-0 items-center gap-2">
            {agent.avatar}
            <span className="truncate text-[14px] font-medium text-neutral-100">{agent.name}</span>
          </span>
        ) : (
          <EditableTitle id={session?.id} title={title} editable={saved} onRename={onRename} startSignal={renameSignal} />
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 pointer-coarse:gap-3">
        {agent?.actions}
        {teamSlot}
        <ContextRing tokens={contextTokens} model={contextModel} onNew={onNew} />
        {usage && <UsageDock {...usage} />}
        {terminalButton}
        {moreMenu}
      </div>
      {confirm}
    </div>
  );
}
