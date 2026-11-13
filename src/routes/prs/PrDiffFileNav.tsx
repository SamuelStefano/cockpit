import { Icon } from '../../components/primitives/Icon';
import { tokens } from '../../components/primitives/tokens';
import { fileAnchor, splitPath } from './diff-parse';
import type { DiffFileView } from './usePrDiff';

const DOT = { added: 'bg-emerald-400', deleted: 'bg-red-400', renamed: 'bg-yellow-400', modified: 'bg-neutral-500' } as const;

interface PrDiffFileNavProps { files: DiffFileView[]; onJump: (path: string) => void }

export function PrDiffFileNav({ files, onJump }: PrDiffFileNavProps) {
  return (
    <nav aria-label="Arquivos da PR" className="scroll-thin sticky top-0 hidden max-h-[calc(100dvh-9rem)] w-60 shrink-0 self-start overflow-y-auto pr-1 2xl:block">
      <ul className="space-y-px">
        {files.map(({ file, viewed }) => {
          const { dir, name } = splitPath(file.path);
          return (
            <li key={file.path}>
              <button
                type="button" title={file.path}
                onClick={() => { onJump(file.path); document.getElementById(fileAnchor(file.path))?.scrollIntoView({ block: 'start' }); }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition hover:bg-neutral-900 ${tokens.focusRing}`}
              >
                {viewed
                  ? <Icon name="check" size={11} className="shrink-0 text-neutral-600" />
                  : <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[file.change]}`} />}
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-mono text-[12px] ${viewed ? 'text-neutral-600' : 'text-neutral-200'}`}>{name}</span>
                  {dir && <span className="block truncate font-mono text-[11px] text-neutral-600" dir="rtl"><bdi>{dir}</bdi></span>}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-600">{file.additions + file.deletions}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
