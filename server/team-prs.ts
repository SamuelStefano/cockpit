import type { TeamBot, TeamPendingQuestion } from '../shared/protocol';
import { buildTeamPanel, type TeamPanel } from '../shared/team-panel';
import type { TeamState } from '../shared/team-state';
import { getPrsSnapshot } from './github/prs';

export const PR_REFRESH_FLOOR_MS = 60_000;

// getPrsSnapshot owns the 60 s cache and the single in-flight refresh: calling it
// here never adds a gh call. A gh failure becomes `prsError`, never a throw.
export async function teamPanelSnapshot(input: { team: TeamBot[]; state: TeamState; pending: TeamPendingQuestion[]; now?: number }): Promise<TeamPanel> {
  const now = input.now ?? Date.now();
  const prs = await getPrsSnapshot(false, now).catch(() => null);
  return buildTeamPanel({ team: input.team, state: input.state, pending: input.pending, prs, now });
}
