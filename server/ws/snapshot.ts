import type { WebSocket } from 'ws';
import { send } from './broadcast';
import { getLastRate } from './rate';
import { getLastPlanUsage, requestPlanUsageRefresh, planUsageBlockedUntil } from './usage-plan';
import { getLastModels } from './models';
import { threads } from './threads';
import { marathonKeys } from './marathon';

// Estado durável que o CLI só emite DURANTE um run (busy/rate/plan-usage/models):
// uma aba que suspendeu no mobile e voltou ficaria com o snapshot velho até um F5.
// Reemitido no bootstrap da conexão E no `sync` (resume) — mesmos getters/formato,
// sem duplicar.
export function sendDurableSnapshot(ws: WebSocket) {
  send(ws, { t: 'busy', keys: [...threads.keys()] });
  // Replay dos turnos EM VOO: um browser que reconecta (aba suspensa no mobile)
  // enquanto outra aba segue viva não passa pelo reemit do agente (só dispara
  // quando TODOS os browsers sumiram) — sem replay aqui o turno fica mudo e o
  // sessionId se perde (próximo envio viraria conversa nova no claude).
  for (const [key, thread] of threads) {
    send(ws, { t: 'replay', sessionKey: key, text: thread.text, thinking: thread.thinking, tools: thread.tools, startedAt: thread.startedAt, sessionId: thread.sessionId, model: thread.model });
  }
  const rate = getLastRate();
  if (rate) send(ws, { t: 'rate', ...rate });
  const planUsage = getLastPlanUsage();
  const blockedUntil = planUsageBlockedUntil();
  // Manda o que tem (inclusive nada + o bloqueio: o cliente precisa distinguir
  // "recusado pela conta" de "ainda carregando").
  if (planUsage || blockedUntil) send(ws, { t: 'plan-usage', usage: planUsage, blockedUntil: blockedUntil || null });
  // E SEMPRE pede um refresh, não só quando falta número: o poll é de 5min e
  // ninguém pola com o browser fechado, então quem abre o deck de manhã caía num
  // snapshot da noite anterior e esperava até 5min por um número atual. O
  // single-flight, o MIN_GAP e o cooldown já seguram o abuso deste pedido.
  requestPlanUsageRefresh();
  const models = getLastModels();
  if (models.length) send(ws, { t: 'models', models });
  send(ws, { t: 'marathon', keys: marathonKeys() });
}
