import type { PlannerDifficulty } from '../../../shared/planner';
import { DIFFICULTY_LABELS } from '../../planner/planner-logic';

const TONE: Record<PlannerDifficulty, string> = { 1: 'bg-green-500', 2: 'bg-yellow-500', 3: 'bg-red-500' };

export function DifficultyPips({ value }: { value: PlannerDifficulty }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Dificuldade ${DIFFICULTY_LABELS[value]}`} title={DIFFICULTY_LABELS[value]}>
      {([1, 2, 3] as const).map((n) => (
        <span key={n} className={`h-1.5 w-3 rounded-full ${n <= value ? TONE[value] : 'bg-neutral-700'}`} />
      ))}
    </span>
  );
}
