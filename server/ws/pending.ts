import type { WebSocket } from 'ws';
import { sameParams, type RunParams } from './threads';
import { MAX_PROMPT_BYTES } from '../../shared/limits';

// Fila de prompts triados como 'wait'/'merge' enquanto o turno da sessão rodava.
// Drenada (sequencialmente) no onClose do turno atual — um turno por vez, mantendo
// a invariante "1 runMsg por sessão" do cliente. merge marca p/ enquadrar como
// continuação no drain.
export interface QueuedSend extends RunParams {
  // null: server/canvas/flows.ts enqueues an in-process pending item for a
  // flow-target session that's live on THIS process but has no drainer here
  // (see runs.ts isDrainerEnabled) — same "no client attached" shape startRun
  // already handles everywhere else.
  ws: WebSocket | null;
  prompt: string;
  msgId?: string;
  merge?: boolean;
}

const pending = new Map<string, QueuedSend[]>();

// Teto da fila por sessão: sem isto, marteladas num turno ocupado enfileiram sem
// limite — cada item segura um prompt (até maxPromptBytes) e um ws, a memória
// cresce a noite toda. Acima do teto, recusa com erro em vez de acumular.
export const MAX_PENDING = 50;

export function enqueuePending(sessionKey: string, item: QueuedSend): boolean {
  const arr = pending.get(sessionKey) ?? [];
  if (arr.length >= MAX_PENDING) return false;
  arr.push(item);
  pending.set(sessionKey, arr);
  return true;
}

export function hasPending(sessionKey: string): boolean {
  return !!pending.get(sessionKey)?.length;
}

// Coalesce: junta itens CONSECUTIVOS de mesma classe (merge/wait) e mesmos params
// de turno num único --resume — vários prompts enfileirados viravam N turnos
// sequenciais, cada um re-lendo o contexto e re-pensando (latência empilhada).
// Divergência de params impede merge seguro → para o batch. A comparação campo a
// campo fica no sameParams, que deriva a lista de RUN_PARAM_KEYS: duplicá-la aqui
// foi como o `effort` ficou de fora antes, coalescendo turnos de esforço diferente.
export function sameTurnParams(a: QueuedSend, b: QueuedSend): boolean {
  return a.merge === b.merge && sameParams(a, b);
}

// Room for the "Complemento do pedido anterior" frame added below.
const MERGE_FRAME_BYTES = 64;

// Tira o próximo lote da fila e devolve o prompt já enquadrado. `first` carrega os
// params do turno; merge enquadra como complemento explícito.
export function takePendingBatch(sessionKey: string): { first: QueuedSend; text: string } | null {
  const arr = pending.get(sessionKey);
  if (!arr || arr.length === 0) return null;
  const first = arr.shift()!;
  const batch = [first];
  // Stop merging before the joined prompt would pass the prompt cap: two 60 KB
  // pastes merged into one 120 KB turn were rejected by startRun and BOTH lost.
  // What doesn't fit stays queued as the next batch.
  let bytes = Buffer.byteLength(first.prompt, 'utf8');
  while (arr.length && sameTurnParams(first, arr[0])) {
    const add = Buffer.byteLength(arr[0].prompt, 'utf8') + 2;
    if (bytes + add > MAX_PROMPT_BYTES - MERGE_FRAME_BYTES) break;
    bytes += add;
    batch.push(arr.shift()!);
  }
  if (arr.length === 0) pending.delete(sessionKey);
  const joined = batch.map((b) => b.prompt).join('\n\n');
  return { first, text: first.merge ? `Complemento do pedido anterior:\n\n${joined}` : joined };
}

// Esvazia a fila de uma vez, pra migrá-la inteira pra fila estacionada (disco)
// quando os tokens acabam.
export function takeAllPending(sessionKey: string): QueuedSend[] {
  const arr = pending.get(sessionKey);
  if (!arr || arr.length === 0) return [];
  pending.delete(sessionKey);
  return arr;
}
