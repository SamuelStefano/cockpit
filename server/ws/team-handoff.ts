import type { TeamBot } from '../../shared/protocol';
import { botName } from '../../shared/team-messages';
import { applyHandoff, handoffNote } from '../../shared/task-handoff';
import { updateTasks } from '../planner/store';
import type { HandoffOutcome, SpoolHandoff } from '../team-outbox';
import { emitPlannerMsg } from './planner-clients';

export async function applyBotHandoff(m: { from: string; to: string; handoff: SpoolHandoff }, team: TeamBot[], now = Date.now()): Promise<HandoffOutcome> {
  let outcome: HandoffOutcome = { ok: false, reason: 'tarefa não encontrada' };
  const tasks = await updateTasks((list) => {
    const task = list.find((t) => t.id === m.handoff.taskId);
    if (!task) return list;
    if (task.ownerBotId && task.ownerBotId !== m.from) {
      outcome = { ok: false, reason: 'o remetente não é o dono da tarefa' };
      return list;
    }
    const { taskId: _taskId, ...fields } = m.handoff;
    const next = applyHandoff(task, { at: now, ...(task.ownerBotId ? { fromBotId: task.ownerBotId } : {}), toBotId: m.to, ...fields });
    if (!next.ok) {
      outcome = { ok: false, reason: next.reason };
      return list;
    }
    const entry = next.task.handoffs![next.task.handoffs!.length - 1];
    outcome = { ok: true, text: `Tarefa "${task.title}" (${task.id})\n${handoffNote(entry, (id) => botName(team, id))}` };
    return list.map((t) => (t.id === task.id ? next.task : t));
  });
  if (outcome.ok) emitPlannerMsg({ t: 'planner-board', tasks });
  return outcome;
}
