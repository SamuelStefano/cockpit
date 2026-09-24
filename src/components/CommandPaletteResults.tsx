import { useEffect, useRef } from 'react';
import { Icon } from './primitives';
import { groupByOrder } from './command-palette-filter';
import type { Cmd } from './command-palette-types';

// The input keeps focus and moves a virtual cursor: a combobox pointing at this
// listbox, so a screen reader hears the highlighted command as the arrows move.
export const PALETTE_LIST_ID = 'cmdk-list';
export const paletteOptionId = (i: number) => `cmdk-opt-${i}`;

interface CommandPaletteResultsProps {
  filtered: Cmd[];
  sel: number;
  setSel: (i: number) => void;
}

export function CommandPaletteResults({ filtered, sel, setSel }: CommandPaletteResultsProps) {
  // Seta pra baixo movia só o índice: a seleção saía da janela rolável e o usuário
  // navegava às cegas a partir do ~8º item.
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { activeRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [sel]);

  if (filtered.length === 0) {
    return <div className="px-4 py-8 text-center text-[13px] text-neutral-600">Nenhum comando encontrado</div>;
  }
  const groups = groupByOrder(filtered);
  const flatIndex = (c: Cmd) => filtered.indexOf(c);
  return (
    <div role="listbox" id={PALETTE_LIST_ID} aria-label="Comandos">
      {groups.map((g) => (
        <div key={g.name} role="group" aria-label={g.name} className="mb-1">
          <div aria-hidden className="px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-600">{g.name}</div>
          {g.items.map((c) => {
            const active = flatIndex(c) === sel;
            return (
              <button
                key={c.id}
                id={paletteOptionId(flatIndex(c))}
                role="option"
                aria-selected={active}
                tabIndex={-1}
                ref={active ? activeRef : undefined}
                onMouseEnter={() => setSel(flatIndex(c))}
                onClick={c.run}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[13.5px] transition
                  ${active ? 'bg-orange-500/15 text-orange-200' : 'text-neutral-300 hover:bg-neutral-800/60'}`}
              >
                <Icon name={c.icon} size={15} className={active ? 'text-orange-400' : 'text-neutral-500'} />
                <span className="flex-1 truncate" title={c.label}>{c.label}</span>
                {c.hint && <span className="text-[11px] text-neutral-500">{c.hint}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
