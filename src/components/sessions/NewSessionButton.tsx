import { useState } from 'react';
import type { BoxInfo } from '../../../shared/boxes';
import { boxLabel } from '../../cockpit/boxes-store';
import { useEscapeLayer } from '../primitives/useEscapeLayer';
import { Button } from '../primitives';
import { BoxDot } from './BoxDot';

// With more than one box, "Nova sessão" asks where; the current box comes first.
export function NewSessionButton({ choices, onPick }: { choices: BoxInfo[]; onPick: (box: string | null) => void }) {
  const [open, setOpen] = useState(false);
  useEscapeLayer(open, () => setOpen(false));
  const ask = choices.length > 1;

  return (
    <div className="relative">
      <Button variant="outline" icon="plus" className="w-full" aria-haspopup={ask ? 'menu' : undefined} aria-expanded={ask ? open : undefined}
        onClick={() => (ask ? setOpen((v) => !v) : onPick(null))}>
        Nova sessão
      </Button>
      {open && (
        <div role="menu" aria-label="Em qual máquina?" className="absolute inset-x-0 top-full z-50 mt-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-xl shadow-black/40">
          <p className="px-1.5 pb-1 pt-0.5 text-[11.5px] text-neutral-500">Em qual máquina?</p>
          {choices.map((b, i) => (
            <button key={b.id} type="button" role="menuitem" disabled={i > 0 && !b.online} autoFocus={i === 0}
              onClick={() => { setOpen(false); onPick(b.id); }}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] text-neutral-200 hover:bg-neutral-800/60 disabled:cursor-not-allowed disabled:text-neutral-600 disabled:hover:bg-transparent"
            >
              <BoxDot online={b.online} />
              <span className="min-w-0 flex-1 truncate">{boxLabel(b)}</span>
              {i === 0 && <span className="shrink-0 text-[11.5px] text-neutral-500">atual</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
