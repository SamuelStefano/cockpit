import { Icon, tokens } from '../primitives';
import type { Attachment } from '../../useCockpit';

interface AttachmentChipsProps {
  attachments: Attachment[];
  onRemoveAttachment: (path: string) => void;
}

export function AttachmentChips({ attachments, onRemoveAttachment }: AttachmentChipsProps) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {attachments.map((a) => (
        <span key={a.path} className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/60 py-1 pl-2 pr-1 text-[11px] text-neutral-300">
          <Icon name="paperclip" size={11} />
          <span className="max-w-[160px] truncate">{a.name}</span>
          <button
            onClick={() => onRemoveAttachment(a.path)}
            title="Remover anexo"
            className={`flex h-6 w-6 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-700 hover:text-neutral-200 ${tokens.focusRing}`}
          >
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}
