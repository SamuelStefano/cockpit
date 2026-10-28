import type { Memory, TeamBot } from '../../../../shared/protocol';
import { Icon } from '../../../components/primitives';
import { MascotStack } from '../../../components/team/MascotStack';
import { memorySubtitle } from './memory-view';

interface MemoryListProps {
  memories: Memory[];
  bots: TeamBot[];
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
}

export function MemoryList({ memories, bots, selectedId, now, onSelect }: MemoryListProps) {
  return (
    <div className="flex flex-col gap-0.5" role="list" aria-label="Memórias">
      {memories.map((m) => {
        const readers = bots.filter((b) => m.agents.includes(b.id)).map((b) => ({ id: b.id, mascot: b.mascot, name: b.name }));
        return (
          <button
            key={m.id} type="button" role="listitem" aria-current={m.id === selectedId} onClick={() => onSelect(m.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-neutral-900 ${m.id === selectedId ? 'bg-neutral-900' : ''}`}
          >
            <Icon name={m.fileName ? 'file' : 'clipboard'} size={16} className="shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-neutral-100">{m.title}</span>
              <span className="block truncate text-[12px] text-neutral-500">{memorySubtitle(m, bots, now)}</span>
            </span>
            <MascotStack mascots={readers} size={24} />
          </button>
        );
      })}
    </div>
  );
}
