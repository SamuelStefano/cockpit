import { useState, useEffect, useMemo } from 'react';
import { Icon } from '../primitives';
import type { ToolDiff } from '../../../shared/protocol';
import { lineDiff } from './diff';
import type { ToolSignal } from './ToolCallCard';

export function DiffView({ diff, signal }: { diff: ToolDiff; signal?: ToolSignal }) {
  const rows = useMemo(() => lineDiff(diff.old, diff.new), [diff.old, diff.new]);
  const adds = rows.filter((r) => r.t === 'add').length;
  const dels = rows.filter((r) => r.t === 'del').length;
  const [open, setOpen] = useState(true);
  useEffect(() => { if (signal && signal.n > 0) setOpen(signal.open); }, [signal]);
  return (
    <div className="px-3 pb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-1 flex w-full items-center gap-1.5 text-[11px] text-neutral-500 transition hover:text-neutral-300"
      >
        <Icon name="chevronDown" size={13} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
        diff
        <span className="text-emerald-400/80">+{adds}</span>
        <span className="text-red-400/80">-{dels}</span>
      </button>
      {open && (
        <pre className="scroll-thin max-h-72 overflow-auto rounded-md border border-neutral-800 bg-[#070707] py-1.5 font-mono text-[11.5px] leading-relaxed">
          {(() => {
            let oldLn = 0, newLn = 0;
            return rows.map((r, i) => {
              const o = r.t !== 'add' ? ++oldLn : 0;
              const n = r.t !== 'del' ? ++newLn : 0;
              return (
                <div
                  key={i}
                  className={
                    r.t === 'add' ? 'bg-emerald-500/10 text-emerald-300'
                      : r.t === 'del' ? 'bg-red-500/10 text-red-300'
                        : 'text-neutral-500'
                  }
                >
                  <span className="select-none pl-2 pr-1 text-right text-neutral-700" style={{ display: 'inline-block', width: '2.4em' }}>{o || ''}</span>
                  <span className="select-none pr-1 text-right text-neutral-700" style={{ display: 'inline-block', width: '2.4em' }}>{n || ''}</span>
                  <span className="select-none px-1.5 text-neutral-600">{r.t === 'add' ? '+' : r.t === 'del' ? '-' : ' '}</span>
                  {r.s || ' '}
                </div>
              );
            });
          })()}
        </pre>
      )}
    </div>
  );
}
