import { memo, useMemo } from 'react';
import type { PrReviewThread } from '../../../shared/prs';
import { Badge } from '../../components/primitives/Badge';
import { Checkbox } from '../../components/primitives/Checkbox';
import { Icon } from '../../components/primitives/Icon';
import { IconButton } from '../../components/primitives/IconButton';
import { tokens } from '../../components/primitives/tokens';
import { useShikiTokens } from '../../components/primitives/useShikiTokens';
import { fileAnchor, githubFileUrl, isGenerated, langOf, markChanges, splitPath, threadsForFile } from './diff-parse';
import { toast } from '../../components/primitives/toast-bus';
import { PrDiffRows } from './PrDiffRows';
import { PrThreadNote } from './PrThreadNote';
import type { DiffFileView } from './usePrDiff';

const CHANGE = {
  added: { label: 'Novo', tone: 'green' },
  deleted: { label: 'Removido', tone: 'red' },
  renamed: { label: 'Renomeado', tone: 'yellow' },
  modified: null,
} as const;

// Past this the highlighter costs more than the colour is worth on a phone.
const HIGHLIGHT_MAX_ROWS = 1500;

interface PrDiffFileCardProps {
  file: DiffFileView['file'];
  rows: DiffFileView['rows'];
  open: boolean;
  viewed: boolean;
  prUrl: string;
  threads: PrReviewThread[];
  wrap: boolean;
  onToggle: (path: string, open: boolean) => void;
  onViewed: (file: DiffFileView['file']) => void;
}

export const PrDiffFileCard = memo(function PrDiffFileCard({ file, rows, open, viewed, prUrl, threads, wrap, onToggle, onViewed }: PrDiffFileCardProps) {
  const { dir, name } = splitPath(file.path);
  const code = useMemo(() => (open && rows.length <= HIGHLIGHT_MAX_ROWS ? rows.map((r) => (r.t === 'hunk' ? '' : r.text)).join('\n') : ''), [open, rows]);
  const shiki = useShikiTokens(code, langOf(file.path));
  const fileThreads = useMemo(() => threadsForFile(threads, file.path, rows), [threads, file.path, rows]);
  const marks = useMemo(() => (open ? markChanges(rows) : new Map()), [open, rows]);
  const change = CHANGE[file.change];
  const noteCount = fileThreads.count;

  return (
    <section id={fileAnchor(file.path)} className="scroll-mt-14 overflow-clip rounded-xl border border-neutral-800 bg-neutral-950 [content-visibility:auto] [contain-intrinsic-size:auto_3rem]">
      <header className={`sticky top-0 z-10 flex items-center gap-2 bg-neutral-900/95 px-2 py-1.5 backdrop-blur-sm ${open ? 'border-b border-neutral-800' : ''}`}>
        <button
          type="button" onClick={() => onToggle(file.path, !open)} aria-expanded={open}
          className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 text-left ${tokens.focusRing}`}
        >
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} className="shrink-0 text-neutral-500" />
          <span className={`min-w-0 truncate font-mono text-[12px] ${viewed ? 'text-neutral-500' : 'text-neutral-200'}`} title={file.path} dir="rtl">
            <bdi><span className="text-neutral-500">{dir}</span>{name}</bdi>
          </span>
          {change && <Badge tone={change.tone}>{change.label}</Badge>}
          {isGenerated(file.path) && <Badge>Gerado</Badge>}
          {noteCount > 0 && <Badge tone="orange">{noteCount} {noteCount === 1 ? 'comentário' : 'comentários'}</Badge>}
        </button>
        <span className="shrink-0 font-mono text-[12px] tabular-nums">
          <span className="text-emerald-400">+{file.additions}</span> <span className="text-red-400">−{file.deletions}</span>
        </span>
        <IconButton icon="copy" size="xs" label="Copiar caminho" className="hidden sm:inline-flex" onClick={() => { void navigator.clipboard?.writeText(file.path).then(() => toast('Caminho copiado')); }} />
        <IconButton icon="external" size="xs" label="Abrir arquivo no GitHub" onClick={() => { const tab = window.open('about:blank', '_blank'); void githubFileUrl(prUrl, file.path).then((u) => { if (tab) { tab.opener = null; tab.location.href = u; } }); }} />
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 pr-1 text-[12px] text-neutral-500">
          <Checkbox checked={viewed} onChange={() => onViewed(file)} label={viewed ? 'Desmarcar como visto' : 'Marcar como visto'} />
          <span className="hidden sm:inline">Visto</span>
        </label>
      </header>
      {open && (
        <>
          {file.previousPath && <p className="border-b border-neutral-800/80 px-3 py-1.5 font-mono text-[12px] text-neutral-500">antes: {file.previousPath}</p>}
          {fileThreads.loose.length > 0 && (
            <div className="space-y-2 border-b border-neutral-800/80 p-3">
              {fileThreads.loose.map((t, i) => <PrThreadNote key={i} thread={t} />)}
            </div>
          )}
          {rows.length > 0
            ? <PrDiffRows rows={rows} tokens={code ? shiki : null} wrap={wrap} threads={fileThreads} marks={marks} />
            : <p className="px-3 py-3 text-[13px] text-neutral-500">{file.patch === undefined ? 'Sem diff de texto: arquivo binário, grande demais ou só renomeado.' : 'Nada mudou no conteúdo.'}</p>}
          {file.patchTruncated && <p className="border-t border-neutral-800/80 px-3 py-2 text-[12px] text-yellow-400">Diff cortado: arquivo grande demais. O resto está no GitHub.</p>}
        </>
      )}
    </section>
  );
});
