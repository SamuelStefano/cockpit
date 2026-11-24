import { useState } from 'react';
import { Icon } from '../primitives';
import { SECRET_HINT, secretRows, secretCount } from '../../game/secrets';
import { EGG_IDS } from '../../game/eggs';

export function ArcadeSecrets({ found }: { found: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 text-left text-[11px] text-neutral-500 hover:text-neutral-300 focus-visible:outline-hidden focus-visible:text-neutral-200"
      >
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={11} />
        <span className="flex-1">Comandos secretos</span>
        <span className="font-mono tabular-nums">{secretCount(found)}/{EGG_IDS.length} segredos</span>
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1 pl-4">
          <ul className="flex flex-col gap-0.5">
            {secretRows(found).map((r) => (
              <li key={r.id} className={`text-[11px] leading-snug ${r.found ? 'text-neutral-300' : 'text-neutral-600'}`}>{r.how}</li>
            ))}
          </ul>
          <p className="text-[10.5px] leading-snug text-neutral-500">{SECRET_HINT}</p>
        </div>
      )}
    </div>
  );
}
