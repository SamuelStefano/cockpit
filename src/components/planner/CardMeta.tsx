import type { PlannerTask } from '../../../shared/planner';
import type { TeamBot } from '../../../shared/protocol';
import { isUnsafeTask } from '../../../shared/village-risk';
import { Badge } from '../primitives';
import { Mascot } from '../team/Mascot';
import { DIFFICULTY_LABELS, linkChipLabel } from '../../planner/planner-logic';

const chip = 'max-w-36 truncate rounded px-1.5 py-px text-[11px] leading-4';
const MAX_LINKS = 2;

export function CardMeta({ task, bots = [], onToggleReady }: { task: PlannerTask; bots?: TeamBot[]; onToggleReady?: () => void }) {
  const { tag, difficulty, links } = task;
  const owner = task.ownerBotId ? bots.find((b) => b.id === task.ownerBotId) : undefined;
  // Machine refs (placar:<uuid>) are import keys, not something a person reads.
  const ref = task.ref && !task.ref.includes(':') ? task.ref : undefined;
  const unsafe = task.column !== 'done' && isUnsafeTask(task);
  const ready = task.ready === true;
  const wants = !ready && !!task.wantReady;
  const canMark = !!onToggleReady && !unsafe;
  if (!ref && !tag && difficulty === 1 && !links.length && task.source !== 'agent' && !owner && !unsafe && !ready && !wants && !canMark) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-neutral-500">
      {owner && (
        <span className="flex items-center" title={`Dono: ${owner.name}`} aria-label={`Dono: ${owner.name}`}>
          <Mascot mascot={owner.mascot} size={18} name={owner.name} />
        </span>
      )}
      {ready && <Badge tone="green" title={task.readyBy}>pronta</Badge>}
      {wants && <Badge tone="yellow" title={`${task.wantReady!.by}: ${task.wantReady!.reason}`}>quer-pronta</Badge>}
      {unsafe && <Badge tone="red" title="Contém termo de risco ou marcada como insegura: a vila não pega">insegura</Badge>}
      {canMark && (
        <span onClick={(e) => e.stopPropagation()}>
          <Badge tone={ready ? 'neutral' : 'orange'} onClick={onToggleReady}>{ready ? 'Desmarcar pronta' : 'Marcar pronta'}</Badge>
        </span>
      )}
      {ref && <span className={`${chip} bg-neutral-800/70 font-mono text-neutral-400`} title={ref}>{ref}</span>}
      {tag && <span className={`${chip} border border-neutral-800 text-neutral-400`}>{tag}</span>}
      {difficulty !== 1 && <span className="px-0.5 text-[11px]">{DIFFICULTY_LABELS[difficulty]}</span>}
      {task.source === 'agent' && <span className="px-0.5 text-[11px] text-neutral-600" title="Criada por um agente">agente</span>}
      {links.length > 0 && (
        <span className="ml-auto flex min-w-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {links.slice(0, MAX_LINKS).map((l) => (
            <a
              key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" draggable={false} title={l.url}
              className={`${chip} text-neutral-400 underline-offset-2 hover:text-orange-300 hover:underline`}
            >{linkChipLabel(l)}</a>
          ))}
          {links.length > MAX_LINKS && <span className="text-[11px]">+{links.length - MAX_LINKS}</span>}
        </span>
      )}
    </div>
  );
}
