import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { ClientMsg, HarnessContext, HarnessEvent, HarnessModelChoice, HarnessTaskView } from '../../shared/protocol';
import { broadcast, send } from './broadcast';
import { managedEnvSync } from '../admin-ops';
import { harnessConfig } from '../harness/policy';
import { runTask } from '../harness/run';
import { finishTask, insertTask, listTasks } from '../harness/store';

// Borda WS do harness: traduz as mensagens e coordena persistência + broadcast. O
// estado/motor mora em server/harness/*; aqui só entra o que precisa de socket.

type HarnessMsg = Extract<ClientMsg, { t: `harness-${string}` }>;

export async function handleHarnessMsg(ws: WebSocket, msg: HarnessMsg): Promise<void> {
  switch (msg.t) {
    case 'harness-get':
      send(ws, { t: 'harness-config', config: harnessConfig(managedEnvSync()) });
      send(ws, { t: 'harness-tasks', tasks: listTasks() });
      return;
    case 'harness-run':
      await runHarnessTask(msg.prompt, msg.model, msg.context ?? null);
      return;
  }
}

async function runHarnessTask(prompt: string, choice: HarnessModelChoice, context: HarnessContext): Promise<void> {
  const id = randomUUID();
  const startedAt = Date.now();
  const via = choice.mode === 'auto' || choice.mode === 'model' ? choice.via : undefined;
  const running: HarnessTaskView = {
    id, ts: startedAt, prompt, context, mode: choice.mode, via,
    tier: 'medium', tierReason: '', model: '', status: 'running',
  };
  insertTask(running);
  broadcast({ t: 'harness-task', task: running });

  let selectedModel = '';
  let selectedProvider: string | undefined;
  const onEvent = (e: HarnessEvent): void => {
    if (e.kind === 'model-selected') {
      if (e.model) selectedModel = e.model;
      if (e.providerId) selectedProvider = e.providerId;
    }
    broadcast({ t: 'harness-event', taskId: id, event: e });
  };

  const result = await runTask({ prompt, choice, context, onEvent });
  const final: HarnessTaskView = {
    ...running,
    via: result.via ?? via,
    tier: result.tier,
    tierReason: result.tierReason,
    model: result.model || selectedModel,
    providerId: result.providerId ?? selectedProvider,
    status: result.status,
    resultText: result.resultText,
    costUsd: result.costUsd,
    costApprox: result.costApprox,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    durationMs: Date.now() - startedAt,
    error: result.error,
  };
  finishTask(id, final);
  broadcast({ t: 'harness-task', task: final });
}
