import { useEffect, useRef, useState } from 'react';
import { Button, Icon, tokens } from '../primitives';
import { UserAvatar } from '../UserAvatar';
import { usePersisted } from '../../lib/persist';
import type { UserMessage } from '../../data/mock';
import { CopyTextButton, QuoteButton } from './MessageActions';
import { TriageBadge } from './TriageBadge';
import { fmtClock } from './message-format';
import { parseAttachments } from '../../lib/parse-attachments';
import { AttachmentChip } from './AttachmentChip';

interface UserMessageRowProps {
  msg: UserMessage;
  onEditUser?: (id: string, text: string) => void;
  onQuote?: (text: string) => void;
  onOpenAttachment?: (path: string, name: string) => void;
  attThumbs?: Record<string, string>;
  onAttThumb?: (path: string) => void;
}

// Bolha do usuário. A edição é inline (substitui no lugar) e o reenvio é tratado
// pelo onEditUser do cockpit — não enfileira nova bolha no fim do thread.
export function UserMessageRow({ msg, onEditUser, onQuote, onOpenAttachment, attThumbs, onAttThumb }: UserMessageRowProps) {
  const [userName] = usePersisted<string>('user.name', '');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(msg.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing) {
      wasEditing.current = true;
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      return;
    }
    if (!wasEditing.current) return;
    wasEditing.current = false;
    // Esc/salvar desmontam o textarea e o foco cai pro body; devolve pro lápis.
    // Só quando caiu pro body — clique em outro lugar não deve ter o foco roubado.
    if (document.activeElement === document.body) editBtnRef.current?.focus();
  }, [editing]);

  const start = () => { setValue(msg.text); setEditing(true); };
  const cancel = () => { setEditing(false); setValue(msg.text); };
  const save = () => {
    const next = value.trim();
    setEditing(false);
    if (next && next !== msg.text.trim()) onEditUser?.(msg.id, next);
  };

  if (editing) {
    return (
      <div data-mid={msg.id} className="fade-up flex items-start justify-end gap-2.5">
        <div className="flex w-full max-w-[82%] flex-col items-end gap-2">
          <textarea
            ref={ref}
            aria-label="Editar mensagem"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
              else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
            }}
            rows={Math.min(10, value.split('\n').length)}
            className="w-full resize-none rounded-2xl rounded-br-md border border-orange-500/40 bg-neutral-800 px-3.5 py-2.5 text-[14px] leading-relaxed text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={cancel}>Cancelar</Button>
            <Button size="sm" onClick={save}>Salvar e reenviar</Button>
          </div>
        </div>
      </div>
    );
  }

  const { attachments, body } = parseAttachments(msg.text);

  return (
    <div data-mid={msg.id} className="fade-up group/u flex items-start justify-end gap-2.5">
      <div className="mt-1 flex shrink-0 items-center gap-0.5 opacity-100 transition group-hover/u:opacity-100 sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover/u:opacity-100">
        {msg.ts && <time className="mr-1 text-[10px] tabular-nums text-neutral-600">{fmtClock(msg.ts)}</time>}
        <CopyTextButton text={msg.text} />
        {onQuote && <QuoteButton onClick={() => onQuote(msg.text)} />}
        {onEditUser && (
          <button
            ref={editBtnRef}
            onClick={start}
            title="Editar e reenviar"
            className={`flex h-6 w-6 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-300 ${tokens.focusRing}`}
          >
            <Icon name="pencil" size={12} />
          </button>
        )}
      </div>
      <div className="flex max-w-[82%] flex-col items-end gap-1">
        <span className="max-w-[200px] truncate px-1 text-[11px] font-medium text-neutral-500" title={userName || 'Você'}>{userName || 'Você'}</span>
        {attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {attachments.map((a) => (
              <AttachmentChip key={a.path} path={a.path} name={a.name} thumbB64={attThumbs?.[a.path]} onThumb={onAttThumb} onOpen={onOpenAttachment} />
            ))}
          </div>
        )}
        {body && (
          <div className="w-full whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-neutral-700/60 bg-neutral-800 px-3.5 py-2.5 text-[14px] leading-relaxed text-neutral-100 shadow-sm shadow-black/20">
            {body}
          </div>
        )}
        {msg.triage && <TriageBadge action={msg.triage.action} reason={msg.triage.reason} />}
      </div>
      <div className="mt-0.5">
        <UserAvatar size={28} />
      </div>
    </div>
  );
}
