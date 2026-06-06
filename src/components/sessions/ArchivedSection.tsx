import { useState } from 'react';
import { Icon } from '../primitives';
import type { Session } from '../../data/mock';

export function ArchivedSection({ archived, onUnhide }: { archived: Session[]; onUnhide: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  if (archived.length === 0) return null;
  return (
    <div className="mt-2 border-t border-neutral-800/70 pt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
      >
        <Icon name="chevronRight" size={13} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Arquivadas <span className="tabular-nums text-neutral-600">({archived.length})</span>
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {archived.map((s) => (
            <div key={s.id} className="group rounded-md px-1.5 py-1.5 hover:bg-neutral-900">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11.5px] font-medium text-neutral-400">{s.title}</span>
                <button
                  onClick={() => onUnhide(s.id)}
                  title="Restaurar sessão"
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-medium text-neutral-500 opacity-100 transition hover:bg-neutral-800 hover:text-orange-300 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  restaurar
                </button>
              </div>
              {s.snippet && <p className="mt-0.5 truncate text-[10.5px] text-neutral-600">{s.snippet}</p>}
              {s.relative && <p className="mt-0.5 text-[10px] tabular-nums text-neutral-700">{s.relative}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
