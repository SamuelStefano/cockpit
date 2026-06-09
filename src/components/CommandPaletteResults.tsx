import { Icon } from './primitives';
import { groupByOrder } from './commandPalette.filter';
import type { Cmd } from './commandPalette.types';

interface CommandPaletteResultsProps {
  filtered: Cmd[];
  sel: number;
  setSel: (i: number) => void;
}

export function CommandPaletteResults({ filtered, sel, setSel }: CommandPaletteResultsProps) {
  if (filtered.length === 0) {
    return <div className="px-4 py-8 text-center text-[13px] text-neutral-600">Nenhum comando encontrado</div>;
  }
  const groups = groupByOrder(filtered);
  const flatIndex = (c: Cmd) => filtered.indexOf(c);
  return (
    <>
      {groups.map((g) => (
        <div key={g.name} className="mb-1">
          <div className="px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-600">{g.name}</div>
          {g.items.map((c) => {
            const active = flatIndex(c) === sel;
            return (
              <button
                key={c.id}
                onMouseEnter={() => setSel(flatIndex(c))}
                onClick={c.run}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[13.5px] transition
                  ${active ? 'bg-orange-500/15 text-orange-200' : 'text-neutral-300 hover:bg-neutral-800/60'}`}
              >
                <Icon name={c.icon} size={15} className={active ? 'text-orange-400' : 'text-neutral-500'} />
                <span className="flex-1 truncate">{c.label}</span>
                {c.hint && <span className="text-[11px] text-neutral-500">{c.hint}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}
