import type { Memory, TeamBot } from '../../../../shared/protocol';
import { MAX_PROMPT_MEMORY_BYTES, memoryBytesFor } from '../../../../shared/memory';
import { Mascot } from '../../../components/team/Mascot';

interface ReadersProps {
  bots: TeamBot[];
  agents: string[];
  memories: Memory[];
  onToggle: (botId: string) => void;
}

export function Readers({ bots, agents, memories, onToggle }: ReadersProps) {
  const over = bots.filter((b) => agents.includes(b.id) && memoryBytesFor(memories, b.id) > MAX_PROMPT_MEMORY_BYTES);
  return (
    <div className="flex flex-col gap-2 border-t border-neutral-800 px-3.5 py-2.5 text-[12px] text-neutral-500">
      <div className="flex flex-wrap items-center gap-2">
        <span>Quem lê esta memória:</span>
        {bots.length === 0 && <span className="text-neutral-600">Nenhum agente na equipe ainda.</span>}
        {bots.map((b) => {
          const on = agents.includes(b.id);
          return (
            <button
              key={b.id} type="button" aria-label={b.name} aria-pressed={on} onClick={() => onToggle(b.id)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border pl-1 pr-2.5 text-[12px] transition ${on ? 'border-neutral-500 bg-neutral-800 text-neutral-100' : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'}`}
            >
              <Mascot mascot={b.mascot} size={20} />
              {b.name}
            </button>
          );
        })}
      </div>
      {over.map((b) => (
        <p key={b.id} role="status" className="text-amber-400">
          {b.name} lê mais de 8 KB de memória: o final será cortado na conversa.
        </p>
      ))}
    </div>
  );
}
