import { Icon } from '../primitives';
import type { SessionsGroupMode } from '../../lib/prefs';

interface GroupModeToggleProps {
  mode: SessionsGroupMode;
  onChange: (mode: SessionsGroupMode) => void;
}

const OPTS: { value: SessionsGroupMode; label: string; icon: 'clock' | 'tag' }[] = [
  { value: 'recency', label: 'Recentes', icon: 'clock' },
  { value: 'topic', label: 'Tópicos', icon: 'tag' },
];

export function GroupModeToggle({ mode, onChange }: GroupModeToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5" role="tablist" aria-label="Agrupar sessões por">
      {OPTS.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 font-mono text-[10.5px] lowercase tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40
              ${active ? 'bg-orange-500/15 text-orange-300' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <Icon name={o.icon} size={12} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
