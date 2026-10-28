import { Mascot } from '../../components/team/Mascot';
import type { TeamBot } from '../../../shared/protocol';

interface Props {
  skillId: string;
  bots: TeamBot[];
  usedBy: string[];
  onToggle?: (botId: string, on: boolean) => void;
}

export function UsedBy({ skillId, bots, usedBy, onToggle }: Props) {
  if (bots.length === 0) return <p className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-[13px] text-neutral-500">Nenhum agente na equipe ainda.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
      {bots.map((b) => {
        const on = usedBy.includes(b.id);
        return (
          <div key={b.id} className="flex min-h-13 items-center gap-3 border-t border-neutral-800 px-4 py-2 first:border-t-0">
            <Mascot mascot={b.mascot} size={24} name={b.name} />
            <span className="min-w-0 flex-1 truncate text-[14px] text-neutral-100">{b.name}</span>
            {onToggle ? (
              <button type="button" role="switch" aria-checked={on} aria-label={`${b.name} usa ${skillId}`} onClick={() => onToggle(b.id, !on)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-orange-500/80' : 'bg-neutral-700'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            ) : (
              <span className={`text-[12px] ${on ? 'text-green-400' : 'text-neutral-600'}`}>{on ? 'ligada' : 'desligada'}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
