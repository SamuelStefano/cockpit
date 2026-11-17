import type { WebSocket } from 'ws';
import { clampDailyCap, type VillageView } from '../../shared/village';
import { readTasksChained } from '../planner/store';
import { isTeamPaused } from '../team-log';
import { dryRound } from '../village/round';
import { readVillage, setVillageSettings } from '../village/store';
import { send } from './broadcast';

export async function villageView(): Promise<VillageView> {
  const [state, tasks] = await Promise.all([readVillage(), readTasksChained()]);
  return {
    enabled: state.enabled,
    dailyCap: state.dailyCap,
    paused: isTeamPaused(),
    claimed: tasks.filter((t) => t.claim && t.column !== 'done').map((t) => ({ botId: t.claim!.botId, taskId: t.id })),
    events: state.events.map(({ at, type, botId, taskId }) => ({ at, type, botId, taskId })),
  };
}

export async function sendVillage(ws: WebSocket): Promise<void> {
  send(ws, { t: 'village', village: await villageView() });
}

export async function sendVillagePlan(ws: WebSocket): Promise<void> {
  send(ws, { t: 'village-plan', plan: await dryRound() });
}

export async function setVillageConfig(ws: WebSocket, msg: { enabled?: unknown; dailyCap?: unknown }): Promise<void> {
  const patch: { enabled?: boolean; dailyCap?: number } = {};
  if (msg.enabled !== undefined) {
    if (typeof msg.enabled !== 'boolean') { send(ws, { t: 'error', message: 'estado da vila inválido' }); return; }
    patch.enabled = msg.enabled;
  }
  if (msg.dailyCap !== undefined) {
    const cap = clampDailyCap(msg.dailyCap);
    if (cap === null) { send(ws, { t: 'error', message: 'limite diário inválido (1 a 24)' }); return; }
    patch.dailyCap = cap;
  }
  await setVillageSettings(patch);
  await sendVillage(ws);
}
