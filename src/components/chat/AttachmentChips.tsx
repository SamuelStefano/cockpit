import { Badge, Icon, tokens } from '../primitives';
import type { Attachment } from '../../useCockpit';

interface AttachmentChipsProps {
  attachments: Attachment[];
  onRemoveAttachment: (path: string) => void;
  onOpen?: (path: string, name: string) => void;
}

// Clicar abre o anexo no modal antes de mandar: sem ver o que está anexado, print
// repetido ia junto e o agente gastava o turno só pra dizer que era igual.
export function AttachmentChips({ attachments, onRemoveAttachment, onOpen }: AttachmentChipsProps) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {attachments.map((a) => (
        <span key={a.path} className={`flex items-center gap-1.5 rounded-lg border ${a.dup ? 'border-yellow-500/40' : 'border-neutral-700'} bg-neutral-800/60 py-1 pl-1 pr-1 text-[11px] text-neutral-300 ${a.uploading ? 'opacity-60' : ''}`}>
          <button
            type="button"
            disabled={a.uploading || !onOpen}
            onClick={() => onOpen?.(a.path, a.name)}
            title={a.uploading ? 'Enviando…' : `Ver ${a.name}`}
            className={`flex min-w-0 items-center gap-1.5 rounded-md pr-0.5 transition enabled:hover:text-orange-200 ${tokens.focusRing}`}
          >
            {a.uploading
              ? <Icon name="rotate" size={11} className="spin shrink-0 text-orange-400" />
              : a.s3url && /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(a.name)
                ? <img src={a.s3url} alt={a.name} className="h-8 w-8 shrink-0 rounded-sm object-cover" />
                : <Icon name="paperclip" size={11} />}
            <span className="max-w-[160px] truncate">{a.name}</span>
          </button>
          {a.dup && <Badge tone="yellow">{a.dup === 'sent' ? 'já enviado' : 'repetido'}</Badge>}
          <button
            onClick={() => onRemoveAttachment(a.path)}
            title="Remover anexo"
            className={`flex h-6 w-6 items-center justify-center rounded-sm text-neutral-500 transition hover:bg-neutral-700 hover:text-neutral-200 ${tokens.focusRing}`}
          >
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}
