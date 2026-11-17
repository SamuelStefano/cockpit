import type { WebSocket } from 'ws';
import { clampDailyCap, type VillageView } from '../../shared/village';
import { readTasksChained } from '../planner/store';
import { isTeamPaused } from '../team-log';
import { readVillage, setDailyCap } from '../village/store';
import { send } from './broadcast';

export async function villageView(): Promise<VillageView> {
  const [state, tasks] = await Promise.all([readVillage(), readTasksChained()]);
  return {
    dailyCap: state.dailyCap,
    paused: isTeamPaused(),
    claimed: tasks.filter((t) => t.claim && t.column !== 'done').map((t) => ({ botId: t.claim!.botId, taskId: t.id })),
    events: state.events.map(({ at, type, botId, taskId }) => ({ at, type, botId, taskId })),
  };
}

export async function sendVillage(ws: WebSocket): Promise<void> {
  send(ws, { t: 'village', village: await villageView() });
}

export async function setVillageConfig(ws: WebSocket, dailyCap: unknown): Promise<void> {
  const cap = clampDailyCap(dailyCap);
  if (cap === null) { send(ws, { t: 'error', message: 'limite diário inválido (1 a 24)' }); return; }
  await setDailyCap(cap);
  await sendVillage(ws);
}
