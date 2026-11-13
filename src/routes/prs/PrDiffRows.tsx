import { Fragment } from 'react';
import type { ShToken } from '../../components/primitives/useShikiTokens';
import type { DiffRow, FileThreads } from './diff-parse';
import { PrThreadNote } from './PrThreadNote';

const ROW: Record<DiffRow['t'], string> = {
  add: 'bg-emerald-500/10',
  del: 'bg-red-500/10',
  ctx: '',
  hunk: 'bg-sky-500/8 text-sky-300/80',
};
const GUTTER: Record<DiffRow['t'], string> = {
  add: 'bg-emerald-500/15 text-emerald-300/70',
  del: 'bg-red-500/15 text-red-300/70',
  ctx: 'text-neutral-600',
  hunk: 'bg-sky-500/8 text-sky-300/50',
};
const SIGN: Record<DiffRow['t'], string> = { add: '+', del: '−', ctx: '', hunk: '' };
const PLAIN: Record<DiffRow['t'], string> = { add: 'text-emerald-200', del: 'text-red-200', ctx: 'text-neutral-400', hunk: '' };

const num = 'w-11 shrink-0 select-none px-1.5 text-right tabular-nums';

function Code({ row, tokens }: { row: DiffRow; tokens?: ShToken[] }) {
  if (!tokens?.length) return <span className={PLAIN[row.t]}>{row.text || ' '}</span>;
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} style={{ color: t.color, fontStyle: t.fontStyle && t.fontStyle & 1 ? 'italic' : undefined }}>{t.content}</span>
      ))}
    </>
  );
}

interface PrDiffRowsProps { rows: DiffRow[]; tokens: ShToken[][] | null; wrap: boolean; threads: FileThreads }

export function PrDiffRows({ rows, tokens, wrap, threads }: PrDiffRowsProps) {
  return (
    <div className={`scroll-thin bg-[#070707] font-mono text-[12px] leading-[1.55] ${wrap ? '' : 'overflow-x-auto'}`}>
      <div className={wrap ? '' : 'w-max min-w-full'}>
        {rows.map((r, i) => {
          const notes = r.newLn ? threads.byLine.get(r.newLn) : undefined;
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
                  <span className={`min-w-0 flex-1 pr-4 ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}><Code row={r} tokens={tokens?.[i]} /></span>
                </div>
              )}
              {notes?.map((t, n) => <PrThreadNote key={n} thread={t} inline />)}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
