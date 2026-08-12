import type { PointsHistoryItem } from '../../../shared/protocol';
import { Icon } from '../../components/primitives';
import { kindLabel, hhmm } from './format';

// Timeline da trilha de procedência — o "histórico prevalece" visível. Cada evento
// mostra quem (🤖 agente / ✍️ você), o que fez e o horário.
export function PointsHistory({ history }: { history: PointsHistoryItem[] }) {
  return (
    <ol className="mt-2 space-y-1.5 border-l border-neutral-800 pl-3">
      {history.map((h, i) => (
        <li key={i} className="flex items-center gap-2 text-[11.5px] text-neutral-400">
          <Icon name={h.by === 'agent' ? 'sparkles' : 'pencil'} size={11} className={h.by === 'agent' ? 'text-orange-400/80' : 'text-neutral-500'} />
          <span className="text-neutral-500">{h.by === 'agent' ? 'agente' : 'você'}</span>
          <span>{kindLabel(h.kind)}</span>
          {h.kind !== 'note' && typeof h.points === 'number' && <span className="font-medium tabular-nums text-neutral-300">{h.points} pts</span>}
          {h.kind === 'note' && h.description && <span className="truncate italic text-neutral-500">“{h.description}”</span>}
          <span className="ml-auto shrink-0 tabular-nums text-neutral-600">{hhmm(h.at)}</span>
        </li>
      ))}
    </ol>
  );
}
