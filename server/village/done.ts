import type { TeamBot } from '../../shared/protocol';
import { PLANNER_LIMITS } from '../../shared/planner';
import { botWorkspace } from '../engine/restricted-profile';
import { updateTasks } from '../planner/store';
import type { HandoffOutcome, SpoolMessage, SpoolTaskDone } from '../team-outbox';
import { emitPlannerMsg } from '../ws/planner-clients';
import { appendVillageLog } from './store';

const SUMMARY_MAX = 600;

// team_task_done: closes ONLY the task that is in `claim` for the calling bot (the id comes
// from the MCP process the server launched for that bot's turn, never from tool arguments).
export async function applyTaskDone(m: SpoolMessage & { taskDone: SpoolTaskDone }, _team: TeamBot[], now = Date.now()): Promise<HandoffOutcome> {
  let outcome: HandoffOutcome = { ok: false, reason: 'tarefa não encontrada' };
  const summary = m.taskDone.summary.trim().slice(0, SUMMARY_MAX);
  if (!summary) return { ok: false, reason: 'resumo vazio' };
  const tasks = await updateTasks((list) => {
    const task = list.find((t) => t.id === m.taskDone.taskId);
    if (!task) return list;
    if (!task.claim) { outcome = { ok: false, reason: 'a tarefa não está em claim' }; return list; }
    if (task.claim.botId !== m.from) { outcome = { ok: false, reason: 'a tarefa está em claim de outro bot' }; return list; }
    const note = `\n\nEntregue por ${m.from}: ${summary}\nArquivos: ${botWorkspace(m.from) ?? '(workspace do bot)'}`;
    const { claim: _claim, ready: _r, readyBy: _rb, readyAt: _ra, wantReady: _w, ...rest } = task;
    const next = { ...rest, column: 'done' as const, doneAt: now, updatedAt: now, description: (task.description + note).slice(0, PLANNER_LIMITS.description) };
    outcome = { ok: true, text: task.title };
    return list.map((t) => (t.id === task.id ? next : t));
  });
  if (outcome.ok) {
    emitPlannerMsg({ t: 'planner-board', tasks });
    await appendVillageLog({ at: now, event: 'done', taskId: m.taskDone.taskId, botId: m.from }).catch(() => {});
  }
  return outcome;
}
