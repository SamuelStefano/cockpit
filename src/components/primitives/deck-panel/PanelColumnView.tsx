import type { PanelColumn, PanelItem, PanelTone } from './parse-panel';

const BAR: Record<PanelTone, string> = {
  green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500',
  orange: 'bg-orange-500', neutral: 'bg-neutral-500', purple: 'bg-fuchsia-500',
};

export function PanelColumnView({ column, onOpen }: { column: PanelColumn; onOpen: (i: PanelItem) => void }) {
  return (
    <div className="min-w-0 rounded-lg bg-neutral-950/60 p-2">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-neutral-400">
        <span className={`h-2 w-2 rounded-full ${BAR[column.tone]}`} />
        {column.label}
      </div>
      <ul className="space-y-1.5">
        {column.items.map((item, i) => {
          const clickable = Boolean(item.detail || item.link);
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onOpen(item)}
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-left text-neutral-200 enabled:hover:border-orange-500/50 enabled:cursor-pointer disabled:cursor-default"
              >
                <span className="block truncate">{item.title}</span>
                {item.tag && <span className="mt-0.5 block truncate text-[12px] text-neutral-500">{item.tag}</span>}
              </button>
            </li>
          );
        })}
        {!column.items.length && <li className="px-2 text-[12px] text-neutral-600">—</li>}
      </ul>
    </div>
  );
}
