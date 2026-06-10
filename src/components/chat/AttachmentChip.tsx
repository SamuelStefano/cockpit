import { Icon } from '../primitives';
import { attachmentIcon } from '../../lib/attachment-kind';
import { useAttachmentChip } from './useAttachmentChip';

interface AttachmentChipProps {
  path: string;
  name: string;
  thumbB64?: string;
  onThumb?: (path: string) => void;
  onOpen?: (path: string, name: string) => void;
}

export function AttachmentChip({ path, name, thumbB64, onThumb, onOpen }: AttachmentChipProps) {
  const { kind, url } = useAttachmentChip(path, name, thumbB64, onThumb);

  if (url) {
    return (
      <button
        title={`Abrir ${name}`}
        onClick={() => onOpen?.(path, name)}
        className="group/thumb relative h-20 w-20 overflow-hidden rounded-xl border border-neutral-700/60 transition hover:border-orange-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
      >
        <img src={url} alt={name} className="h-full w-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3 text-left text-[10px] text-neutral-200 opacity-0 transition group-hover/thumb:opacity-100">
          {name}
        </span>
      </button>
    );
  }

  return (
    <button
      title={`Abrir ${name}`}
      onClick={() => onOpen?.(path, name)}
      className="inline-flex items-center gap-1 rounded-lg border border-neutral-700/60 bg-neutral-800/70 px-2 py-1 text-[11px] text-neutral-300 transition hover:border-orange-500/40 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
    >
      <Icon name={attachmentIcon(kind)} size={11} className="shrink-0 text-neutral-500" />
      <span className="max-w-[160px] truncate">{name}</span>
    </button>
  );
}
