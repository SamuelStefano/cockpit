import { Fragment, memo } from 'react';
import type { ShToken } from '../../components/primitives/useShikiTokens';
import { splitAtRange, type CharRange, type DiffRow, type FileThreads } from './diff-parse';
import { PrThreadNote } from './PrThreadNote';

const ROW: Record<DiffRow['t'], string> = {
  add: 'bg-emerald-500/10',
  del: 'bg-red-500/10',
  ctx: '',
  hunk: 'bg-sky-500/8 text-sky-300/80',
};
const GUTTER: Record<DiffRow['t'], string> = {
  add: 'text-emerald-300/60',
  del: 'text-red-300/60',
  ctx: 'text-neutral-600',
  hunk: 'bg-sky-500/8 text-sky-300/50',
};
const SIGN: Record<DiffRow['t'], string> = { add: '+', del: '−', ctx: '', hunk: '' };
const PLAIN: Record<DiffRow['t'], string> = { add: 'text-emerald-200', del: 'text-red-200', ctx: 'text-neutral-400', hunk: '' };

const num = 'w-11 shrink-0 select-none px-1.5 text-right tabular-nums';

const MARK: Partial<Record<DiffRow['t'], string>> = { add: 'rounded-[3px] bg-emerald-400/30', del: 'rounded-[3px] bg-red-400/30' };

function Code({ row, tokens, range }: { row: DiffRow; tokens?: ShToken[]; range?: CharRange }) {
  const plain = !tokens?.length;
  const pieces = splitAtRange(plain ? [{ content: row.text || ' ' }] : tokens, range);
  return (
    <span className={plain ? PLAIN[row.t] : undefined}>
      {pieces.map((p, i) => (
        <span key={i} className={p.mark ? MARK[row.t] : undefined} style={p.color || p.italic ? { color: p.color, fontStyle: p.italic ? 'italic' : undefined } : undefined}>{p.content}</span>
      ))}
    </span>
  );
}

interface PrDiffRowsProps { rows: DiffRow[]; tokens: ShToken[][] | null; wrap: boolean; threads: FileThreads; marks: Map<number, CharRange> }

export const PrDiffRows = memo(function PrDiffRows({ rows, tokens, wrap, threads, marks }: PrDiffRowsProps) {
  return (
    <div className={`scroll-thin bg-[#070707] font-mono text-[12px] leading-[1.55] ${wrap ? '' : 'overflow-x-auto'}`}>
      <div className={wrap ? '' : 'w-max min-w-full'}>
        {rows.map((r, i) => {
          const notes = [...(r.t !== 'add' && r.oldLn ? threads.byOld.get(r.oldLn) ?? [] : []), ...(r.t !== 'del' && r.newLn ? threads.byNew.get(r.newLn) ?? [] : [])];
          return (
            <Fragment key={i}>
              {r.t === 'hunk' ? (
                <div className={`flex ${ROW.hunk} ${i ? 'mt-1 border-t border-neutral-800/80' : ''}`}>
                  <span className={`${num} ${GUTTER.hunk}`}>⋯</span>
                  <span className={`${num} ${GUTTER.hunk}`}>⋯</span>
                  <span className="truncate px-3 py-0.5 text-[11px]">{r.text || ' '}</span>
                </div>
              ) : (
                <div className={`flex ${ROW[r.t]}`}>
                  <span className={`${num} ${GUTTER[r.t]}`}>{r.oldLn || ''}</span>
                  <span className={`${num} ${GUTTER[r.t]}`}>{r.newLn || ''}</span>
                  <span aria-hidden className={`w-5 shrink-0 select-none text-center ${r.t === 'add' ? 'text-emerald-400' : 'text-red-400'}`}>{SIGN[r.t]}</span>
                  <span className={`min-w-0 flex-1 pr-4 ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}><Code row={r} tokens={tokens?.[i]} range={marks.get(i)} /></span>
                </div>
              )}
              {notes.map((t, n) => <PrThreadNote key={n} thread={t} inline />)}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
});
