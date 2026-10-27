import { Icon, tokens } from '../../components/primitives';
import type { BotFile } from '../../../shared/protocol';
import { fileKind, formatSize } from './file-groups';

const ICON = { image: 'image', markdown: 'file', text: 'file', other: 'file' } as const;

export function BotFileRow({ file, onOpen }: { file: BotFile; onOpen: (path: string) => void }) {
  const slash = file.path.lastIndexOf('/');
  return (
    <button type="button" onClick={() => onOpen(file.path)}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-neutral-900 ${tokens.focusRing}`}>
      <Icon name={ICON[fileKind(file.path)]} size={15} className="shrink-0 text-neutral-500" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-neutral-200">{file.path.slice(slash + 1)}</span>
        {slash > 0 && <span className="block truncate text-[12px] text-neutral-600">{file.path.slice(0, slash)}</span>}
      </span>
      <span className="shrink-0 text-[12px] text-neutral-600">{formatSize(file.size)}</span>
    </button>
  );
}
