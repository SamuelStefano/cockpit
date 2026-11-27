import type { ReactNode } from 'react';
import { Icon } from '../primitives';
import { EditableTitle } from './EditableTitle';
import { prettyModel } from './toolbar-format';

interface ChatHeaderIdentityProps {
  agentName?: string;
  avatar?: ReactNode;
  sessionId?: string;
  title: string;
  editable: boolean;
  onRename?: (id: string, title: string) => void;
  renameSignal: number;
  model?: string;
}

export function ChatHeaderIdentity({ agentName, avatar, sessionId, title, editable, onRename, renameSignal, model }: ChatHeaderIdentityProps) {
  const modelLabel = model ? prettyModel(model) : '';
  const owner = agentName ? 'Agente' : 'Deck';
  return (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-400">
        {avatar ?? <Icon name="message" size={18} />}
      </span>
      <div className="flex min-w-0 flex-col">
        {agentName ? (
          <span className="truncate text-[15px] font-medium text-neutral-100">{agentName}</span>
        ) : (
          <EditableTitle id={sessionId} title={title} editable={editable} onRename={onRename} startSignal={renameSignal} />
        )}
        <span className={`truncate text-[12px] text-(--text-muted) ${agentName ? '' : 'px-2'}`}>{modelLabel ? `${owner} · ${modelLabel}` : owner}</span>
      </div>
    </>
  );
}
