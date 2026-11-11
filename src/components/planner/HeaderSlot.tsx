import { TeamStack, type TeamStackProps } from '../team/TeamStack';
import type { PlannerApi } from '../../planner/usePlanner';
import { KanbanButton } from './KanbanButton';

export function HeaderSlot({ planner, team }: { planner: PlannerApi | null; team: TeamStackProps }) {
  return (
    <span className="flex items-center gap-1">
      {planner && <KanbanButton planner={planner} />}
      <TeamStack {...team} />
    </span>
  );
}
