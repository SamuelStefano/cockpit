import { Icon, type IconName } from '../components/primitives';

export interface AdminTab {
  id: string;
  label: string;
  icon: IconName;
}

export function AdminTabs({ tabs, active, onSelect }: { tabs: AdminTab[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div className="mb-5 flex gap-1 rounded-lg border border-neutral-800 bg-neutral-900/40 p-1 hairline">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40
            ${active === t.id ? 'border-orange-500/40 bg-orange-500/15 text-orange-300 glow-active' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
        >
          <Icon name={t.icon} size={13} /> {t.label}
        </button>
      ))}
    </div>
  );
}
