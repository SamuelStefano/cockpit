import type { WebSocket } from 'ws';
import { send } from './broadcast';
import { getLastRate } from './rate';
import { getLastPlanUsage, requestPlanUsageRefresh } from './usage-plan';
import { getLastModels } from './models';
import { threads } from './runs';

// Estado durável que o CLI só emite DURANTE um run (busy/rate/plan-usage/models):
// uma aba que suspendeu no mobile e voltou ficaria com o snapshot velho até um F5.
// Reemitido no bootstrap da conexão E no `sync` (resume) — mesmos getters/formato,
// sem duplicar.
export function sendDurableSnapshot(ws: WebSocket) {
  send(ws, { t: 'busy', keys: [...threads.keys()] });
  const rate = getLastRate();
  if (rate) send(ws, { t: 'rate', ...rate });
  const planUsage = getLastPlanUsage();
  // Sem snapshot ainda: pede um agora pra a barra não ficar em "—" até o próximo poll.
  if (planUsage) send(ws, { t: 'plan-usage', usage: planUsage });
  else requestPlanUsageRefresh();
  const models = getLastModels();
  if (models.length) send(ws, { t: 'models', models });
}
