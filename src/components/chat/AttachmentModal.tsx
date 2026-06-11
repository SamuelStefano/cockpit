import { Button, Icon, tokens } from '../primitives';
import type { AttachmentPreview } from '../../useCockpit';
import { attachmentIcon } from '../../lib/attachment-kind';
import { useAttachmentModal } from './useAttachmentModal';

export function AttachmentModal({ att, onClose }: { att: AttachmentPreview; onClose: () => void }) {
  const { kind, url } = useAttachmentModal(att, onClose);

  const content = (() => {
    if (att.error) {
      return (
        <div className="flex flex-col items-center gap-2 py-10 text-neutral-400">
          <Icon name="x" size={22} className="text-red-400" />
          <p className="text-[13px]">{att.error}</p>
        </div>
      );
    }
    if (!url) {
      return (
        <div className="flex flex-col items-center gap-2 py-10 text-neutral-500">
          <Icon name="rotate" size={20} className="animate-spin" />
          <p className="text-[12px]">Carregando anexo…</p>
        </div>
      );
    }
    if (kind === 'image') return <img src={url} alt={att.name} className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain" />;
    if (kind === 'video') return <video src={url} controls className="max-h-[70vh] w-auto max-w-full rounded-lg" />;
    if (kind === 'audio') return <audio src={url} controls className="w-full min-w-[280px]" />;
    if (kind === 'pdf') return <iframe src={url} title={att.name} className="h-[70vh] w-full rounded-lg bg-white" />;
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-neutral-400">
        <Icon name="file" size={26} className="text-neutral-500" />
        <p className="max-w-full truncate px-4 text-[13px]">{att.name}</p>
        <p className="text-[11px] text-neutral-500">Sem preview pra esse tipo — baixe pra abrir.</p>
      </div>
    );
  })();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
          <Icon name={attachmentIcon(kind)} size={14} className="shrink-0 text-neutral-500" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-200" title={att.name}>{att.name}</span>
          {url && (
            <a
              href={url}
              download={att.name}
              title="Baixar"
              className={`flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 ${tokens.focusRing}`}
            >
              <Icon name="download" size={14} />
            </a>
          )}
          <Button variant="ghost" size="sm" square icon="x" onClick={onClose} title="Fechar (Esc)" />
        </div>
        <div className="flex min-h-[140px] items-center justify-center overflow-auto bg-neutral-950/60 p-4">
          {content}
        </div>
      </div>
    </div>
  );
}
