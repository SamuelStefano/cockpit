import { useEffect, type ReactNode } from 'react';
import { Icon, tokens } from '../primitives';
import { useEditableTitle } from './useEditableTitle';

interface PhoneChatChipProps {
  avatar?: ReactNode;
  label: string;
  sessionId?: string;
  renamable: boolean;
  onRename?: (id: string, title: string) => void;
  renameSignal: number;
  onOpen: () => void;
}

// Centre of the phone header: who this chat is with. Tapping it opens the agent switcher;
// renaming (from the "…" menu) swaps the label for the field in place.
export function PhoneChatChip({ avatar, label, sessionId, renamable, onRename, renameSignal, onOpen }: PhoneChatChipProps) {
  const t = useEditableTitle({ id: sessionId, title: label, onRename: renamable ? onRename : undefined });
  useEffect(() => { if (renameSignal > 0) t.start(); }, [renameSignal]);
  if (t.editing) {
    return (
      <input
        ref={t.inputRef} value={t.draft} aria-label="Nome da sessão" onChange={(e) => t.setDraft(e.target.value)} onBlur={t.commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); t.commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); t.cancel(); }
        }}
        className="min-w-0 flex-1 rounded-sm border border-orange-700/60 bg-neutral-800 px-2 py-1 text-[15px] font-medium text-neutral-100 outline-hidden"
      />
    );
  }
  return (
    <button
      type="button" onClick={onOpen} aria-haspopup="dialog" aria-label={`Trocar agente, conversa com ${label}`}
      className={`flex h-11 min-w-0 max-w-full items-center gap-2 rounded-full bg-neutral-900 px-3 ${tokens.focusRing}`}
    >
      {avatar ?? <Icon name="message" size={16} className="shrink-0 text-neutral-400" />}
      <span className="truncate text-[15px] font-medium text-neutral-100">{label}</span>
      <Icon name="chevronDown" size={14} className="shrink-0 text-neutral-500" />
    </button>
  );
}
